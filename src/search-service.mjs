import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";

import createIgnore from "ignore";

import {
  getSource,
  isConfiguredSecretPath,
  loadConfig,
  matchesConfiguredDocument,
  resolveDocumentSearchScope
} from "./config.mjs";
import { AgentDocError } from "./errors.mjs";
import { inspectConfiguredSecrets } from "./secret-service.mjs";
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

function isDisabledScannedDocumentForRoot(root, filePath) {
  return (root.excludedScannedDocumentPaths ?? []).some((excludedPath) => samePath(filePath, excludedPath));
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
      duplicateFilesOmitted: 0,
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

      if (
        isProtectedPath(fullPath)
        || isConfiguredSecretPath(fullPath, state.config)
        || isIgnored(ignoreSpec, relativePath)
        || isDisabledScannedDocumentForRoot(root, fullPath)
      ) {
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
        explicit: false,
        grant: {
          type: "directory",
          name: root.name
        }
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
    if (
      isProtectedPath(fullPath)
      || isConfiguredSecretPath(fullPath, state.config)
      || isIgnored(ignoreSpec, relativePath)
      || isDisabledScannedDocumentForRoot(root, fullPath)
    ) {
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
      explicit: false,
      grant: {
        type: "directory",
        name: root.name
      }
    };
  }
}

async function *specificFiles(source, state, seenPaths) {
  for (const configuredFile of source.files) {
    if (shouldStop(state)) {
      return;
    }
    const configuredPath = configuredFile.path;
    state.stats.filesConsidered += 1;
    if (isProtectedPath(configuredPath) || isConfiguredSecretPath(configuredPath, state.config)) {
      state.stats.skippedIgnored += 1;
      addWarning(state, "PROTECTED_FILE_SKIPPED", "Configured file is blocked by the protected-path policy.", configuredPath);
      continue;
    }

    try {
      const fileStat = await fs.lstat(configuredPath);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        state.stats.skippedLinks += 1;
        addWarning(state, "SPECIFIC_FILE_INVALID", "Configured file must be a regular non-link file.", configuredPath);
        continue;
      }
      const realPath = await fs.realpath(configuredPath);
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
        explicit: true,
        grant: {
          type: "file",
          name: configuredFile.name
        }
      };
    } catch (error) {
      addWarning(state, "SPECIFIC_FILE_UNAVAILABLE", error instanceof Error ? error.message : String(error), configuredPath);
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

function lineQualityScore(lineText) {
  const trimmed = lineText.trim();
  if (!trimmed) {
    return -100;
  }

  let score = 0;
  if (/^#{1,6}\s+\S/.test(trimmed)) {
    score += 80;
  } else if (/^[\p{L}\p{N}]/u.test(trimmed)) {
    score += 20;
  }
  if (trimmed.length >= 20 && trimmed.length <= 300) {
    score += 15;
  }
  if (/[.!?:]$/.test(trimmed)) {
    score += 5;
  }

  if (/<(?:img|svg|path|picture|source)\b/i.test(trimmed)) {
    score -= 140;
  }
  if (/img\.shields\.io/i.test(trimmed)) {
    score -= 80;
  }
  if (/(?:^|[^\p{L}])badge(?:[^\p{L}]|$)/iu.test(trimmed)) {
    score -= 40;
  }
  if (/!\[[^\]]*\]\([^)]*\)/u.test(trimmed)) {
    score -= 80;
  }
  const urlCount = (trimmed.match(/https?:\/\//gi) ?? []).length;
  score -= Math.min(urlCount * 20, 60);
  if (/^<[^>]+>.*<\/[^>]+>$/.test(trimmed)) {
    score -= 30;
  }

  return score;
}

function compareLineHits(left, right) {
  return right.lineScore - left.lineScore
    || right.baseScore - left.baseScore
    || right.matchedTerms.length - left.matchedTerms.length
    || right.qualityScore - left.qualityScore
    || left.lineNumber - right.lineNumber;
}

function compareSearchResults(left, right) {
  return right.score - left.score
    || left.path.localeCompare(right.path)
    || left.lineNumber - right.lineNumber;
}

function matchText(text, candidate, queryPlan, config) {
  const lines = splitLines(text);
  const hits = [];
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

    let matchType;
    let baseScore;
    if (normalizedLine.includes(queryPlan.normalizedQuery)) {
      matchType = "exact_phrase";
      baseScore = 1_000;
    } else if (matchedTerms.length === queryPlan.terms.length) {
      matchType = "all_terms_line";
      baseScore = 800;
    } else {
      matchType = "all_terms_file";
      baseScore = 600;
    }
    const qualityScore = lineQualityScore(lineText);
    hits.push({
      lineNumber: index + 1,
      lineText,
      matchedTerms,
      matchType,
      baseScore,
      qualityScore,
      lineScore: baseScore + (matchedTerms.length * 10) + qualityScore
    });
  }

  if (!queryPlan.terms.every((term) => fileTerms.has(term))) {
    return null;
  }

  const normalizedPath = canonicalize(candidate.relativePath, config.caseSensitive);
  const pathMatchedTerms = queryPlan.terms.filter((term) => normalizedPath.includes(term));
  const pathDepth = candidate.relativePath.split("/").filter(Boolean).length;
  const pathScore = (pathMatchedTerms.length * 30) - Math.min(pathDepth, 20);

  hits.sort(compareLineHits);
  const selected = hits.slice(0, config.limits.maxMatchesPerFile).map((hit) => {
    const preview = createLinePreview(hit.lineText, queryPlan, config);
    return {
      lineNumber: hit.lineNumber,
      ...preview,
      matchType: hit.matchType,
      matchedTerms: hit.matchedTerms
    };
  });
  const [primary, ...additionalMatches] = selected;
  const primaryHit = hits[0];

  return {
    path: candidate.path,
    ...primary,
    sourceRoot: candidate.root,
    grant: candidate.grant,
    relativePath: candidate.relativePath,
    pathMatchedTerms,
    fileMatchedTerms: queryPlan.terms.filter((term) => fileTerms.has(term)),
    matchCount: hits.length,
    returnedMatchCount: selected.length,
    additionalMatches,
    duplicateCount: 0,
    score: primaryHit.lineScore
      + candidate.priority
      + pathScore
  };
}

async function searchCandidate(candidate, queryPlan, state) {
  let fileStat;
  try {
    fileStat = await fs.lstat(candidate.path);
  } catch (error) {
    addWarning(state, "FILE_UNREADABLE", error instanceof Error ? error.message : String(error), candidate.path);
    return null;
  }

  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    state.stats.skippedLinks += 1;
    return null;
  }
  if (fileStat.size > state.config.limits.maxFileBytes) {
    state.stats.skippedOversize += 1;
    return null;
  }

  try {
    const buffer = await fs.readFile(candidate.path);
    const decoded = decodeText(buffer);
    if (decoded.binary) {
      state.stats.skippedBinary += 1;
      return null;
    }
    state.stats.filesRead += 1;
    const result = matchText(decoded.text, candidate, queryPlan, state.config);
    return result ? { ...result, _contentSha256: sha256(buffer) } : null;
  } catch (error) {
    state.stats.permissionErrors += 1;
    addWarning(state, "FILE_UNREADABLE", error instanceof Error ? error.message : String(error), candidate.path);
    return null;
  }
}

function collectMatchedFile(result, resultsByHash, state) {
  state.stats.filesMatched += 1;
  const existing = resultsByHash.get(result._contentSha256);
  if (!existing) {
    resultsByHash.set(result._contentSha256, result);
    return;
  }

  state.stats.duplicateFilesOmitted += 1;
  const duplicateCount = existing.duplicateCount + 1;
  if (compareSearchResults(result, existing) < 0) {
    result.duplicateCount = duplicateCount;
    resultsByHash.set(result._contentSha256, result);
  } else {
    existing.duplicateCount = duplicateCount;
  }
}

export async function searchDocuments({
  query,
  source: sourceInput = undefined,
  maxResults = undefined,
  directories = undefined,
  files = undefined
}, options = {}) {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new AgentDocError("QUERY_EMPTY", "Search query is required.");
  }
  if (query.length > 500) {
    throw new AgentDocError("QUERY_TOO_LONG", "Search query must be 500 characters or fewer.");
  }

  const started = performance.now();
  const config = await loadConfig(options.configPath);
  const { source, scope } = resolveDocumentSearchScope(config, {
    source: sourceInput,
    directories,
    files
  });
  const queryPlan = createQueryPlan(query, config.caseSensitive);
  const resultLimit = Math.min(maxResults ?? config.limits.maxResults, config.limits.maxResults);
  const state = createState(config);
  const seenPaths = new Set();
  const resultsByHash = new Map();

  for await (const candidate of specificFiles(source, state, seenPaths)) {
    const result = await searchCandidate(candidate, queryPlan, state);
    if (result) {
      collectMatchedFile(result, resultsByHash, state);
    }
  }

  for (const root of source.roots) {
    if (state.stopped) {
      break;
    }
    for await (const candidate of enumerateRoot(root, source, state, seenPaths)) {
      const result = await searchCandidate(candidate, queryPlan, state);
      if (result) {
        collectMatchedFile(result, resultsByHash, state);
      }
      if (resultsByHash.size >= resultLimit * 20) {
        state.truncated = true;
        state.stopped = true;
        addWarning(state, "MATCH_COLLECTION_LIMIT", "Search stopped after collecting enough unique matching files to rank.");
        break;
      }
    }
    if (state.stopped) {
      break;
    }
  }

  const results = [...resultsByHash.values()].sort(compareSearchResults);
  if (results.length > resultLimit) {
    state.truncated = true;
  }
  const returnedResults = results.slice(0, resultLimit).map(({ _contentSha256: _internalHash, ...result }) => result);

  return {
    schemaVersion: "1.0",
    ok: true,
    source: source.name,
    query,
    scope,
    queryPlan,
    results: returnedResults,
    meta: {
      backend: "direct-scan",
      resultUnit: "file",
      enumerationBackends: [...state.enumerationBackends],
      indexed: false,
      networkUsed: false,
      scopeMode: scope.mode,
      directoriesSelected: scope.directories.length,
      filesSelected: scope.files.length,
      configPath: config.configPath,
      elapsedMs: Math.round(performance.now() - started),
      truncated: state.truncated,
      warningCount: state.warningCount,
      uniqueFilesMatched: resultsByHash.size,
      snippetsPerFile: config.limits.maxMatchesPerFile,
      matchesReturned: returnedResults.reduce((total, result) => total + result.returnedMatchCount, 0),
      ...state.stats
    },
    warnings: state.warnings
  };
}

async function resolveAllowedFetchPath(requestedPath, source, config) {
  if (!path.isAbsolute(requestedPath)) {
    throw new AgentDocError("FETCH_PATH_NOT_ABSOLUTE", "fetch requires the absolute path returned by search.");
  }
  if (isProtectedPath(requestedPath) || isConfiguredSecretPath(requestedPath, config)) {
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
  if (isConfiguredSecretPath(realPath, config)) {
    throw new AgentDocError("FETCH_PATH_PROTECTED", "Configured secret files cannot be read with fetch.");
  }

  for (const configuredFile of source.files) {
    try {
      if (samePath(realPath, await fs.realpath(configuredFile.path))) {
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
    if (isDisabledScannedDocumentForRoot(root, realPath)) {
      continue;
    }
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
      if (!root.enabled) {
        roots.push({
          name: root.name,
          path: root.path,
          priority: root.priority,
          enabled: false,
          available: null,
          type: "disabled"
        });
        continue;
      }
      try {
        const rootStat = await fs.lstat(root.path);
        roots.push({
          name: root.name,
          path: root.path,
          priority: root.priority,
          enabled: true,
          available: rootStat.isDirectory() && !rootStat.isSymbolicLink(),
          type: rootStat.isSymbolicLink() ? "link" : rootStat.isDirectory() ? "directory" : "other"
        });
      } catch (error) {
        roots.push({
          name: root.name,
          path: root.path,
          priority: root.priority,
          enabled: true,
          available: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const files = [];
    for (const file of source.files) {
      if (!file.enabled) {
        files.push({ name: file.name, path: file.path, enabled: false, available: null, type: "disabled" });
        continue;
      }
      try {
        const fileStat = await fs.lstat(file.path);
        files.push({
          name: file.name,
          path: file.path,
          enabled: true,
          available: fileStat.isFile() && !fileStat.isSymbolicLink(),
          type: fileStat.isSymbolicLink() ? "link" : fileStat.isFile() ? "file" : "other"
        });
      } catch (error) {
        files.push({
          name: file.name,
          path: file.path,
          enabled: true,
          available: false,
          error: error instanceof Error ? error.message : String(error)
        });
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
    if (!directory.enabled) {
      toolDirectories.push({
        name: directory.name,
        path: directory.path,
        priority: directory.priority,
        recursive: directory.recursive,
        includeDocs: directory.includeDocs,
        enabled: false,
        available: null,
        type: "disabled"
      });
      continue;
    }
    try {
      const directoryStat = await fs.lstat(directory.path);
      toolDirectories.push({
        name: directory.name,
        path: directory.path,
        priority: directory.priority,
        recursive: directory.recursive,
        includeDocs: directory.includeDocs,
        enabled: true,
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
        enabled: true,
        available: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const toolFiles = [];
  for (const file of config.tools.files) {
    if (!file.enabled) {
      toolFiles.push({
        name: file.name,
        path: file.path,
        priority: file.priority,
        enabled: false,
        available: null,
        type: "disabled"
      });
      continue;
    }
    try {
      const fileStat = await fs.lstat(file.path);
      toolFiles.push({
        name: file.name,
        path: file.path,
        priority: file.priority,
        enabled: true,
        available: fileStat.isFile() && !fileStat.isSymbolicLink(),
        type: fileStat.isSymbolicLink() ? "link" : fileStat.isFile() ? "file" : "other"
      });
    } catch (error) {
      toolFiles.push({
        name: file.name,
        path: file.path,
        priority: file.priority,
        enabled: true,
        available: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const secrets = await inspectConfiguredSecrets(config);
  const prompts = {
    entries: config.prompts.map((prompt) => ({
      name: prompt.name,
      keywords: prompt.keywords,
      enabled: prompt.enabled,
      characterCount: prompt.content.length,
      lineCount: countLines(prompt.content)
    })),
    enabledCount: config.prompts.filter((prompt) => prompt.enabled).length,
    disabledCount: config.prompts.filter((prompt) => !prompt.enabled).length
  };

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
    },
    secrets,
    prompts
  };
}
