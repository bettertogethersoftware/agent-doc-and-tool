import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";

import createIgnore from "ignore";

import { getSource, loadConfig, matchesConfiguredDocument } from "./config.mjs";
import { AgentDocError } from "./errors.mjs";
import { canonicalize, countLines, createQueryPlan, decodeText, sha256, splitLines } from "./text.mjs";

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
const MAX_WARNINGS = 50;

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

function toPortableRelative(relativePath) {
  return relativePath.split(path.sep).join("/");
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

function buildIgnoreSpec(config) {
  const ignoreSpec = createIgnore();
  for (const patterns of config.ignorePatterns) {
    ignoreSpec.add(patterns);
  }
  return ignoreSpec;
}

function isIgnored(ignoreSpec, relativePath, directory = false) {
  if (!relativePath) {
    return false;
  }
  const portable = toPortableRelative(relativePath) + (directory ? "/" : "");
  return ignoreSpec.ignores(portable);
}

function createState(config) {
  return {
    config,
    deadline: Date.now() + config.limits.timeoutMs,
    stopped: false,
    truncated: false,
    warnings: [],
    warningCount: 0,
    enumerationBackends: new Set(),
    stats: {
      rootsVisited: 0,
      directoriesScanned: 0,
      filesConsidered: 0,
      filesRead: 0,
      filesMatched: 0,
      skippedIgnored: 0,
      skippedLinks: 0,
      skippedOversize: 0,
      skippedBinary: 0,
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
    addWarning(state, "SEARCH_TIMEOUT", `Search exceeded ${state.config.limits.timeoutMs} ms.`);
    return true;
  }
  if (state.stats.filesConsidered >= state.config.limits.maxFiles) {
    state.stopped = true;
    state.truncated = true;
    addWarning(state, "FILE_LIMIT_REACHED", `Search reached the configured ${state.config.limits.maxFiles} file limit.`);
    return true;
  }
  return false;
}

async function realDirectory(root, state) {
  try {
    const rootStat = await fs.lstat(root.path);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      if (rootStat.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
      }
      addWarning(state, "ROOT_NOT_DIRECTORY", "Configured root must be a regular non-link directory.", root.path);
      return null;
    }
    const realRoot = await fs.realpath(root.path);
    if (!state.config.followLinks && !samePath(path.resolve(root.path), realRoot)) {
      state.stats.skippedLinks += 1;
      addWarning(state, "ROOT_LINK_NOT_ALLOWED", "Configured root resolves through a link or junction.", root.path);
      return null;
    }
    return realRoot;
  } catch (error) {
    addWarning(state, "ROOT_UNAVAILABLE", error instanceof Error ? error.message : String(error), root.path);
    return null;
  }
}

async function *walkRoot(root, source, state, seenPaths, knownRealRoot = undefined) {
  const realRoot = knownRealRoot ?? await realDirectory(root, state);
  if (!realRoot) {
    return;
  }

  state.stats.rootsVisited += 1;
  state.enumerationBackends.add("node-walker");
  const ignoreSpec = buildIgnoreSpec(state.config);
  const directories = [{ fullPath: realRoot, relativePath: "" }];

  while (directories.length > 0 && !shouldStop(state)) {
    const current = directories.pop();
    let entries;
    try {
      entries = await fs.readdir(current.fullPath, { withFileTypes: true });
      state.stats.directoriesScanned += 1;
    } catch (error) {
      state.stats.permissionErrors += 1;
      addWarning(state, "DIRECTORY_UNREADABLE", error instanceof Error ? error.message : String(error), current.fullPath);
      continue;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (shouldStop(state)) {
        break;
      }

      const entry = entries[index];
      const fullPath = path.join(current.fullPath, entry.name);
      const relativePath = current.relativePath ? path.join(current.relativePath, entry.name) : entry.name;

      if (entry.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (PROTECTED_DIRECTORY_NAMES.has(entry.name.toLowerCase()) || isIgnored(ignoreSpec, relativePath, true)) {
          state.stats.skippedIgnored += 1;
          continue;
        }
        directories.push({ fullPath, relativePath });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (isProtectedPath(fullPath) || isIgnored(ignoreSpec, relativePath)) {
        state.stats.skippedIgnored += 1;
        continue;
      }
      if (!matchesConfiguredDocument(fullPath, source, state.config.caseSensitive)) {
        continue;
      }
      state.stats.filesConsidered += 1;

      const comparable = comparablePath(fullPath);
      if (seenPaths.has(comparable)) {
        continue;
      }
      seenPaths.add(comparable);
      yield {
        path: fullPath,
        relativePath: toPortableRelative(relativePath),
        root: root.name,
        priority: root.priority,
        explicit: false
      };
    }
  }
}

function ripgrepArguments(source, config) {
  const arguments_ = ["--files", "--null", "--hidden", "--no-ignore-vcs"];
  if (config.ignoreFile) {
    arguments_.push("--ignore-file", config.ignoreFile);
  }
  for (const fileName of source.fileNames) {
    arguments_.push("--iglob", `**/${fileName}`);
  }
  for (const extension of source.extensions) {
    arguments_.push("--iglob", `**/*${extension}`);
  }
  arguments_.push(".");
  return arguments_;
}

async function listRootWithRipgrep(realRoot, source, state) {
  if (source.fileNames.length === 0 && source.extensions.length === 0) {
    return [];
  }

  const executable = process.env.AGENT_DOC_SEARCH_RG?.trim() || "rg";
  const remainingMs = Math.max(100, state.deadline - Date.now());
  return new Promise((resolve) => {
    const child = spawn(executable, ripgrepArguments(source, state.config), {
      cwd: realRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let timedOut = false;
    let outputLimitReached = false;
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, remainingMs);

    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 50_000_000) {
        outputLimitReached = true;
        child.kill();
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      if (error?.code !== "ENOENT") {
        addWarning(state, "RIPGREP_START_FAILED", error instanceof Error ? error.message : String(error), realRoot);
      }
      finish(null);
    });
    child.on("close", (code) => {
      if (timedOut) {
        state.stopped = true;
        state.truncated = true;
        addWarning(state, "SEARCH_TIMEOUT", `Search exceeded ${state.config.limits.timeoutMs} ms.`, realRoot);
        finish([]);
        return;
      }
      if (outputLimitReached) {
        state.stopped = true;
        state.truncated = true;
        addWarning(state, "ENUMERATION_OUTPUT_LIMIT", "Ripgrep file enumeration exceeded 50 MB.", realRoot);
        finish([]);
        return;
      }
      if (code !== 0 && code !== 1) {
        const diagnostic = Buffer.concat(stderr).toString("utf8").trim();
        addWarning(state, "RIPGREP_FAILED", diagnostic || `Ripgrep exited with code ${code}.`, realRoot);
        finish(null);
        return;
      }

      const entries = Buffer.concat(stdout).toString("utf8").split("\0").filter(Boolean);
      entries.sort((left, right) => left.localeCompare(right));
      finish(entries);
    });
  });
}

async function *enumerateRoot(root, source, state, seenPaths) {
  const realRoot = await realDirectory(root, state);
  if (!realRoot) {
    return;
  }

  const listed = await listRootWithRipgrep(realRoot, source, state);
  if (listed === null) {
    yield* walkRoot(root, source, state, seenPaths, realRoot);
    return;
  }

  state.stats.rootsVisited += 1;
  state.enumerationBackends.add("ripgrep");
  const ignoreSpec = buildIgnoreSpec(state.config);
  for (const listedPath of listed) {
    if (shouldStop(state)) {
      return;
    }
    const fullPath = path.resolve(realRoot, listedPath);
    if (!isWithin(fullPath, realRoot)) {
      continue;
    }
    const relativePath = path.relative(realRoot, fullPath);
    if (isProtectedPath(fullPath) || isIgnored(ignoreSpec, relativePath)) {
      state.stats.skippedIgnored += 1;
      continue;
    }
    if (!matchesConfiguredDocument(fullPath, source, state.config.caseSensitive)) {
      continue;
    }

    state.stats.filesConsidered += 1;
    const comparable = comparablePath(fullPath);
    if (seenPaths.has(comparable)) {
      continue;
    }
    seenPaths.add(comparable);
    yield {
      path: fullPath,
      relativePath: toPortableRelative(relativePath),
      root: root.name,
      priority: root.priority,
      explicit: false
    };
  }
}

async function *specificFiles(source, state, seenPaths) {
  for (const configuredFile of source.files) {
    if (shouldStop(state)) {
      return;
    }
    state.stats.filesConsidered += 1;
    if (isProtectedPath(configuredFile)) {
      state.stats.skippedIgnored += 1;
      addWarning(state, "PROTECTED_FILE_SKIPPED", "Configured file is blocked by the protected-path policy.", configuredFile);
      continue;
    }

    try {
      const fileStat = await fs.lstat(configuredFile);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        state.stats.skippedLinks += 1;
        addWarning(state, "SPECIFIC_FILE_INVALID", "Configured file must be a regular non-link file.", configuredFile);
        continue;
      }
      const realPath = await fs.realpath(configuredFile);
      const comparable = comparablePath(realPath);
      if (seenPaths.has(comparable)) {
        continue;
      }
      seenPaths.add(comparable);
      yield {
        path: realPath,
        relativePath: path.basename(realPath),
        root: "specific-files",
        priority: 1_000,
        explicit: true
      };
    } catch (error) {
      addWarning(state, "SPECIFIC_FILE_UNAVAILABLE", error instanceof Error ? error.message : String(error), configuredFile);
    }
  }
}

function createLinePreview(lineText, queryPlan, config) {
  const maxChars = config.limits.maxLineChars;
  if (lineText.length <= maxChars) {
    return {
      lineText,
      lineTextLength: lineText.length,
      lineTextStartColumn: 1,
      lineTextTruncated: false
    };
  }

  const candidate = config.caseSensitive ? lineText : lineText.toLowerCase();
  const anchors = [queryPlan.normalizedQuery, ...queryPlan.terms.slice().sort((left, right) => right.length - left.length)];
  const anchor = anchors
    .map((term) => candidate.indexOf(term))
    .find((index) => index >= 0) ?? 0;
  const start = Math.max(0, Math.min(anchor - Math.floor(maxChars / 4), lineText.length - maxChars));
  const end = Math.min(lineText.length, start + maxChars);
  let preview = lineText.slice(start, end);
  if (start > 0) {
    preview = `…${preview.slice(1)}`;
  }
  if (end < lineText.length) {
    preview = `${preview.slice(0, -1)}…`;
  }

  return {
    lineText: preview,
    lineTextLength: lineText.length,
    lineTextStartColumn: start + 1,
    lineTextTruncated: true
  };
}

function matchText(text, candidate, queryPlan, config) {
  const lines = splitLines(text);
  const exactHits = [];
  const allTermHits = [];
  const partialHits = [];
  const fileTerms = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index];
    const normalizedLine = canonicalize(lineText, config.caseSensitive);
    if (!normalizedLine) {
      continue;
    }

    const matchedTerms = queryPlan.terms.filter((term) => normalizedLine.includes(term));
    for (const term of matchedTerms) {
      fileTerms.add(term);
    }
    if (matchedTerms.length === 0) {
      continue;
    }

    const hit = { lineNumber: index + 1, lineText, matchedTerms };
    if (normalizedLine.includes(queryPlan.normalizedQuery)) {
      exactHits.push(hit);
    } else if (matchedTerms.length === queryPlan.terms.length) {
      allTermHits.push(hit);
    } else {
      partialHits.push(hit);
    }
  }

  if (!queryPlan.terms.every((term) => fileTerms.has(term))) {
    return [];
  }

  const normalizedPath = canonicalize(candidate.relativePath, config.caseSensitive);
  const pathMatchedTerms = queryPlan.terms.filter((term) => normalizedPath.includes(term));
  const pathDepth = candidate.relativePath.split("/").filter(Boolean).length;
  const pathScore = (pathMatchedTerms.length * 30) - Math.min(pathDepth, 20);

  let matchType;
  let baseScore;
  let selected;
  if (exactHits.length > 0) {
    matchType = "exact_phrase";
    baseScore = 1_000;
    selected = exactHits;
  } else if (allTermHits.length > 0) {
    matchType = "all_terms_line";
    baseScore = 800;
    selected = allTermHits;
  } else {
    matchType = "all_terms_file";
    baseScore = 600;
    selected = partialHits.sort((left, right) => (
      right.matchedTerms.length - left.matchedTerms.length || left.lineNumber - right.lineNumber
    ));
  }

  return selected.slice(0, config.limits.maxMatchesPerFile).map((hit) => {
    const preview = createLinePreview(hit.lineText, queryPlan, config);
    return {
      path: candidate.path,
      lineNumber: hit.lineNumber,
      ...preview,
      sourceRoot: candidate.root,
      relativePath: candidate.relativePath,
      matchType,
      matchedTerms: hit.matchedTerms,
      pathMatchedTerms,
      score: baseScore + (hit.matchedTerms.length * 10) + candidate.priority + pathScore
    };
  });
}

async function searchCandidate(candidate, queryPlan, state) {
  let fileStat;
  try {
    fileStat = await fs.lstat(candidate.path);
  } catch (error) {
    addWarning(state, "FILE_UNREADABLE", error instanceof Error ? error.message : String(error), candidate.path);
    return [];
  }

  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    state.stats.skippedLinks += 1;
    return [];
  }
  if (fileStat.size > state.config.limits.maxFileBytes) {
    state.stats.skippedOversize += 1;
    return [];
  }

  try {
    const buffer = await fs.readFile(candidate.path);
    const decoded = decodeText(buffer);
    if (decoded.binary) {
      state.stats.skippedBinary += 1;
      return [];
    }
    state.stats.filesRead += 1;
    return matchText(decoded.text, candidate, queryPlan, state.config);
  } catch (error) {
    state.stats.permissionErrors += 1;
    addWarning(state, "FILE_UNREADABLE", error instanceof Error ? error.message : String(error), candidate.path);
    return [];
  }
}

export async function searchDocuments({ query, source: sourceInput = undefined, maxResults = undefined }, options = {}) {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new AgentDocError("QUERY_EMPTY", "Search query is required.");
  }
  if (query.length > 500) {
    throw new AgentDocError("QUERY_TOO_LONG", "Search query must be 500 characters or fewer.");
  }

  const started = performance.now();
  const config = await loadConfig(options.configPath);
  const source = getSource(config, sourceInput);
  const queryPlan = createQueryPlan(query, config.caseSensitive);
  const resultLimit = Math.min(maxResults ?? config.limits.maxResults, config.limits.maxResults);
  const state = createState(config);
  const seenPaths = new Set();
  const results = [];

  for await (const candidate of specificFiles(source, state, seenPaths)) {
    const matches = await searchCandidate(candidate, queryPlan, state);
    if (matches.length > 0) {
      state.stats.filesMatched += 1;
      results.push(...matches);
    }
  }

  for (const root of source.roots) {
    if (state.stopped) {
      break;
    }
    for await (const candidate of enumerateRoot(root, source, state, seenPaths)) {
      const matches = await searchCandidate(candidate, queryPlan, state);
      if (matches.length > 0) {
        state.stats.filesMatched += 1;
        results.push(...matches);
      }
      if (results.length >= resultLimit * 20) {
        state.truncated = true;
        state.stopped = true;
        addWarning(state, "MATCH_COLLECTION_LIMIT", "Search stopped after collecting enough candidate matches to rank.");
        break;
      }
    }
    if (state.stopped) {
      break;
    }
  }

  results.sort((left, right) => (
    right.score - left.score
    || left.path.localeCompare(right.path)
    || left.lineNumber - right.lineNumber
  ));
  if (results.length > resultLimit) {
    state.truncated = true;
  }

  return {
    schemaVersion: "1.0",
    ok: true,
    source: source.name,
    query,
    queryPlan,
    results: results.slice(0, resultLimit),
    meta: {
      backend: "direct-scan",
      enumerationBackends: [...state.enumerationBackends],
      indexed: false,
      networkUsed: false,
      configPath: config.configPath,
      elapsedMs: Math.round(performance.now() - started),
      truncated: state.truncated,
      warningCount: state.warningCount,
      ...state.stats
    },
    warnings: state.warnings
  };
}

async function resolveAllowedFetchPath(requestedPath, source, config) {
  if (!path.isAbsolute(requestedPath)) {
    throw new AgentDocError("FETCH_PATH_NOT_ABSOLUTE", "fetch requires the absolute path returned by search.");
  }
  if (isProtectedPath(requestedPath)) {
    throw new AgentDocError("FETCH_PATH_PROTECTED", "The requested path is blocked by the protected-path policy.");
  }

  let fileStat;
  let realPath;
  try {
    fileStat = await fs.lstat(requestedPath);
    realPath = await fs.realpath(requestedPath);
  } catch (error) {
    throw new AgentDocError("FETCH_FILE_NOT_FOUND", `Cannot read requested file: ${requestedPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new AgentDocError("FETCH_NOT_REGULAR_FILE", "fetch only reads regular non-link files.");
  }
  if (!config.followLinks && !samePath(path.resolve(requestedPath), realPath)) {
    throw new AgentDocError("FETCH_LINK_NOT_ALLOWED", "fetch does not follow symbolic links or junctions.");
  }

  for (const configuredFile of source.files) {
    try {
      if (samePath(realPath, await fs.realpath(configuredFile))) {
        return realPath;
      }
    } catch {
      // A missing configured file is reported by check/search; continue evaluating roots.
    }
  }

  const ignoreSpec = buildIgnoreSpec(config);
  for (const root of source.roots) {
    let realRoot;
    try {
      realRoot = await fs.realpath(root.path);
    } catch {
      continue;
    }
    if (!isWithin(realPath, realRoot)) {
      continue;
    }

    const relativePath = path.relative(realRoot, realPath);
    if (isIgnored(ignoreSpec, relativePath) || !matchesConfiguredDocument(realPath, source, config.caseSensitive)) {
      break;
    }
    return realPath;
  }

  throw new AgentDocError("FETCH_PATH_NOT_ALLOWED", "The requested file is outside the configured source or does not match its allowed file rules.", {
    source: source.name,
    path: requestedPath
  });
}

export async function fetchDocument({ path: requestedPath, source: sourceInput = undefined }, options = {}) {
  if (typeof requestedPath !== "string" || requestedPath.trim().length === 0) {
    throw new AgentDocError("FETCH_PATH_EMPTY", "fetch path is required.");
  }

  const config = await loadConfig(options.configPath);
  const source = getSource(config, sourceInput);
  const realPath = await resolveAllowedFetchPath(requestedPath.trim(), source, config);
  const fileStat = await fs.stat(realPath);
  if (fileStat.size > config.limits.maxFetchBytes) {
    throw new AgentDocError("FETCH_FILE_TOO_LARGE", "The requested file exceeds the configured fetch limit.", {
      path: realPath,
      sizeBytes: fileStat.size,
      maxFetchBytes: config.limits.maxFetchBytes
    });
  }

  const buffer = await fs.readFile(realPath);
  const decoded = decodeText(buffer);
  if (decoded.binary) {
    throw new AgentDocError("FETCH_BINARY_NOT_ALLOWED", "fetch only returns text files.");
  }

  return {
    schemaVersion: "1.0",
    ok: true,
    source: source.name,
    path: realPath,
    encoding: decoded.encoding,
    hasBom: decoded.hasBom,
    sizeBytes: buffer.length,
    lineCount: countLines(decoded.text),
    sha256: sha256(buffer),
    content: decoded.text
  };
}

export async function checkConfiguration(options = {}) {
  const config = await loadConfig(options.configPath);
  const sources = {};

  for (const [sourceName, source] of Object.entries(config.sources)) {
    const roots = [];
    for (const root of source.roots) {
      try {
        const rootStat = await fs.lstat(root.path);
        roots.push({
          name: root.name,
          path: root.path,
          priority: root.priority,
          available: rootStat.isDirectory() && !rootStat.isSymbolicLink(),
          type: rootStat.isSymbolicLink() ? "link" : rootStat.isDirectory() ? "directory" : "other"
        });
      } catch (error) {
        roots.push({
          name: root.name,
          path: root.path,
          priority: root.priority,
          available: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const files = [];
    for (const filePath of source.files) {
      try {
        const fileStat = await fs.lstat(filePath);
        files.push({
          path: filePath,
          available: fileStat.isFile() && !fileStat.isSymbolicLink(),
          type: fileStat.isSymbolicLink() ? "link" : fileStat.isFile() ? "file" : "other"
        });
      } catch (error) {
        files.push({ path: filePath, available: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    sources[sourceName] = {
      roots,
      extensions: source.extensions,
      fileNames: source.fileNames,
      files
    };
  }

  const toolDirectories = [];
  for (const directory of config.tools.directories) {
    try {
      const directoryStat = await fs.lstat(directory.path);
      toolDirectories.push({
        name: directory.name,
        path: directory.path,
        priority: directory.priority,
        recursive: directory.recursive,
        includeDocs: directory.includeDocs,
        available: directoryStat.isDirectory() && !directoryStat.isSymbolicLink(),
        type: directoryStat.isSymbolicLink() ? "link" : directoryStat.isDirectory() ? "directory" : "other"
      });
    } catch (error) {
      toolDirectories.push({
        name: directory.name,
        path: directory.path,
        priority: directory.priority,
        recursive: directory.recursive,
        includeDocs: directory.includeDocs,
        available: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const toolFiles = [];
  for (const file of config.tools.files) {
    try {
      const fileStat = await fs.lstat(file.path);
      toolFiles.push({
        name: file.name,
        path: file.path,
        priority: file.priority,
        available: fileStat.isFile() && !fileStat.isSymbolicLink(),
        type: fileStat.isSymbolicLink() ? "link" : fileStat.isFile() ? "file" : "other"
      });
    } catch (error) {
      toolFiles.push({
        name: file.name,
        path: file.path,
        priority: file.priority,
        available: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    schemaVersion: "1.0",
    ok: true,
    backend: "direct-scan",
    indexed: false,
    networkEnabled: false,
    configPath: config.configPath,
    ignoreFile: config.ignoreFile,
    defaultSource: config.defaultSource,
    followLinks: config.followLinks,
    limits: config.limits,
    sources,
    tools: {
      directories: toolDirectories,
      files: toolFiles,
      extensions: config.tools.extensions
    }
  };
}
