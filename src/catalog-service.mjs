import { getConfiguredSource, loadConfig } from "./config.mjs";

export async function listDocumentCatalog({ source: sourceInput = undefined } = {}, options = {}) {
  const config = await loadConfig(options.configPath);
  const source = getConfiguredSource(config, sourceInput);
  const directories = source.roots
    .filter((directory) => directory.enabled)
    .map((directory) => ({
      name: directory.name,
      path: directory.path,
      priority: directory.priority
    }));
  const files = source.files
    .filter((file) => file.enabled)
    .map((file) => ({ path: file.path }));

  return {
    schemaVersion: "1.0",
    ok: true,
    source: source.name,
    directories,
    files,
    meta: {
      backend: "configuration",
      indexed: false,
      networkUsed: false,
      enabledOnly: true,
      directoriesReturned: directories.length,
      filesReturned: files.length,
      configPath: config.configPath
    }
  };
}

export async function listPromptCatalog(options = {}) {
  const config = await loadConfig(options.configPath);
  const prompts = config.prompts
    .filter((prompt) => prompt.enabled)
    .map((prompt) => ({
      name: prompt.name,
      keywords: prompt.keywords
    }));

  return {
    schemaVersion: "1.0",
    ok: true,
    prompts,
    meta: {
      backend: "configuration",
      indexed: false,
      networkUsed: false,
      enabledOnly: true,
      promptContentReturned: false,
      promptsReturned: prompts.length,
      configPath: config.configPath
    }
  };
}

export async function listSecretCatalog(options = {}) {
  const config = await loadConfig(options.configPath);
  const files = config.secrets.files
    .filter((file) => file.enabled)
    .map((file) => ({
      name: file.name,
      path: file.path,
      format: file.format
    }));

  return {
    schemaVersion: "1.0",
    ok: true,
    files,
    meta: {
      backend: "configuration",
      indexed: false,
      networkUsed: false,
      enabledOnly: true,
      filesRead: 0,
      sensitiveValuesReturned: false,
      filesReturned: files.length,
      configPath: config.configPath
    }
  };
}

export async function listToolCatalog(options = {}) {
  const config = await loadConfig(options.configPath);
  const directories = config.tools.directories
    .filter((directory) => directory.enabled)
    .map((directory) => ({
      name: directory.name,
      path: directory.path,
      priority: directory.priority,
      recursive: directory.recursive,
      includeDocs: directory.includeDocs
    }));
  const files = config.tools.files
    .filter((file) => file.enabled)
    .map((file) => ({
      name: file.name,
      path: file.path,
      priority: file.priority
    }));

  return {
    schemaVersion: "1.0",
    ok: true,
    directories,
    files,
    meta: {
      backend: "configuration",
      indexed: false,
      networkUsed: false,
      enabledOnly: true,
      executed: false,
      directoriesReturned: directories.length,
      filesReturned: files.length,
      configPath: config.configPath
    }
  };
}
