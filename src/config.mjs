import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { AgentDocError } from "./errors.mjs";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SOURCE_DIRECTORY, "..");
export const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, "config", "search.config.json");

const DEFAULT_LIMITS = {
  maxResults: 50,
  maxMatchesPerFile: 1,
  maxLineChars: 1_000,
  maxFileBytes: 2_000_000,
  maxFetchBytes: 4_000_000,
  maxFiles: 50_000,
  timeoutMs: 15_000
};

export const DEFAULT_TOOL_EXTENSIONS = [".exe", ".com", ".cmd", ".bat", ".ps1", ".py", ".js", ".mjs", ".cjs"];
export const DEFAULT_SECRET_MAX_FILE_BYTES = 256_000;
export const MAX_PROMPT_NAME_CHARS = 200;
export const MAX_PROMPT_CONTENT_CHARS = 200_000;
export const MAX_PROMPT_TOTAL_CHARS = 5_000_000;
export const MAX_SEARCH_SCOPE_GRANTS = 500;
const MAX_PROMPT_KEYWORDS = 100;
const MAX_PROMPT_KEYWORD_CHARS = 200;

const RootEntrySchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1),
    priority: z.number().int().min(-10_000).max(10_000).default(0),
    enabled: z.boolean().default(true)
  }).strict()
]);

const DocumentFileEntrySchema = z.object({
  name: z.string().trim().min(1),
  path: z.string().trim().min(1),
  enabled: z.boolean().default(true)
}).strict();

const ScannedToolFileEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  path: z.string().trim().min(1),
  priority: z.number().int().min(-10_000).max(10_000).default(0),
  enabled: z.boolean().default(true)
}).strict();

const ScannedDocumentFileEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  path: z.string().trim().min(1),
  enabled: z.boolean().default(true)
}).strict();

const ExtensionListSchema = z.union([
  z.string().trim().min(1),
  z.array(z.string().trim().min(1))
]);

const SourceSchema = z.object({
  roots: z.array(RootEntrySchema).default([]),
  extensions: ExtensionListSchema.default([".ai.md"]),
  fileNames: z.array(z.string().trim().min(1)).default(["README.md"]),
  files: z.array(DocumentFileEntrySchema).default([])
}).strict();

const ToolDirectoryEntrySchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1),
    priority: z.number().int().min(-10_000).max(10_000).default(0),
    recursive: z.boolean().default(true),
    includeDocs: z.boolean().default(true),
    enabled: z.boolean().default(true),
    humanNote: z.string().max(5_000).default(""),
    scannedToolFiles: z.array(ScannedToolFileEntrySchema).max(100).default([]),
    scannedDocumentFiles: z.array(ScannedDocumentFileEntrySchema).max(100).default([])
  }).strict()
]);

const ToolFileEntrySchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1),
    priority: z.number().int().min(-10_000).max(10_000).default(0),
    enabled: z.boolean().default(true)
  }).strict()
]);

const ToolsSchema = z.object({
  directories: z.array(ToolDirectoryEntrySchema).default([]),
  files: z.array(ToolFileEntrySchema).default([]),
  extensions: ExtensionListSchema.default(DEFAULT_TOOL_EXTENSIONS)
}).strict().default({
  directories: [],
  files: [],
  extensions: DEFAULT_TOOL_EXTENSIONS
});

const SecretFileEntrySchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1),
    format: z.enum(["auto", "env", "opaque"]).default("auto"),
    enabled: z.boolean().default(true)
  }).strict()
]);

const SecretsSchema = z.object({
  files: z.array(SecretFileEntrySchema).default([]),
  maxFileBytes: z.number().int().min(1).max(1_000_000).default(DEFAULT_SECRET_MAX_FILE_BYTES)
}).strict().default({
  files: [],
  maxFileBytes: DEFAULT_SECRET_MAX_FILE_BYTES
});

const PromptEntrySchema = z.object({
  name: z.string().trim().min(1).max(MAX_PROMPT_NAME_CHARS),
  keywords: z.union([
    z.string().max(10_000),
    z.array(z.string().trim().min(1).max(MAX_PROMPT_KEYWORD_CHARS)).max(MAX_PROMPT_KEYWORDS)
  ]).default([]),
  content: z.string().max(MAX_PROMPT_CONTENT_CHARS),
  enabled: z.boolean().default(true)
}).strict();

const PromptsSchema = z.array(PromptEntrySchema).max(500).default([]);

const LimitsSchema = z.object({
  maxResults: z.number().int().min(1).max(500).default(DEFAULT_LIMITS.maxResults),
  maxMatchesPerFile: z.number().int().min(1).max(20).default(DEFAULT_LIMITS.maxMatchesPerFile),
  maxLineChars: z.number().int().min(100).max(20_000).default(DEFAULT_LIMITS.maxLineChars),
  maxFileBytes: z.number().int().min(1_024).max(100_000_000).default(DEFAULT_LIMITS.maxFileBytes),
  maxFetchBytes: z.number().int().min(1_024).max(100_000_000).default(DEFAULT_LIMITS.maxFetchBytes),
  maxFiles: z.number().int().min(1).max(1_000_000).default(DEFAULT_LIMITS.maxFiles),
  timeoutMs: z.number().int().min(100).max(120_000).default(DEFAULT_LIMITS.timeoutMs)
}).strict().default(DEFAULT_LIMITS);

const ConfigSchema = z.object({
  version: z.literal(1),
  defaultSource: z.string().trim().min(1).default("local"),
  sources: z.record(z.string().trim().min(1), SourceSchema),
  ignoreFile: z.string().trim().min(1).optional(),
  ignore: z.array(z.string()).default([]),
  caseSensitive: z.boolean().default(false),
  followLinks: z.literal(false).default(false),
  tools: ToolsSchema,
  secrets: SecretsSchema,
  prompts: PromptsSchema,
  limits: LimitsSchema
}).strict();

function lookupEnvironmentVariable(name) {
  if (process.platform !== "win32") {
    return process.env[name];
  }

  const actualName = Object.keys(process.env).find((key) => key.toLowerCase() === name.toLowerCase());
  return actualName ? process.env[actualName] : undefined;
}

export function expandPathVariables(value) {
  let expanded = value.trim();

  expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name) => {
    const replacement = lookupEnvironmentVariable(name);
    if (replacement === undefined) {
      throw new AgentDocError("CONFIG_ENV_MISSING", `Environment variable ${name} is not defined.`);
    }
    return replacement;
  });

  expanded = expanded.replace(/%([^%]+)%/g, (_match, name) => {
    const replacement = lookupEnvironmentVariable(name);
    if (replacement === undefined) {
      throw new AgentDocError("CONFIG_ENV_MISSING", `Environment variable ${name} is not defined.`);
    }
    return replacement;
  });

  if (expanded === "~") {
    return os.homedir();
  }
  if (expanded.startsWith(`~${path.sep}`) || expanded.startsWith("~/") || expanded.startsWith("~\\")) {
    return path.join(os.homedir(), expanded.slice(2));
  }

  return expanded;
}

export function resolveConfiguredPath(value, configDirectory) {
  const expanded = expandPathVariables(value);
  return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(configDirectory, expanded));
}

function normalizeExtensionPattern(pattern) {
  let normalized = pattern.trim().replaceAll("\\", "/");

  if (normalized.startsWith("**/")) {
    normalized = normalized.slice(3);
  }
  normalized = normalized.replace(/^\*+/, "");

  if (!normalized || normalized === ".") {
    throw new AgentDocError("CONFIG_EXTENSION_INVALID", `Extension pattern '${pattern}' does not name a suffix.`);
  }
  if (/[/*?\[\]{}]/.test(normalized)) {
    throw new AgentDocError(
      "CONFIG_EXTENSION_INVALID",
      `Extension pattern '${pattern}' is not a supported suffix pattern. Use values such as .json, *.json, **.json, or **/*.json.`
    );
  }

  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

export function normalizeExtensionPatterns(value) {
  const configured = typeof value === "string" ? [value] : value;
  const patterns = configured
    .flatMap((entry) => entry.split(";"))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeExtensionPattern);

  if (patterns.length === 0 && typeof value === "string") {
    throw new AgentDocError("CONFIG_EXTENSION_INVALID", "At least one extension pattern is required.");
  }

  return [...new Set(patterns)];
}

function normalizeSource(name, rawSource, configDirectory) {
  const rootNames = new Set();
  const roots = rawSource.roots.map((entry, index) => {
    const root = typeof entry === "string" ? { path: entry, priority: 0 } : entry;
    const rootName = root.name ?? `${name}-root-${index + 1}`;
    const comparableName = rootName.toLowerCase();
    if (rootNames.has(comparableName)) {
      throw new AgentDocError(
        "CONFIG_DOCUMENT_DIRECTORY_NAME_DUPLICATE",
        `Document directory name '${rootName}' is configured more than once in source '${name}'.`
      );
    }
    rootNames.add(comparableName);
    return {
      name: rootName,
      path: resolveConfiguredPath(root.path, configDirectory),
      priority: root.priority ?? 0,
      enabled: root.enabled !== false
    };
  }).sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

  const files = [];
  const fileNames = new Set();
  const filePaths = new Set();
  for (const file of rawSource.files) {
    const resolvedPath = resolveConfiguredPath(file.path, configDirectory);
    const comparableName = file.name.toLowerCase();
    const comparablePath = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
    if (fileNames.has(comparableName)) {
      throw new AgentDocError(
        "CONFIG_DOCUMENT_FILE_NAME_DUPLICATE",
        `Exact document file name '${file.name}' is configured more than once in source '${name}'.`
      );
    }
    if (filePaths.has(comparablePath)) {
      throw new AgentDocError(
        "CONFIG_DOCUMENT_FILE_PATH_DUPLICATE",
        `Exact document file path is configured more than once in source '${name}': ${resolvedPath}`
      );
    }
    fileNames.add(comparableName);
    filePaths.add(comparablePath);
    files.push({ name: file.name, path: resolvedPath, enabled: file.enabled !== false });
  }

  return {
    name,
    roots,
    extensions: normalizeExtensionPatterns(rawSource.extensions),
    fileNames: [...new Set(rawSource.fileNames.map((fileName) => fileName.trim()))],
    files
  };
}

function normalizeTools(rawTools, configDirectory) {
  const directoryNames = new Set();
  const directories = rawTools.directories.map((entry, index) => {
    const directory = typeof entry === "string"
      ? { path: entry, priority: 0, recursive: true, includeDocs: true }
      : entry;
    const name = directory.name ?? `tool-directory-${index + 1}`;
    const comparableName = name.toLowerCase();
    if (directoryNames.has(comparableName)) {
      throw new AgentDocError(
        "CONFIG_TOOL_DIRECTORY_NAME_DUPLICATE",
        `Tool directory name '${name}' is configured more than once.`
      );
    }
    directoryNames.add(comparableName);
    return {
      name,
      path: resolveConfiguredPath(directory.path, configDirectory),
      priority: directory.priority ?? 0,
      recursive: directory.recursive !== false,
      includeDocs: directory.includeDocs !== false,
      enabled: directory.enabled !== false,
      humanNote: directory.humanNote?.trim() ?? "",
      scannedToolFiles: (directory.scannedToolFiles ?? []).map((file) => ({
        name: file.name,
        path: resolveConfiguredPath(file.path, configDirectory),
        priority: file.priority ?? 0,
        enabled: file.enabled !== false
      })),
      scannedDocumentFiles: (directory.scannedDocumentFiles ?? []).map((file) => ({
        name: file.name,
        path: resolveConfiguredPath(file.path, configDirectory),
        enabled: file.enabled !== false
      }))
    };
  }).sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

  const files = rawTools.files.map((entry, index) => {
    const file = typeof entry === "string" ? { path: entry, priority: 0 } : entry;
    const resolvedPath = resolveConfiguredPath(file.path, configDirectory);
    return {
      name: file.name ?? (path.basename(resolvedPath) || `tool-file-${index + 1}`),
      path: resolvedPath,
      priority: file.priority ?? 0,
      enabled: file.enabled !== false
    };
  }).sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

  const toolNames = new Set();
  for (const file of [...files, ...directories.flatMap((directory) => directory.scannedToolFiles)]) {
    const comparableName = file.name.toLowerCase();
    if (toolNames.has(comparableName)) {
      throw new AgentDocError(
        "CONFIG_TOOL_FILE_NAME_DUPLICATE",
        `Tool file name or alias '${file.name}' is configured more than once.`
      );
    }
    toolNames.add(comparableName);
  }

  return {
    directories,
    files,
    extensions: normalizeExtensionPatterns(rawTools.extensions)
  };
}

function normalizeSecrets(rawSecrets, configDirectory) {
  const names = new Set();
  const paths = new Set();
  const files = rawSecrets.files.map((entry, index) => {
    const file = typeof entry === "string" ? { path: entry, format: "auto" } : entry;
    const resolvedPath = resolveConfiguredPath(file.path, configDirectory);
    const name = file.name ?? (path.basename(resolvedPath) || `secret-file-${index + 1}`);
    const comparableName = name.toLowerCase();
    const comparablePath = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;

    if (names.has(comparableName)) {
      throw new AgentDocError("CONFIG_SECRET_NAME_DUPLICATE", `Secret name '${name}' is configured more than once.`);
    }
    if (paths.has(comparablePath)) {
      throw new AgentDocError("CONFIG_SECRET_PATH_DUPLICATE", `Secret file is configured more than once: ${resolvedPath}`);
    }
    names.add(comparableName);
    paths.add(comparablePath);

    return {
      name,
      path: resolvedPath,
      format: file.format ?? "auto",
      enabled: file.enabled !== false
    };
  }).sort((left, right) => left.name.localeCompare(right.name));

  return {
    files,
    maxFileBytes: rawSecrets.maxFileBytes
  };
}

function normalizePromptKeywords(value, promptName) {
  const configured = typeof value === "string" ? [value] : value;
  const keywords = configured
    .flatMap((entry) => entry.split(/[;,\n]/))
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (keywords.length > MAX_PROMPT_KEYWORDS) {
    throw new AgentDocError(
      "CONFIG_PROMPT_KEYWORDS_LIMIT",
      `Prompt '${promptName}' has ${keywords.length} keywords; the limit is ${MAX_PROMPT_KEYWORDS}.`
    );
  }
  const tooLong = keywords.find((keyword) => keyword.length > MAX_PROMPT_KEYWORD_CHARS);
  if (tooLong) {
    throw new AgentDocError(
      "CONFIG_PROMPT_KEYWORD_TOO_LONG",
      `Prompt '${promptName}' has a keyword longer than ${MAX_PROMPT_KEYWORD_CHARS} characters.`
    );
  }

  const seen = new Set();
  return keywords.filter((keyword) => {
    const comparable = keyword.toLowerCase();
    if (seen.has(comparable)) {
      return false;
    }
    seen.add(comparable);
    return true;
  });
}

function normalizePrompts(rawPrompts) {
  const names = new Set();
  let totalCharacters = 0;
  const prompts = rawPrompts.map((prompt) => {
    const name = prompt.name.trim();
    const comparableName = name.toLowerCase();
    if (names.has(comparableName)) {
      throw new AgentDocError("CONFIG_PROMPT_NAME_DUPLICATE", `Prompt name or alias '${name}' is configured more than once.`);
    }
    if (!prompt.content.trim()) {
      throw new AgentDocError("CONFIG_PROMPT_CONTENT_EMPTY", `Prompt '${name}' must contain text.`);
    }
    names.add(comparableName);
    totalCharacters += prompt.content.length;
    return {
      name,
      keywords: normalizePromptKeywords(prompt.keywords, name),
      content: prompt.content,
      enabled: prompt.enabled !== false
    };
  });

  if (totalCharacters > MAX_PROMPT_TOTAL_CHARS) {
    throw new AgentDocError(
      "CONFIG_PROMPT_TOTAL_TOO_LARGE",
      `Reusable prompts contain ${totalCharacters} characters; the combined limit is ${MAX_PROMPT_TOTAL_CHARS}.`
    );
  }
  return prompts;
}

export async function parseConfig(rawConfig, configPathInput = DEFAULT_CONFIG_PATH) {
  const configPath = path.resolve(expandPathVariables(configPathInput));
  const parsed = ConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new AgentDocError("CONFIG_SCHEMA_INVALID", `Search configuration does not match schema version 1: ${configPath}`, {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  const configDirectory = path.dirname(configPath);
  if (!Object.hasOwn(parsed.data.sources, parsed.data.defaultSource)) {
    throw new AgentDocError("CONFIG_DEFAULT_SOURCE_MISSING", `Default source '${parsed.data.defaultSource}' is not defined.`);
  }

  const sources = Object.fromEntries(Object.entries(parsed.data.sources).map(([name, source]) => [
    name.toLowerCase(),
    normalizeSource(name.toLowerCase(), source, configDirectory)
  ]));
  const tools = normalizeTools(parsed.data.tools, configDirectory);
  validateScannedDocumentFileNames(sources, parsed.data.defaultSource.toLowerCase(), tools);

  const ignorePatterns = [...parsed.data.ignore];
  let ignoreFile = null;
  if (parsed.data.ignoreFile) {
    ignoreFile = resolveConfiguredPath(parsed.data.ignoreFile, configDirectory);
    try {
      ignorePatterns.push(await fs.readFile(ignoreFile, "utf8"));
    } catch (error) {
      throw new AgentDocError("IGNORE_FILE_NOT_FOUND", `Cannot read ignore file: ${ignoreFile}`, {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    version: parsed.data.version,
    configPath,
    configDirectory,
    defaultSource: parsed.data.defaultSource.toLowerCase(),
    sources,
    ignoreFile,
    ignorePatterns,
    caseSensitive: parsed.data.caseSensitive,
    followLinks: parsed.data.followLinks,
    tools,
    secrets: normalizeSecrets(parsed.data.secrets, configDirectory),
    prompts: normalizePrompts(parsed.data.prompts),
    limits: parsed.data.limits
  };
}

export async function loadConfig(configPathInput = undefined) {
  const configuredPath = configPathInput ?? process.env.AGENT_DOC_SEARCH_CONFIG ?? DEFAULT_CONFIG_PATH;
  const configPath = path.resolve(expandPathVariables(configuredPath));
  let rawText;

  try {
    rawText = await fs.readFile(configPath, "utf8");
  } catch (error) {
    throw new AgentDocError("CONFIG_NOT_FOUND", `Cannot read search configuration: ${configPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  let rawConfig;
  try {
    rawConfig = JSON.parse(rawText);
  } catch (error) {
    throw new AgentDocError("CONFIG_JSON_INVALID", `Search configuration is not valid JSON: ${configPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return parseConfig(rawConfig, configPath);
}

export function getScannedDocumentFiles(config) {
  return config.tools.directories.flatMap((directory) => (
    directory.scannedDocumentFiles.map((file) => ({
      name: file.name,
      path: file.path,
      enabled: directory.enabled && file.enabled
    }))
  ));
}

export function getExactToolFiles(config) {
  return [
    ...config.tools.files.map((file) => ({
      ...file,
      documentationSearchEnabled: false
    })),
    ...config.tools.directories.flatMap((directory) => (
      directory.scannedToolFiles.map((file) => ({
        ...file,
        enabled: directory.enabled && file.enabled,
        sourceDirectoryName: directory.name,
        documentationSearchEnabled: directory.enabled
          && directory.scannedDocumentFiles.some((document) => document.enabled)
      }))
    ))
  ];
}

export function getConfiguredSource(config, sourceInput = undefined) {
  const sourceName = (sourceInput ?? config.defaultSource).trim().toLowerCase();
  const source = config.sources[sourceName];
  if (!source) {
    throw new AgentDocError("SOURCE_NOT_CONFIGURED", `Search source '${sourceName}' is not configured.`, {
      availableSources: Object.keys(config.sources)
    });
  }
  if (sourceName !== config.defaultSource) {
    return source;
  }

  const scannedDocumentFiles = getScannedDocumentFiles(config);
  return scannedDocumentFiles.length === 0
    ? source
    : {
        ...source,
        files: [...source.files, ...scannedDocumentFiles]
      };
}

export function getSource(config, sourceInput = undefined) {
  const source = getConfiguredSource(config, sourceInput);
  const sourceName = source.name;
  const enabledSource = {
    ...source,
    roots: source.roots.filter((root) => root.enabled),
    files: source.files.filter((file) => file.enabled)
  };
  if (sourceName !== config.defaultSource) {
    return enabledSource;
  }

  const configuredRootPaths = new Set(enabledSource.roots.map((root) => (
    process.platform === "win32" ? root.path.toLowerCase() : root.path
  )));
  const documentationRoots = config.tools.directories
    .filter((directory) => directory.enabled && directory.includeDocs)
    .filter((directory) => {
      const comparable = process.platform === "win32" ? directory.path.toLowerCase() : directory.path;
      if (configuredRootPaths.has(comparable)) {
        return false;
      }
      configuredRootPaths.add(comparable);
      return true;
    })
    .map((directory) => ({
      name: `tool:${directory.name}`,
      path: directory.path,
      priority: directory.priority,
      excludedScannedDocumentPaths: directory.scannedDocumentFiles
        .filter((file) => !file.enabled)
        .map((file) => file.path)
    }));

  return documentationRoots.length === 0
    ? enabledSource
    : {
        ...enabledSource,
        roots: [...enabledSource.roots, ...documentationRoots]
          .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
      };
}

function normalizeSearchScopeNames(value, field) {
  if (!Array.isArray(value)) {
    throw new AgentDocError("SEARCH_SCOPE_INVALID", `Search scope field '${field}' must be an array of configured grant names.`, {
      field
    });
  }
  if (value.length > MAX_SEARCH_SCOPE_GRANTS) {
    throw new AgentDocError(
      "SEARCH_SCOPE_INVALID",
      `Search scope field '${field}' can contain at most ${MAX_SEARCH_SCOPE_GRANTS} names.`,
      { field, limit: MAX_SEARCH_SCOPE_GRANTS }
    );
  }

  const names = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new AgentDocError("SEARCH_SCOPE_INVALID", `Search scope field '${field}' must contain non-empty configured grant names.`, {
        field
      });
    }
    const name = entry.trim();
    const comparableName = name.toLowerCase();
    if (seen.has(comparableName)) {
      continue;
    }
    seen.add(comparableName);
    names.push(name);
  }
  return names;
}

function resolveSelectedEntries(entries, requestedNames) {
  const entriesByExactName = new Map(entries.map((entry) => [entry.name, entry]));
  const entriesByComparableName = new Map(entries.map((entry) => [entry.name.toLowerCase(), entry]));
  const selectedNames = new Set();
  const unknown = [];
  const disabled = [];

  for (const requestedName of requestedNames) {
    const entry = entriesByExactName.get(requestedName)
      ?? entriesByComparableName.get(requestedName.toLowerCase());
    if (!entry) {
      unknown.push(requestedName);
      continue;
    }
    if (!entry.enabled) {
      disabled.push(entry.name);
      continue;
    }
    selectedNames.add(entry.name.toLowerCase());
  }

  return {
    entries: entries.filter((entry) => selectedNames.has(entry.name.toLowerCase())),
    unknown,
    disabled
  };
}

function validateScannedDocumentFileNames(sources, defaultSource, tools) {
  const names = new Set(sources[defaultSource].files.map((file) => file.name.toLowerCase()));
  for (const directory of tools.directories) {
    for (const file of directory.scannedDocumentFiles) {
      const comparableName = file.name.toLowerCase();
      if (names.has(comparableName)) {
        throw new AgentDocError(
          "CONFIG_DOCUMENT_FILE_NAME_DUPLICATE",
          `Exact document file name '${file.name}' is configured more than once in source '${defaultSource}'.`
        );
      }
      names.add(comparableName);
    }
  }
}

function publicDocumentDirectory(directory) {
  return {
    name: directory.name,
    path: directory.path,
    priority: directory.priority
  };
}

function publicDocumentFile(file) {
  return {
    name: file.name,
    path: file.path
  };
}

export function resolveDocumentSearchScope(config, {
  source: sourceInput = undefined,
  directories = undefined,
  files = undefined
} = {}) {
  const selectedMode = directories !== undefined || files !== undefined;
  if (!selectedMode) {
    const source = getSource(config, sourceInput);
    return {
      source,
      scope: {
        mode: "all-enabled",
        directories: source.roots.map(publicDocumentDirectory),
        files: source.files.map(publicDocumentFile)
      }
    };
  }

  const requestedDirectories = normalizeSearchScopeNames(directories ?? [], "directories");
  const requestedFiles = normalizeSearchScopeNames(files ?? [], "files");
  if (requestedDirectories.length === 0 && requestedFiles.length === 0) {
    throw new AgentDocError(
      "SEARCH_SCOPE_EMPTY",
      "Scoped search requires at least one document directory or exact file."
    );
  }

  const configuredSource = getConfiguredSource(config, sourceInput);
  const resolvedDirectories = resolveSelectedEntries(configuredSource.roots, requestedDirectories);
  const resolvedFiles = resolveSelectedEntries(configuredSource.files, requestedFiles);
  if (resolvedDirectories.unknown.length > 0 || resolvedFiles.unknown.length > 0) {
    throw new AgentDocError(
      "SEARCH_SCOPE_NOT_FOUND",
      "One or more requested document grants are not configured.",
      {
        unknownDirectories: resolvedDirectories.unknown,
        unknownFiles: resolvedFiles.unknown,
        availableDirectories: configuredSource.roots.filter((entry) => entry.enabled).map((entry) => entry.name),
        availableFiles: configuredSource.files.filter((entry) => entry.enabled).map((entry) => entry.name)
      }
    );
  }
  if (resolvedDirectories.disabled.length > 0 || resolvedFiles.disabled.length > 0) {
    throw new AgentDocError(
      "SEARCH_SCOPE_DISABLED",
      "One or more requested document grants are disabled.",
      {
        disabledDirectories: resolvedDirectories.disabled,
        disabledFiles: resolvedFiles.disabled
      }
    );
  }

  const source = {
    ...configuredSource,
    roots: resolvedDirectories.entries,
    files: resolvedFiles.entries
  };
  return {
    source,
    scope: {
      mode: "selected",
      directories: source.roots.map(publicDocumentDirectory),
      files: source.files.map(publicDocumentFile)
    }
  };
}

export function matchesConfiguredDocument(filePath, source, caseSensitive) {
  const baseName = path.basename(filePath);
  const candidate = caseSensitive ? baseName : baseName.toLowerCase();
  const fileNameMatch = source.fileNames.some((fileName) => (
    candidate === (caseSensitive ? fileName : fileName.toLowerCase())
  ));
  if (fileNameMatch) {
    return true;
  }

  return source.extensions.some((extension) => (
    candidate.endsWith(caseSensitive ? extension : extension.toLowerCase())
  ));
}

export function isConfiguredSecretPath(filePath, config) {
  const resolvedPath = path.resolve(filePath);
  const comparable = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;
  return config.secrets.files.some((secret) => {
    const configured = process.platform === "win32" ? secret.path.toLowerCase() : secret.path;
    return comparable === configured;
  });
}
