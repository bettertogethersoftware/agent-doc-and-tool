import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-doc-mcp-smoke-"));
const docsRoot = path.join(temporaryRoot, "docs");
const readmePath = path.join(docsRoot, "README.md");
const toolPath = path.join(docsRoot, "generate_music_stable_audio3.py");
const secretPath = path.join(docsRoot, "credentials.env");
const configPath = path.join(temporaryRoot, "search.config.json");
let client;

try {
  await fs.mkdir(docsRoot, { recursive: true });
  await fs.writeFile(readmePath, "# MCP fixture\nMiniMax H3 local video workflow.\n", "utf8");
  await fs.writeFile(toolPath, "print('MCP fixture')\n", "utf8");
  await fs.writeFile(secretPath, "hostname=ftp.example.test\npassword=mcp-fixture-password\n", "utf8");
  await fs.writeFile(configPath, JSON.stringify({
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [{ name: "smoke", path: docsRoot, priority: 100 }],
        extensions: [".ai.md", ".env"],
        fileNames: ["README.md"],
        files: []
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [{ name: "smoke-tools", path: docsRoot, priority: 100, recursive: true, includeDocs: true }],
      files: [],
      extensions: ".exe;.py;.env"
    },
    secrets: {
      files: [{ name: "smoke-ftp", path: secretPath, format: "auto" }],
      maxFileBytes: 100000
    },
    prompts: [
      {
        name: "youtube-mv",
        keywords: ["cinematic", "music video"],
        content: "Create a cinematic YouTube music video and verify the final render.",
        enabled: true
      },
      {
        name: "short mv",
        keywords: ["cinematic", "music video"],
        content: "Create a short music video.",
        enabled: true
      }
    ],
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxFileBytes: 100000,
      maxFetchBytes: 100000,
      maxFiles: 1000,
      timeoutMs: 5000
    }
  }), "utf8");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(projectRoot, "src", "server.mjs")],
    cwd: projectRoot,
    env: { ...process.env, AGENT_DOC_SEARCH_CONFIG: configPath }
  });
  client = new Client({ name: "agent-doc-search-smoke", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ["fetch", "find_prompt", "find_secret", "find_tool", "list", "list_prompt", "list_secret", "list_tool", "read_prompt", "read_secret", "search"]);

  const listCall = await client.callTool({
    name: "list",
    arguments: { source: "local" }
  });
  const listPayload = JSON.parse(listCall.content[0].text);
  assert.equal(listPayload.ok, true);
  assert.deepEqual(listPayload.directories, [{ name: "smoke", path: docsRoot, priority: 100 }]);
  assert.deepEqual(listPayload.files, []);
  assert.equal(listPayload.meta.enabledOnly, true);

  const listToolCall = await client.callTool({
    name: "list_tool",
    arguments: {}
  });
  const listToolPayload = JSON.parse(listToolCall.content[0].text);
  assert.deepEqual(listToolPayload.directories, [{
    name: "smoke-tools",
    path: docsRoot,
    priority: 100,
    recursive: true,
    includeDocs: true
  }]);
  assert.deepEqual(listToolPayload.files, []);
  assert.equal(listToolPayload.meta.enabledOnly, true);
  assert.equal(listToolPayload.meta.executed, false);

  const listPromptCall = await client.callTool({
    name: "list_prompt",
    arguments: {}
  });
  const listPromptPayload = JSON.parse(listPromptCall.content[0].text);
  assert.deepEqual(listPromptPayload.prompts, [
    { name: "youtube-mv", keywords: ["cinematic", "music video"] },
    { name: "short mv", keywords: ["cinematic", "music video"] }
  ]);
  assert.equal(listPromptPayload.meta.promptContentReturned, false);
  assert.doesNotMatch(JSON.stringify(listPromptPayload), /verify the final render|Create a short music video/);

  const listSecretCall = await client.callTool({
    name: "list_secret",
    arguments: {}
  });
  const listSecretPayload = JSON.parse(listSecretCall.content[0].text);
  assert.deepEqual(listSecretPayload.files, [{ name: "smoke-ftp", path: secretPath, format: "auto" }]);
  assert.equal(listSecretPayload.meta.filesRead, 0);
  assert.equal(listSecretPayload.meta.sensitiveValuesReturned, false);
  assert.doesNotMatch(JSON.stringify(listSecretPayload), /mcp-fixture-password/);

  const searchCall = await client.callTool({
    name: "search",
    arguments: { query: "minimax h3", source: "local" }
  });
  const searchPayload = JSON.parse(searchCall.content[0].text);
  assert.equal(searchPayload.ok, true);
  assert.equal(searchPayload.results[0].path, readmePath);
  assert.equal(searchPayload.results[0].lineNumber, 2);
  assert.equal(searchPayload.meta.resultUnit, "file");
  assert.equal(searchPayload.meta.uniqueFilesMatched, 1);
  assert.equal(searchPayload.results[0].returnedMatchCount, 1);

  const fetchCall = await client.callTool({
    name: "fetch",
    arguments: { path: searchPayload.results[0].path, source: "local" }
  });
  const fetchPayload = JSON.parse(fetchCall.content[0].text);
  assert.equal(fetchPayload.ok, true);
  assert.match(fetchPayload.content, /MiniMax H3 local video workflow/);

  const toolCall = await client.callTool({
    name: "find_tool",
    arguments: { query: "stable audio 3" }
  });
  const toolPayload = JSON.parse(toolCall.content[0].text);
  assert.equal(toolPayload.ok, true);
  assert.equal(toolPayload.meta.executed, false);
  assert.equal(toolPayload.results[0].path, toolPath);
  assert.equal(toolPayload.results[0].type, "python-script");

  const promptFindCall = await client.callTool({
    name: "find_prompt",
    arguments: { query: "short mv" }
  });
  const promptFindPayload = JSON.parse(promptFindCall.content[0].text);
  assert.equal(promptFindPayload.ok, true);
  assert.deepEqual(promptFindPayload.results.map((entry) => entry.name), ["short mv"]);
  assert.deepEqual(promptFindPayload.results[0].matchedFields, ["name"]);
  assert.equal(promptFindPayload.meta.matchMode, "all-terms");
  assert.equal(Object.hasOwn(promptFindPayload.results[0], "content"), false);

  const promptReadCall = await client.callTool({
    name: "read_prompt",
    arguments: { prompt: "youtube-mv" }
  });
  const promptReadPayload = JSON.parse(promptReadCall.content[0].text);
  assert.equal(promptReadPayload.ok, true);
  assert.match(promptReadPayload.content, /cinematic YouTube music video/);

  const secretFindCall = await client.callTool({
    name: "find_secret",
    arguments: { query: "password" }
  });
  const secretFindPayload = JSON.parse(secretFindCall.content[0].text);
  assert.equal(secretFindPayload.ok, true);
  assert.equal(secretFindPayload.results[0].name, "smoke-ftp");
  assert.deepEqual(secretFindPayload.results[0].fields, ["hostname", "password"]);
  assert.doesNotMatch(JSON.stringify(secretFindPayload), /mcp-fixture-password/);

  const secretReadCall = await client.callTool({
    name: "read_secret",
    arguments: { secret: "smoke-ftp", keys: ["hostname", "password"] }
  });
  const secretReadPayload = JSON.parse(secretReadCall.content[0].text);
  assert.equal(secretReadPayload.ok, true);
  assert.equal(secretReadPayload.sensitive, true);
  assert.equal(secretReadPayload.values.hostname, "ftp.example.test");
  assert.equal(secretReadPayload.values.password, "mcp-fixture-password");

  const secretSearchCall = await client.callTool({
    name: "search",
    arguments: { query: "mcp fixture password", source: "local" }
  });
  const secretSearchPayload = JSON.parse(secretSearchCall.content[0].text);
  assert.equal(secretSearchPayload.results.length, 0);

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
    searchHit: {
      path: searchPayload.results[0].path,
      lineNumber: searchPayload.results[0].lineNumber,
      lineText: searchPayload.results[0].lineText
    },
    toolHit: {
      path: toolPayload.results[0].path,
      type: toolPayload.results[0].type,
      executed: toolPayload.meta.executed
    },
    promptHit: {
      name: promptFindPayload.results[0].name,
      preview: promptFindPayload.results[0].preview,
      sha256: promptReadPayload.sha256
    },
    secretHit: {
      path: secretFindPayload.results[0].path,
      fields: secretFindPayload.results[0].fields,
      sensitiveValuesReturned: secretFindPayload.meta.sensitiveValuesReturned
    },
    secretRead: {
      sensitive: secretReadPayload.sensitive,
      returnedKeys: Object.keys(secretReadPayload.values)
    },
    fetchSha256: fetchPayload.sha256
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.stack ?? error.message : String(error)
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (client) {
    await client.close();
  }
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  }
}
