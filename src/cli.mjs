#!/usr/bin/env node

import { errorPayload } from "./errors.mjs";
import { findPrompts, readPrompt } from "./prompt-service.mjs";
import { checkConfiguration, fetchDocument, searchDocuments } from "./search-service.mjs";
import { findTools } from "./tool-service.mjs";

function parseArguments(values) {
  const result = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function integerArgument(value, name) {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}

function usage() {
  return {
    schemaVersion: "1.0",
    ok: true,
    commands: {
      check: "node src/cli.mjs check [--config PATH]",
      search: "node src/cli.mjs search --query TEXT [--source local] [--max-results N] [--config PATH]",
      fetch: "node src/cli.mjs fetch --path ABSOLUTE_PATH [--source local] [--config PATH]",
      findTool: "node src/cli.mjs find-tool --query TEXT [--max-results N] [--config PATH]",
      findPrompt: "node src/cli.mjs find-prompt --query TEXT [--max-results N] [--config PATH]",
      readPrompt: "node src/cli.mjs read-prompt --prompt NAME [--config PATH]"
    }
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const command = args._[0] ?? "help";
  const options = { configPath: typeof args.config === "string" ? args.config : undefined };

  if (command === "help" || args.help === true) {
    return usage();
  }
  if (command === "check") {
    return checkConfiguration(options);
  }
  if (command === "search") {
    return searchDocuments({
      query: typeof args.query === "string" ? args.query : "",
      source: typeof args.source === "string" ? args.source : "local",
      maxResults: integerArgument(args["max-results"], "max-results")
    }, options);
  }
  if (command === "fetch") {
    return fetchDocument({
      path: typeof args.path === "string" ? args.path : "",
      source: typeof args.source === "string" ? args.source : "local"
    }, options);
  }
  if (command === "find-tool") {
    return findTools({
      query: typeof args.query === "string" ? args.query : "",
      maxResults: integerArgument(args["max-results"], "max-results")
    }, options);
  }
  if (command === "find-prompt") {
    return findPrompts({
      query: typeof args.query === "string" ? args.query : "",
      maxResults: integerArgument(args["max-results"], "max-results")
    }, options);
  }
  if (command === "read-prompt") {
    return readPrompt({
      prompt: typeof args.prompt === "string" ? args.prompt : ""
    }, options);
  }
  throw new Error(`Unknown command '${command}'.`);
}

try {
  process.stdout.write(`${JSON.stringify(await main(), null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify(errorPayload(error), null, 2)}\n`);
  process.exitCode = 1;
}
