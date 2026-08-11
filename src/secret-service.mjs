import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { DEFAULT_SECRET_MAX_FILE_BYTES, loadConfig } from "./config.mjs";
import { AgentDocError } from "./errors.mjs";
import { canonicalize, createQueryPlan, decodeText } from "./text.mjs";

const MAX_KEYS_PER_READ = 50;

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function samePath(left, right) {
  return comparablePath(left) === comparablePath(right);
}

function stripOneTerminalLineBreak(value) {
  return value.replace(/(?:\r\n|\n|\r)$/, "");
}

function parseQuotedValue(rawValue, quote, lineNumber) {
  let closingIndex = -1;
  for (let index = 1; index < rawValue.length; index += 1) {
    if (rawValue[index] !== quote) {
      continue;
    }
    if (quote === "'") {
      closingIndex = index;
      break;
    }
    let backslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && rawValue[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) {
      closingIndex = index;
      break;
    }
  }
  if (closingIndex < 1) {
    throw new AgentDocError("SECRET_ENV_QUOTE_UNTERMINATED", `Secret key/value line ${lineNumber} has an unterminated quote.`, {
      lineNumber
    });
  }

  const trailing = rawValue.slice(closingIndex + 1).trim();
  if (trailing && !trailing.startsWith("#")) {
    throw new AgentDocError("SECRET_ENV_TRAILING_TEXT", `Secret key/value line ${lineNumber} has unexpected text after its quoted value.`, {
      lineNumber
    });
  }

  const inner = rawValue.slice(1, closingIndex);
  if (quote === "'") {
    return inner;
  }
  return inner.replace(/\\(n|r|t|"|\\)/g, (_match, escaped) => ({
    n: "\n",
    r: "\r",
    t: "\t",
    '"': '"',
    "\\": "\\"
  })[escaped]);
}

function parseEnvAssignment(rawLine, lineNumber) {
  let line = rawLine.trim();
  if (!line || line.startsWith("#")) {
    return null;
  }
  if (line.startsWith("export ")) {
    line = line.slice(7).trimStart();
  }

  const match = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/s.exec(line);
  if (!match) {
    throw new AgentDocError("SECRET_ENV_LINE_INVALID", `Secret key/value line ${lineNumber} must use NAME=value syntax.`, {
      lineNumber
    });
  }

  const key = match[1];
  const rawValue = match[2].trim();
  let value;
  if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
    value = parseQuotedValue(rawValue, rawValue[0], lineNumber);
  } else {
    value = rawValue.replace(/\s+#.*$/, "").trimEnd();
  }
  return { key, value };
}

function parseEnvText(text, { strict }) {
  const entries = [];
  const seen = new Set();
  const lines = text.split(/\r\n|\n|\r/);

  for (const [index, line] of lines.entries()) {
    let assignment;
    try {
      assignment = parseEnvAssignment(line, index + 1);
    } catch (error) {
      if (!strict) {
        return null;
      }
      throw error;
    }
    if (!assignment) {
      continue;
    }
    if (seen.has(assignment.key)) {
      throw new AgentDocError("SECRET_ENV_KEY_DUPLICATE", `Secret key/value file defines '${assignment.key}' more than once.`, {
        key: assignment.key
      });
    }
    seen.add(assignment.key);
    entries.push(assignment);
  }

  if (entries.length === 0) {
    if (!strict) {
      return null;
    }
    throw new AgentDocError("SECRET_ENV_EMPTY", "Secret key/value file does not contain any NAME=value entries.");
  }

  return { format: "env", entries };
}

function looksLikeEnvFile(fileName) {
  const normalized = fileName.toLowerCase();
  return normalized === ".env" || normalized.startsWith(".env.") || normalized.endsWith(".env");
}

export function parseSecretText(text, { format = "auto", fileName = "secret" } = {}) {
  if (!["auto", "env", "opaque"].includes(format)) {
    throw new AgentDocError("SECRET_FORMAT_INVALID", "Secret format must be auto, env, or opaque.");
  }

  if (format === "env") {
    return parseEnvText(text, { strict: true });
  }
  if (format === "auto") {
    const detected = parseEnvText(text, { strict: false });
    if (detected) {
      return detected;
    }
    if (looksLikeEnvFile(fileName)) {
      return parseEnvText(text, { strict: true });
    }
  }

  const value = stripOneTerminalLineBreak(text);
  if (!value.trim()) {
    throw new AgentDocError("SECRET_OPAQUE_EMPTY", "Opaque secret file is empty.");
  }
  return { format: "opaque", value };
}

function metadataFor(entry, realPath, parsed, sizeBytes) {
  return {
    name: entry.name,
    fileName: path.basename(realPath),
    path: realPath,
    configuredFormat: entry.format,
    enabled: true,
    format: parsed.format,
    fields: parsed.format === "env" ? parsed.entries.map((item) => item.key) : [],
    valueKind: parsed.format === "env" ? "key-value" : "opaque",
    sizeBytes,
    available: true,
    searchable: false
  };
}

async function readConfiguredSecret(entry, maxFileBytes = DEFAULT_SECRET_MAX_FILE_BYTES) {
  if (!path.isAbsolute(entry.path)) {
    throw new AgentDocError("SECRET_PATH_NOT_ABSOLUTE", "Secret files must use an absolute path.", { path: entry.path });
  }

  let fileStat;
  let realPath;
  try {
    fileStat = await fs.lstat(entry.path);
    realPath = await fs.realpath(entry.path);
  } catch (error) {
    throw new AgentDocError("SECRET_FILE_UNAVAILABLE", `Cannot read configured secret file: ${entry.path}`, {
      path: entry.path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new AgentDocError("SECRET_FILE_INVALID", "A secret grant must point to one regular non-link file.", { path: entry.path });
  }
  if (!samePath(entry.path, realPath)) {
    throw new AgentDocError("SECRET_LINK_NOT_ALLOWED", "Secret files cannot resolve through a symbolic link or junction.", { path: entry.path });
  }
  if (fileStat.size > maxFileBytes) {
    throw new AgentDocError("SECRET_FILE_TOO_LARGE", "Secret file exceeds the configured size limit.", {
      path: realPath,
      sizeBytes: fileStat.size,
      maxFileBytes
    });
  }

  const buffer = await fs.readFile(realPath);
  const decoded = decodeText(buffer);
  if (decoded.binary) {
    throw new AgentDocError("SECRET_BINARY_NOT_ALLOWED", "Secret files must contain text, not binary data.", { path: realPath });
  }

  const parsed = parseSecretText(decoded.text, { format: entry.format, fileName: path.basename(realPath) });
  return {
    metadata: metadataFor(entry, realPath, parsed, buffer.length),
    parsed
  };
}

export async function inspectSecretPath({ name, path: filePath, format = "auto" }, options = {}) {
  const normalizedName = typeof name === "string" && name.trim() ? name.trim() : path.basename(filePath || "") || "secret";
  const entry = {
    name: normalizedName,
    path: typeof filePath === "string" ? path.resolve(filePath.trim()) : "",
    format,
    enabled: true
  };
  const result = await readConfiguredSecret(entry, options.maxFileBytes ?? DEFAULT_SECRET_MAX_FILE_BYTES);
  return {
    schemaVersion: "1.0",
    ok: true,
    secret: result.metadata,
    sensitiveValuesReturned: false
  };
}

export async function inspectConfiguredSecrets(config) {
  const files = [];
  for (const entry of config.secrets.files) {
    if (!entry.enabled) {
      files.push({
        name: entry.name,
        fileName: path.basename(entry.path),
        path: entry.path,
        configuredFormat: entry.format,
        enabled: false,
        available: null,
        searchable: false,
        fields: [],
        type: "disabled"
      });
      continue;
    }
    try {
      const result = await readConfiguredSecret(entry, config.secrets.maxFileBytes);
      files.push(result.metadata);
    } catch (error) {
      files.push({
        name: entry.name,
        fileName: path.basename(entry.path),
        path: entry.path,
        configuredFormat: entry.format,
        enabled: true,
        available: false,
        searchable: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return {
    files,
    maxFileBytes: config.secrets.maxFileBytes
  };
}

function scoreSecret(metadata, queryPlan, caseSensitive) {
  const name = canonicalize(metadata.name, caseSensitive);
  const fileName = canonicalize(metadata.fileName, caseSensitive);
  const filePath = canonicalize(metadata.path, caseSensitive);
  const fields = metadata.fields.map((field) => canonicalize(field, caseSensitive));
  const haystacks = [name, fileName, filePath, ...fields];
  const matchedTerms = queryPlan.terms.filter((term) => haystacks.some((candidate) => candidate.includes(term)));
  if (matchedTerms.length === 0) {
    return null;
  }

  const allTermsMatched = matchedTerms.length === queryPlan.terms.length;
  const exactName = name === queryPlan.normalizedQuery;
  const exactFileName = fileName === queryPlan.normalizedQuery;
  const exactField = fields.includes(queryPlan.normalizedQuery);
  return {
    score: (exactName ? 1_000 : 0)
      + (exactFileName ? 800 : 0)
      + (exactField ? 500 : 0)
      + (allTermsMatched ? 200 : 0)
      + (matchedTerms.length * 10),
    matchedTerms,
    allTermsMatched
  };
}

export async function findSecrets({ query, maxResults = undefined }, options = {}) {
  if (typeof query !== "string" || !query.trim()) {
    throw new AgentDocError("SECRET_QUERY_EMPTY", "Secret query is required.");
  }
  if (query.length > 500) {
    throw new AgentDocError("SECRET_QUERY_TOO_LONG", "Secret query must be 500 characters or fewer.");
  }
  if (maxResults !== undefined && (!Number.isInteger(maxResults) || maxResults < 1)) {
    throw new AgentDocError("SECRET_RESULT_LIMIT_INVALID", "Secret result limit must be a positive integer.");
  }

  const started = performance.now();
  const config = await loadConfig(options.configPath);
  const queryPlan = createQueryPlan(query, config.caseSensitive);
  const resultLimit = Math.min(maxResults ?? config.limits.maxResults, config.limits.maxResults);
  const results = [];
  const warnings = [];

  for (const entry of config.secrets.files.filter((candidate) => candidate.enabled)) {
    try {
      const inspected = await readConfiguredSecret(entry, config.secrets.maxFileBytes);
      const match = scoreSecret(inspected.metadata, queryPlan, config.caseSensitive);
      if (match) {
        results.push({ ...inspected.metadata, ...match });
      }
    } catch (error) {
      warnings.push({
        code: error?.code ?? "SECRET_FILE_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error),
        name: entry.name,
        path: entry.path
      });
    }
  }

  results.sort((left, right) => (
    Number(right.allTermsMatched) - Number(left.allTermsMatched)
    || right.score - left.score
    || left.name.localeCompare(right.name)
  ));

  return {
    schemaVersion: "1.0",
    ok: true,
    query,
    queryPlan,
    results: results.slice(0, resultLimit),
    meta: {
      backend: "exact-file",
      indexed: false,
      networkUsed: false,
      configPath: config.configPath,
      elapsedMs: Math.round(performance.now() - started),
      secretFilesConfigured: config.secrets.files.length,
      secretFilesEnabled: config.secrets.files.filter((entry) => entry.enabled).length,
      secretFilesDisabled: config.secrets.files.filter((entry) => !entry.enabled).length,
      warningCount: warnings.length,
      truncated: results.length > resultLimit,
      sensitiveValuesReturned: false
    },
    warnings
  };
}

function resolveRequestedKeys(entries, keysInput) {
  const availableKeys = entries.map((entry) => entry.key);
  const requestedKeys = keysInput === undefined ? [] : keysInput;
  if (!Array.isArray(requestedKeys) || requestedKeys.some((key) => typeof key !== "string" || !key.trim())) {
    throw new AgentDocError("SECRET_KEYS_INVALID", "Secret keys must be a non-empty string array when provided.");
  }
  if (requestedKeys.length > MAX_KEYS_PER_READ) {
    throw new AgentDocError("SECRET_KEYS_LIMIT", `At most ${MAX_KEYS_PER_READ} secret keys can be read in one call.`);
  }
  if (requestedKeys.length === 0) {
    if (entries.length === 1) {
      return [entries[0]];
    }
    throw new AgentDocError("SECRET_KEYS_REQUIRED", "Choose the exact secret fields to read.", { availableKeys });
  }

  const resolved = [];
  const seen = new Set();
  for (const requestedKey of requestedKeys) {
    const trimmed = requestedKey.trim();
    const exact = entries.find((entry) => entry.key === trimmed);
    const caseInsensitive = entries.filter((entry) => entry.key.toLowerCase() === trimmed.toLowerCase());
    const match = exact ?? (caseInsensitive.length === 1 ? caseInsensitive[0] : null);
    if (!match) {
      throw new AgentDocError("SECRET_KEY_NOT_FOUND", `Secret field '${trimmed}' is not available.`, { availableKeys });
    }
    if (!seen.has(match.key)) {
      seen.add(match.key);
      resolved.push(match);
    }
  }
  return resolved;
}

export async function readSecret({ secret, keys = undefined }, options = {}) {
  if (typeof secret !== "string" || !secret.trim()) {
    throw new AgentDocError("SECRET_NAME_EMPTY", "Configured secret name is required.");
  }

  const config = await loadConfig(options.configPath);
  const requestedName = secret.trim();
  const entry = config.secrets.files.find((candidate) => candidate.name === requestedName)
    ?? config.secrets.files.find((candidate) => candidate.name.toLowerCase() === requestedName.toLowerCase());
  if (!entry) {
    throw new AgentDocError("SECRET_NOT_CONFIGURED", `Secret '${requestedName}' is not configured.`, {
      availableNames: config.secrets.files.filter((candidate) => candidate.enabled).map((candidate) => candidate.name)
    });
  }
  if (!entry.enabled) {
    throw new AgentDocError("SECRET_DISABLED", `Secret '${entry.name}' is disabled in the local configuration.`);
  }

  const inspected = await readConfiguredSecret(entry, config.secrets.maxFileBytes);
  const base = {
    schemaVersion: "1.0",
    ok: true,
    sensitive: true,
    searchable: false,
    name: entry.name,
    fileName: inspected.metadata.fileName,
    path: inspected.metadata.path,
    format: inspected.parsed.format,
    meta: {
      localRead: true,
      networkUsed: false,
      persistedByServer: false
    }
  };

  if (inspected.parsed.format === "opaque") {
    if (Array.isArray(keys) && keys.length > 0) {
      throw new AgentDocError("SECRET_KEYS_NOT_APPLICABLE", "Opaque secret files do not have named fields.");
    }
    return { ...base, value: inspected.parsed.value };
  }

  const selected = resolveRequestedKeys(inspected.parsed.entries, keys);
  return {
    ...base,
    values: Object.fromEntries(selected.map((entry_) => [entry_.key, entry_.value]))
  };
}
