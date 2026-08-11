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
  maxMatchesPerFile: 3,
  maxLineChars: 1_000,
  maxFileBytes: 2_000_000,
  maxFetchBytes: 4_000_000,
  maxFiles: 50_000,
  timeoutMs: 15_000
};

const RootEntrySchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1).optional(),
    path: z.string().trim().min(1),
    priority: z.number().int().min(-10_000).max(10_000).default(0)
  }).strict()
]);

const ExtensionListSchema = z.union([
  z.string().trim().min(1),
  z.array(z.string().trim().min(1))
]);

const SourceSchema = z.object({
  roots: z.array(RootEntrySchema).default([]),
  extensions: ExtensionListSchema.default([".ai.md"]),
  fileNames: z.array(z.string().trim().min(1)).default(["README.md"]),
  files: z.array(z.string().trim().min(1)).default([])
}).strict();

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
  const roots = rawSource.roots.map((entry, index) => {
    const root = typeof entry === "string" ? { path: entry, priority: 0 } : entry;
    return {
      name: root.name ?? `${name}-root-${index + 1}`,
      path: resolveConfiguredPath(root.path, configDirectory),
      priority: root.priority ?? 0
    };
  }).sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));

  return {
    name,
    roots,
    extensions: normalizeExtensionPatterns(rawSource.extensions),
    fileNames: [...new Set(rawSource.fileNames.map((fileName) => fileName.trim()))],
    files: [...new Set(rawSource.files.map((file) => resolveConfiguredPath(file, configDirectory)))]
  };
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

export function getSource(config, sourceInput = undefined) {
  const sourceName = (sourceInput ?? config.defaultSource).trim().toLowerCase();
  const source = config.sources[sourceName];
  if (!source) {
    throw new AgentDocError("SOURCE_NOT_CONFIGURED", `Search source '${sourceName}' is not configured.`, {
      availableSources: Object.keys(config.sources)
    });
  }
  return source;
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
