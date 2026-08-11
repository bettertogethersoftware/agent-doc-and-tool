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
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ["fetch", "find_tool", "search"]);

  const searchCall = await client.callTool({
    name: "search",
    arguments: { query, source: "local", maxResults: 10 }
  });
  const searchPayload = JSON.parse(searchCall.content[0].text);
  assert.equal(searchPayload.ok, true);
  assert.ok(searchPayload.results.length > 0, `No live local-document result for '${query}'.`);

  const selected = searchPayload.results[0];
  const fetchCall = await client.callTool({
    name: "fetch",
    arguments: { path: selected.path, source: "local" }
  });
  const fetchPayload = JSON.parse(fetchCall.content[0].text);
  assert.equal(fetchPayload.ok, true);
  assert.ok(fetchPayload.content.length > 0);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    tools: listed.tools.map((tool) => tool.name).sort(),
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
