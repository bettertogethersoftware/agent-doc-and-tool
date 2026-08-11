#!/usr/bin/env node

import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { DEFAULT_CONFIG_PATH, PROJECT_ROOT } from "./config.mjs";
import { errorPayload } from "./errors.mjs";

export const DEFAULT_EXAMPLE_CONFIG_PATH = path.join(PROJECT_ROOT, "config", "search.config.example.json");

export async function ensureLocalConfig({
  configPath = DEFAULT_CONFIG_PATH,
  examplePath = DEFAULT_EXAMPLE_CONFIG_PATH
} = {}) {
  try {
    await fs.access(configPath, fsConstants.F_OK);
    return { schemaVersion: "1.0", ok: true, created: false, configPath };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  try {
    await fs.copyFile(examplePath, configPath, fsConstants.COPYFILE_EXCL);
    return { schemaVersion: "1.0", ok: true, created: true, configPath, examplePath };
  } catch (error) {
    if (error?.code === "EEXIST") {
      return { schemaVersion: "1.0", ok: true, created: false, configPath };
    }
    throw error;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  ensureLocalConfig().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify(errorPayload(error), null, 2)}\n`);
    process.exitCode = 1;
  });
}
