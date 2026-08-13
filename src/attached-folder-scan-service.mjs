import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  getConfiguredSource,
  isConfiguredSecretPath,
  matchesConfiguredDocument,
  parseConfig,
  resolveConfiguredPath
} from "./config.mjs";
import { AgentDocError } from "./errors.mjs";

const RESULT_LIMIT = 100;
const MAX_WARNINGS = 50;
const PROTECTED_DIRECTORY_NAMES = new Set([".aws", ".azure", ".gnupg", ".ssh"]);
const PROTECTED_FILE_NAMES = new Set([
  ".env",
  "credentials.json",
  "id_dsa",
  "id_ed25519",
  "id_rsa",
  "known_hosts"
]);
const PROTECTED_FILE_SUFFIXES = [".key", ".p12", ".pem", ".pfx"];

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function samePath(left, right) {
  return comparablePath(left) === comparablePath(right);
}

function isWithin(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isProtectedPath(filePath) {
  const parsed = path.parse(path.resolve(filePath));
  const relative = path.resolve(filePath).slice(parsed.root.length);
  const parts = relative.split(path.sep).filter(Boolean).map((part) => part.toLowerCase());
  const fileName = parts.at(-1) ?? "";
  return parts.slice(0, -1).some((part) => PROTECTED_DIRECTORY_NAMES.has(part))
    || PROTECTED_FILE_NAMES.has(fileName)
    || PROTECTED_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
}

function compareEntries(left, right) {
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
    || left.name.localeCompare(right.name);
}

function createState(config) {
  return {
    config,
    deadline: Date.now() + config.limits.timeoutMs,
    stopped: false,
    truncated: false,
    hasMore: false,
    warningCount: 0,
    warnings: [],
    stats: {
      directoriesScanned: 0,
      filesConsidered: 0,
      filesMatched: 0,
      skippedIgnored: 0,
      skippedLinks: 0,
      unavailablePaths: 0,
      permissionErrors: 0
    }
  };
}

function addWarning(state, code, message, filePath = undefined) {
  state.warningCount += 1;
  if (state.warnings.length < MAX_WARNINGS) {
    state.warnings.push({ code, message, ...(filePath ? { path: filePath } : {}) });
  }
}

function shouldStop(state) {
  if (state.stopped) {
    return true;
  }
  if (Date.now() > state.deadline) {
    state.stopped = true;
    state.truncated = true;
    addWarning(state, "SCAN_TIMEOUT", `Scan exceeded ${state.config.limits.timeoutMs} ms.`);
    return true;
  }
  if (state.stats.filesConsidered >= state.config.limits.maxFiles) {
    state.stopped = true;
    state.truncated = true;
    addWarning(state, "SCAN_FILE_LIMIT_REACHED", `Scan reached the configured ${state.config.limits.maxFiles} file limit.`);
    return true;
  }
  return false;
}

function matchesTool(filePath, config) {
  const candidate = config.caseSensitive ? path.basename(filePath) : path.basename(filePath).toLowerCase();
  return config.tools.extensions.some((extension) => (
    candidate.endsWith(config.caseSensitive ? extension : extension.toLowerCase())
  ));
}

async function resolveScanDirectory(directory, state) {
  try {
    const directoryStat = await fs.lstat(directory.path);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      if (directoryStat.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
      }
      addWarning(state, "SCAN_DIRECTORY_INVALID", "Attached tool folder must be a regular non-link directory.", directory.path);
      return null;
    }
    const realRoot = await fs.realpath(directory.path);
    if (!state.config.followLinks && !samePath(directory.path, realRoot)) {
      state.stats.skippedLinks += 1;
      addWarning(state, "SCAN_DIRECTORY_LINK_NOT_ALLOWED", "Attached tool folder resolves through a link or junction.", directory.path);
      return null;
    }
    return realRoot;
  } catch (error) {
    state.stats.unavailablePaths += 1;
    addWarning(state, "SCAN_DIRECTORY_UNAVAILABLE", error instanceof Error ? error.message : String(error), directory.path);
    return null;
  }
}

async function verifyMatchingFile(filePath, realRoot, state) {
  try {
    const fileStat = await fs.lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      if (fileStat.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
      }
      return null;
    }
    const realPath = await fs.realpath(filePath);
    if (!state.config.followLinks && !samePath(filePath, realPath)) {
      state.stats.skippedLinks += 1;
      return null;
    }
    if (!isWithin(realPath, realRoot)) {
      state.stats.skippedLinks += 1;
      return null;
    }
    if (isProtectedPath(realPath) || isConfiguredSecretPath(realPath, state.config)) {
      state.stats.skippedIgnored += 1;
      return null;
    }
    return realPath;
  } catch (error) {
    state.stats.unavailablePaths += 1;
    addWarning(state, "SCAN_FILE_UNAVAILABLE", error instanceof Error ? error.message : String(error), filePath);
    return null;
  }
}

async function *walkAttachedDirectory(directory, matchesFile, state) {
  const realRoot = await resolveScanDirectory(directory, state);
  const recursive = directory.recursive !== false;
  if (!realRoot) {
    return;
  }

  const pending = [{ type: "directory", fullPath: realRoot }];

  while (pending.length > 0 && !shouldStop(state)) {
    const current = pending.pop();
    if (current.type === "file") {
      state.stats.filesConsidered += 1;
      if (!matchesFile(current.fullPath)) {
        continue;
      }
      const realPath = await verifyMatchingFile(current.fullPath, realRoot, state);
      if (!realPath) {
        continue;
      }
      state.stats.filesMatched += 1;
      yield realPath;
      continue;
    }

    let entries;
    try {
      entries = await fs.readdir(current.fullPath, { withFileTypes: true });
      state.stats.directoriesScanned += 1;
    } catch (error) {
      state.stats.permissionErrors += 1;
      addWarning(state, "SCAN_DIRECTORY_UNREADABLE", error instanceof Error ? error.message : String(error), current.fullPath);
      continue;
    }

    entries.sort(compareEntries);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const fullPath = path.join(current.fullPath, entry.name);
      if (entry.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (!recursive) {
          continue;
        }
        if (PROTECTED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
          state.stats.skippedIgnored += 1;
          continue;
        }
        pending.push({ type: "directory", fullPath });
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (isProtectedPath(fullPath) || isConfiguredSecretPath(fullPath, state.config)) {
        state.stats.skippedIgnored += 1;
        continue;
      }
      pending.push({ type: "file", fullPath });
    }
  }
}

function resolveAttachedDirectory(config, directoryPathInput) {
  if (typeof directoryPathInput !== "string" || directoryPathInput.trim().length === 0) {
    throw new AgentDocError("UI_SCAN_DIRECTORY_REQUIRED", "Scan requires the attached tool folder path.");
  }
  if (directoryPathInput.length > 32_768) {
    throw new AgentDocError("UI_SCAN_DIRECTORY_INVALID", "Attached tool folder path is too long.");
  }

  const requestedPath = resolveConfiguredPath(directoryPathInput.trim(), config.configDirectory);
  const directory = config.tools.directories.find((entry) => samePath(entry.path, requestedPath));
  if (!directory) {
    throw new AgentDocError(
      "UI_SCAN_DIRECTORY_NOT_ATTACHED",
      "Scan can only run for a tool folder attached in the current configuration."
    );
  }
  return directory;
}

export async function scanAttachedFolder({ kind, directoryPath, config: rawConfig }, options = {}) {
  if (kind !== "tool" && kind !== "document") {
    throw new AgentDocError("UI_SCAN_KIND_INVALID", "Scan kind must be 'tool' or 'document'.");
  }
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throw new AgentDocError("UI_SCAN_CONFIG_REQUIRED", "Scan requires the current configuration.");
  }

  const started = performance.now();
  const config = await parseConfig(rawConfig, options.configPath);
  const directory = resolveAttachedDirectory(config, directoryPath);
  const documentSource = kind === "document" ? getConfiguredSource(config) : null;
  const matchesFile = kind === "tool"
    ? (filePath) => matchesTool(filePath, config)
    : (filePath) => matchesConfiguredDocument(filePath, documentSource, config.caseSensitive);
  const state = createState(config);
  const results = [];

  for await (const filePath of walkAttachedDirectory(directory, matchesFile, state)) {
    if (results.length === RESULT_LIMIT) {
      state.hasMore = true;
      state.stopped = true;
      state.truncated = true;
      addWarning(
        state,
        "SCAN_RESULT_LIMIT_REACHED",
        `Scan found more than ${RESULT_LIMIT} matching files. Showing the first ${RESULT_LIMIT} results.`
      );
      break;
    }
    results.push({ path: filePath });
  }

  return {
    schemaVersion: "1.0",
    ok: true,
    kind,
    directory: {
      name: directory.name,
      path: directory.path
    },
    results,
    meta: {
      backend: "direct-scan",
      indexed: false,
      networkUsed: false,
      resultLimit: RESULT_LIMIT,
      hasMore: state.hasMore,
      truncated: state.truncated,
      recursive: directory.recursive,
      configPath: config.configPath,
      elapsedMs: Math.round(performance.now() - started),
      warningCount: state.warningCount,
      ...state.stats
    },
    warnings: state.warnings
  };
}
