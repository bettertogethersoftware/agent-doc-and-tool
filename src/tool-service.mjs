import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import createIgnore from "ignore";

import { getExactToolFiles, isConfiguredSecretPath, loadConfig } from "./config.mjs";
import { AgentDocError } from "./errors.mjs";
import { canonicalize } from "./text.mjs";
import { toolMetadataFor } from "./tool-metadata.mjs";

const PROTECTED_DIRECTORY_NAMES = new Set([".aws", ".azure", ".gnupg", ".ssh"]);
const PROTECTED_FILE_NAMES = new Set([".env", "credentials.json", "id_dsa", "id_ed25519", "id_rsa", "known_hosts"]);
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

function portablePath(value) {
  return value.split(path.sep).join("/");
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

function ignored(ignoreSpec, relativePath, directory = false) {
  if (!relativePath) {
    return false;
  }
  return ignoreSpec.ignores(`${portablePath(relativePath)}${directory ? "/" : ""}`);
}

function createState(config) {
  const enabledDirectories = config.tools.directories.filter((directory) => directory.enabled).length;
  const exactToolFiles = getExactToolFiles(config);
  const enabledFiles = exactToolFiles.filter((file) => file.enabled).length;
  return {
    config,
    exactToolFiles,
    deadline: Date.now() + config.limits.timeoutMs,
    stopped: false,
    truncated: false,
    warningCount: 0,
    warnings: [],
    stats: {
      directoriesConfigured: config.tools.directories.length,
      directoriesEnabled: enabledDirectories,
      directoriesDisabled: config.tools.directories.length - enabledDirectories,
      exactFilesConfigured: exactToolFiles.length,
      exactFilesEnabled: enabledFiles,
      exactFilesDisabled: exactToolFiles.length - enabledFiles,
      directoriesScanned: 0,
      filesConsidered: 0,
      eligibleFiles: 0,
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
    addWarning(state, "TOOL_SEARCH_TIMEOUT", `Tool search exceeded ${state.config.limits.timeoutMs} ms.`);
    return true;
  }
  if (state.stats.filesConsidered >= state.config.limits.maxFiles) {
    state.stopped = true;
    state.truncated = true;
    addWarning(state, "TOOL_FILE_LIMIT_REACHED", `Tool search reached the configured ${state.config.limits.maxFiles} file limit.`);
    return true;
  }
  return false;
}

function matchesToolExtension(filePath, config) {
  const candidate = config.caseSensitive ? path.basename(filePath) : path.basename(filePath).toLowerCase();
  return config.tools.extensions.some((extension) => (
    candidate.endsWith(config.caseSensitive ? extension : extension.toLowerCase())
  ));
}

async function verifyToolFile(filePath, state, realRoot = undefined) {
  try {
    const fileStat = await fs.lstat(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      if (fileStat.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
      }
      return null;
    }
    const realPath = await fs.realpath(filePath);
    if (!state.config.followLinks && !samePath(path.resolve(filePath), realPath)) {
      state.stats.skippedLinks += 1;
      return null;
    }
    if (realRoot && !isWithin(realPath, realRoot)) {
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
    addWarning(state, "TOOL_FILE_UNAVAILABLE", error instanceof Error ? error.message : String(error), filePath);
    return null;
  }
}

async function resolveToolDirectory(directory, state) {
  try {
    const directoryStat = await fs.lstat(directory.path);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      if (directoryStat.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
      }
      addWarning(state, "TOOL_DIRECTORY_INVALID", "Configured tool path is not a regular directory.", directory.path);
      return null;
    }
    const realRoot = await fs.realpath(directory.path);
    if (!state.config.followLinks && !samePath(path.resolve(directory.path), realRoot)) {
      state.stats.skippedLinks += 1;
      addWarning(state, "TOOL_DIRECTORY_LINK_NOT_ALLOWED", "Configured tool directory resolves through a link or junction.", directory.path);
      return null;
    }
    return realRoot;
  } catch (error) {
    state.stats.unavailablePaths += 1;
    addWarning(state, "TOOL_DIRECTORY_UNAVAILABLE", error instanceof Error ? error.message : String(error), directory.path);
    return null;
  }
}

async function *enumerateToolDirectory(directory, state, seenPaths) {
  const realRoot = await resolveToolDirectory(directory, state);
  if (!realRoot) {
    return;
  }

  const ignoreSpec = buildIgnoreSpec(state.config);
  const pending = [{ fullPath: realRoot, relativePath: "" }];
  while (pending.length > 0 && !shouldStop(state)) {
    const current = pending.pop();
    let entries;
    try {
      entries = await fs.readdir(current.fullPath, { withFileTypes: true });
      state.stats.directoriesScanned += 1;
    } catch (error) {
      state.stats.permissionErrors += 1;
      addWarning(state, "TOOL_DIRECTORY_UNREADABLE", error instanceof Error ? error.message : String(error), current.fullPath);
      continue;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (shouldStop(state)) {
        return;
      }
      const entry = entries[index];
      const fullPath = path.join(current.fullPath, entry.name);
      const relativePath = current.relativePath ? path.join(current.relativePath, entry.name) : entry.name;

      if (entry.isSymbolicLink()) {
        state.stats.skippedLinks += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (!directory.recursive) {
          continue;
        }
        if (PROTECTED_DIRECTORY_NAMES.has(entry.name.toLowerCase()) || ignored(ignoreSpec, relativePath, true)) {
          state.stats.skippedIgnored += 1;
          continue;
        }
        pending.push({ fullPath, relativePath });
        continue;
      }
      if (!entry.isFile() || ignored(ignoreSpec, relativePath) || isProtectedPath(fullPath) || isConfiguredSecretPath(fullPath, state.config)) {
        if (entry.isFile()) {
          state.stats.skippedIgnored += 1;
        }
        continue;
      }

      state.stats.filesConsidered += 1;
      if (!matchesToolExtension(fullPath, state.config)) {
        continue;
      }
      const realPath = await verifyToolFile(fullPath, state, realRoot);
      if (!realPath) {
        continue;
      }
      const comparable = comparablePath(realPath);
      if (seenPaths.has(comparable)) {
        continue;
      }
      seenPaths.add(comparable);
      state.stats.eligibleFiles += 1;
      yield {
        name: path.basename(realPath),
        path: realPath,
        relativePath: portablePath(relativePath),
        source: "directory",
        sourceName: directory.name,
        priority: directory.priority,
        documentationSearchEnabled: directory.includeDocs
      };
    }
  }
}

function configuredExactToolCandidate(configuredFile) {
  return {
    name: configuredFile.name,
    path: configuredFile.path,
    relativePath: path.basename(configuredFile.path),
    source: "exact-file",
    sourceName: configuredFile.sourceDirectoryName ?? configuredFile.name,
    priority: configuredFile.priority,
    documentationSearchEnabled: configuredFile.documentationSearchEnabled === true
  };
}

async function verifyExactToolCandidate(candidate, state, seenPaths) {
  if (shouldStop(state)) {
    return null;
  }
  state.stats.filesConsidered += 1;
  const realPath = await verifyToolFile(candidate.path, state);
  if (!realPath) {
    return null;
  }
  const comparable = comparablePath(realPath);
  if (seenPaths.has(comparable)) {
    return null;
  }
  seenPaths.add(comparable);
  state.stats.eligibleFiles += 1;
  return {
    ...candidate,
    path: realPath,
    relativePath: path.basename(realPath)
  };
}

function normalizedToolText(value, caseSensitive) {
  const separated = value
    .normalize("NFKC")
    .replace(/([\p{L}])(\d)/gu, "$1 $2")
    .replace(/(\d)([\p{L}])/gu, "$1 $2");
  return canonicalize(separated, caseSensitive);
}

function createToolQueryPlan(query, caseSensitive) {
  const normalizedQuery = normalizedToolText(query.trim(), caseSensitive);
  if (!normalizedQuery) {
    throw new AgentDocError("TOOL_QUERY_EMPTY", "Tool query must contain letters or numbers.");
  }
  return { normalizedQuery, terms: [...new Set(normalizedQuery.split(" ").filter(Boolean))] };
}

function scoreCandidate(candidate, queryPlan, caseSensitive) {
  const extension = path.extname(candidate.path);
  const baseName = path.basename(candidate.path, extension);
  const normalizedName = normalizedToolText(candidate.name, caseSensitive);
  const normalizedBaseName = normalizedToolText(baseName, caseSensitive);
  const normalizedRelativePath = normalizedToolText(candidate.relativePath, caseSensitive);
  const normalizedSourceName = normalizedToolText(candidate.sourceName, caseSensitive);
  const searchable = [normalizedName, normalizedBaseName, normalizedRelativePath, normalizedSourceName].join(" ");
  const matchedTerms = queryPlan.terms.filter((term) => searchable.includes(term));
  if (matchedTerms.length === 0) {
    return null;
  }

  const allTermsMatched = matchedTerms.length === queryPlan.terms.length;
  let score = matchedTerms.length * 120;
  if (allTermsMatched) {
    score += 350;
  }
  if (normalizedBaseName === queryPlan.normalizedQuery || normalizedName === queryPlan.normalizedQuery) {
    score += 700;
  } else if (normalizedBaseName.includes(queryPlan.normalizedQuery) || normalizedName.includes(queryPlan.normalizedQuery)) {
    score += 400;
  } else if (searchable.includes(queryPlan.normalizedQuery)) {
    score += 220;
  }
  if (candidate.source === "exact-file") {
    score += 40;
  }

  return { score, matchedTerms, allTermsMatched };
}

function hasExactSavedMatch(candidate, queryPlan, caseSensitive) {
  const extension = path.extname(candidate.path);
  const baseName = path.basename(candidate.path, extension);
  return normalizedToolText(candidate.name, caseSensitive) === queryPlan.normalizedQuery
    || normalizedToolText(baseName, caseSensitive) === queryPlan.normalizedQuery;
}

function documentationEnabledFor(filePath, config) {
  const source = config.sources[config.defaultSource];
  const documentationRoots = [
    ...(source?.roots ?? []).filter((directory) => directory.enabled),
    ...config.tools.directories.filter((directory) => directory.enabled && directory.includeDocs)
  ];
  return documentationRoots.some((directory) => isWithin(path.resolve(filePath), path.resolve(directory.path)));
}

export async function findTools({ query, maxResults = undefined }, options = {}) {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new AgentDocError("TOOL_QUERY_EMPTY", "Tool query is required.");
  }
  if (query.length > 500) {
    throw new AgentDocError("TOOL_QUERY_TOO_LONG", "Tool query must be 500 characters or fewer.");
  }
  if (maxResults !== undefined && (!Number.isInteger(maxResults) || maxResults < 1)) {
    throw new AgentDocError("TOOL_RESULT_LIMIT_INVALID", "Tool result limit must be a positive integer.");
  }

  const started = performance.now();
  const config = await loadConfig(options.configPath);
  const queryPlan = createToolQueryPlan(query, config.caseSensitive);
  const resultLimit = Math.min(maxResults ?? config.limits.maxResults, config.limits.maxResults);
  const state = createState(config);
  const seenPaths = new Set();
  const matchingCandidates = [];
  const exactSavedMatches = [];
  const savedCandidateMatches = [];

  for (const configuredFile of state.exactToolFiles) {
    if (!configuredFile.enabled) {
      continue;
    }
    const configuredCandidate = configuredExactToolCandidate(configuredFile);
    const match = scoreCandidate(configuredCandidate, queryPlan, config.caseSensitive);
    if (!match) {
      continue;
    }
    savedCandidateMatches.push({
      candidate: configuredCandidate,
      match,
      exact: hasExactSavedMatch(configuredCandidate, queryPlan, config.caseSensitive)
    });
  }

  const candidatesToVerify = [
    ...savedCandidateMatches.filter((entry) => entry.exact),
    ...savedCandidateMatches.filter((entry) => !entry.exact)
  ];
  for (const savedCandidate of candidatesToVerify) {
    if (state.stopped) {
      break;
    }
    const candidate = await verifyExactToolCandidate(savedCandidate.candidate, state, seenPaths);
    if (!candidate) {
      continue;
    }
    const matchedCandidate = { candidate, match: savedCandidate.match };
    matchingCandidates.push(matchedCandidate);
    if (savedCandidate.exact) {
      exactSavedMatches.push(matchedCandidate);
    }
  }

  if (exactSavedMatches.length === 0 && !state.stopped) {
    for (const directory of config.tools.directories.filter((entry) => entry.enabled)) {
      if (state.stopped) {
        break;
      }
      for await (const candidate of enumerateToolDirectory(directory, state, seenPaths)) {
        const match = scoreCandidate(candidate, queryPlan, config.caseSensitive);
        if (match) {
          matchingCandidates.push({ candidate, match });
        }
      }
    }
  }

  const candidatesForResult = exactSavedMatches.length > 0 ? exactSavedMatches : matchingCandidates;
  const results = candidatesForResult.map(({ candidate, match }) => {
    const metadata = toolMetadataFor(candidate.path);
    return {
      name: candidate.name,
      path: candidate.path,
      workingDirectory: metadata.workingDirectory,
      verified: true,
      relativePath: candidate.relativePath,
      extension: metadata.extension,
      type: metadata.type,
      invocation: metadata.invocation,
      source: candidate.source,
      sourceName: candidate.sourceName,
      priority: candidate.priority,
      documentationSearchEnabled: candidate.documentationSearchEnabled || documentationEnabledFor(candidate.path, config),
      score: match.score,
      matchedTerms: match.matchedTerms,
      allTermsMatched: match.allTermsMatched
    };
  });

  results.sort((left, right) => (
    Number(right.allTermsMatched) - Number(left.allTermsMatched)
    || right.score - left.score
    || right.priority - left.priority
    || left.path.localeCompare(right.path)
  ));
  if (results.length > resultLimit) {
    state.truncated = true;
  }

  return {
    schemaVersion: "1.0",
    ok: true,
    query,
    queryPlan,
    results: results.slice(0, resultLimit),
    meta: {
      backend: "direct-scan",
      indexed: false,
      networkUsed: false,
      executed: false,
      configPath: config.configPath,
      elapsedMs: Math.round(performance.now() - started),
      truncated: state.truncated,
      warningCount: state.warningCount,
      ...state.stats
    },
    warnings: state.warnings
  };
}
