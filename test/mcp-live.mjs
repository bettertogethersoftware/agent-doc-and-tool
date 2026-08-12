import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");
const query = process.argv.slice(2).join(" ").trim() || "minimax h3";
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(projectRoot, "src", "server.mjs")],
  cwd: projectRoot,
  env: {
    ...process.env,
    AGENT_DOC_SEARCH_CONFIG: path.join(projectRoot, "config", "search.config.json")
  }
});
const client = new Client({ name: "agent-doc-search-live-check", version: "1.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ["fetch", "find_prompt", "find_secret", "find_tool", "list", "list_prompt", "list_secret", "list_tool", "read_prompt", "read_secret", "search"]);
  const toolsByName = new Map(listed.tools.map((tool) => [tool.name, tool]));
  assert.deepEqual(Object.keys(toolsByName.get("list").inputSchema.properties), []);
  assert.deepEqual(Object.keys(toolsByName.get("search").inputSchema.properties).sort(), ["directories", "files", "maxResults", "query"]);
  assert.deepEqual(Object.keys(toolsByName.get("fetch").inputSchema.properties), ["path"]);

  const listCall = await client.callTool({
    name: "list",
    arguments: {}
  });
  const listPayload = JSON.parse(listCall.content[0].text);
  assert.equal(listPayload.ok, true);
  assert.equal(Object.hasOwn(listPayload, "source"), false);
  assert.equal(listPayload.meta.enabledOnly, true);
  assert.ok(Array.isArray(listPayload.directories));
  assert.ok(Array.isArray(listPayload.files));

  const listToolCall = await client.callTool({ name: "list_tool", arguments: {} });
  const listToolPayload = JSON.parse(listToolCall.content[0].text);
  assert.equal(listToolPayload.ok, true);
  assert.equal(listToolPayload.meta.enabledOnly, true);
  assert.equal(listToolPayload.meta.executed, false);
  assert.ok(Array.isArray(listToolPayload.directories));
  assert.ok(Array.isArray(listToolPayload.files));

  const listPromptCall = await client.callTool({ name: "list_prompt", arguments: {} });
  const listPromptPayload = JSON.parse(listPromptCall.content[0].text);
  assert.equal(listPromptPayload.ok, true);
  assert.equal(listPromptPayload.meta.enabledOnly, true);
  assert.equal(listPromptPayload.meta.promptContentReturned, false);
  assert.ok(Array.isArray(listPromptPayload.prompts));

  const listSecretCall = await client.callTool({ name: "list_secret", arguments: {} });
  const listSecretPayload = JSON.parse(listSecretCall.content[0].text);
  assert.equal(listSecretPayload.ok, true);
  assert.equal(listSecretPayload.meta.enabledOnly, true);
  assert.equal(listSecretPayload.meta.filesRead, 0);
  assert.equal(listSecretPayload.meta.sensitiveValuesReturned, false);
  assert.ok(Array.isArray(listSecretPayload.files));

  const searchCall = await client.callTool({
    name: "search",
    arguments: { query, maxResults: 10 }
  });
  const searchPayload = JSON.parse(searchCall.content[0].text);
  assert.equal(searchPayload.ok, true);
  assert.equal(Object.hasOwn(searchPayload, "source"), false);
  assert.equal(searchPayload.scope.mode, "all-enabled");
  assert.equal(searchPayload.meta.scopeMode, "all-enabled");
  assert.equal(searchPayload.meta.directoriesSelected, searchPayload.scope.directories.length);
  assert.equal(searchPayload.meta.filesSelected, searchPayload.scope.files.length);
  assert.ok(searchPayload.results.length > 0, `No live local-document result for '${query}'.`);

  const selected = searchPayload.results[0];
  const fetchCall = await client.callTool({
    name: "fetch",
    arguments: { path: selected.path }
  });
  const fetchPayload = JSON.parse(fetchCall.content[0].text);
  assert.equal(fetchPayload.ok, true);
  assert.equal(Object.hasOwn(fetchPayload, "source"), false);
  assert.ok(fetchPayload.content.length > 0);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    tools: listed.tools.map((tool) => tool.name).sort(),
    catalog: {
      documents: {
        directories: listPayload.directories,
        files: listPayload.files
      },
      tools: {
        directories: listToolPayload.directories,
        files: listToolPayload.files
      },
      prompts: listPromptPayload.prompts,
      secrets: listSecretPayload.files
    },
    query,
    searchMeta: searchPayload.meta,
    selected: {
      path: selected.path,
      lineNumber: selected.lineNumber,
      lineText: selected.lineText,
      matchType: selected.matchType
    },
    fetched: {
      sizeBytes: fetchPayload.sizeBytes,
      lineCount: fetchPayload.lineCount,
      sha256: fetchPayload.sha256
    }
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.stack ?? error.message : String(error)
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  await client.close();
}
