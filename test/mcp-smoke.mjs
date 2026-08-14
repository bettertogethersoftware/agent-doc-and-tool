import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");
const systemTemporaryRoot = await fs.realpath(os.tmpdir());
const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-doc-mcp-smoke-"));
const docsRoot = path.join(temporaryRoot, "docs");
const toolRoot = path.join(temporaryRoot, "tools");
const readmePath = path.join(docsRoot, "README.md");
const exactDocumentPath = path.join(temporaryRoot, "exact-workflow.txt");
const toolPath = path.join(toolRoot, "generate_music_stable_audio3.py");
const manualToolPath = path.join(toolRoot, "inspect_video.ps1");
const secretPath = path.join(docsRoot, "credentials.env");
const configPath = path.join(temporaryRoot, "search.config.json");
const instructions = {
  documents: "Use the smoke-test document grants only.\nAsk before publishing.",
  tools: "Use the smoke-test tool grants only.\nAsk before publishing.",
  prompts: "Use the smoke-test prompt grants only.\nAsk before publishing.",
  secrets: "Use the smoke-test secret grants only.\nAsk before publishing."
};
let client;

try {
  await Promise.all([
    fs.mkdir(docsRoot, { recursive: true }),
    fs.mkdir(toolRoot, { recursive: true })
  ]);
  await fs.writeFile(readmePath, "# MCP fixture\nMiniMax H3 local video workflow.\nShared scope marker.\n", "utf8");
  await fs.writeFile(exactDocumentPath, "Exact smoke workflow document.\nShared scope marker.\n", "utf8");
  await fs.writeFile(toolPath, "print('MCP fixture')\n", "utf8");
  await fs.writeFile(manualToolPath, "Write-Output 'MCP fixture'\n", "utf8");
  await fs.writeFile(secretPath, "hostname=ftp.example.test\npassword=mcp-fixture-password\n", "utf8");
  await fs.writeFile(configPath, JSON.stringify({
    version: 1,
    instructions,
    defaultSource: "local",
    sources: {
      local: {
        roots: [{ name: "smoke", path: docsRoot, priority: 100 }],
        extensions: [".ai.md", ".env"],
        fileNames: ["README.md"],
        files: [{ name: "smoke-exact-workflow", path: exactDocumentPath }]
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [{
        name: "smoke-tools",
        path: toolRoot,
        documentPath: docsRoot,
        priority: 100,
        recursive: true,
        includeDocs: true,
        scannedToolFiles: [{ name: "smoke-audio-generator", path: toolPath, priority: 150 }]
      }],
      files: [{ name: "smoke-video-inspector", path: manualToolPath, priority: 125 }],
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
  const toolsByName = new Map(listed.tools.map((tool) => [tool.name, tool]));
  for (const catalogName of ["list", "list_tool", "list_prompt", "list_secret"]) {
    assert.match(toolsByName.get(catalogName).description, /top-level instruction/i);
    assert.doesNotMatch(toolsByName.get(catalogName).description, /humanNote/);
  }
  assert.match(toolsByName.get("list_tool").description, /invocation metadata/i);
  assert.match(toolsByName.get("find_tool").description, /fallback/i);
  assert.deepEqual(Object.keys(toolsByName.get("list").inputSchema.properties), []);
  assert.deepEqual(Object.keys(toolsByName.get("search").inputSchema.properties).sort(), ["directories", "files", "maxResults", "query"]);
  assert.deepEqual(Object.keys(toolsByName.get("fetch").inputSchema.properties), ["path"]);

  const listCall = await client.callTool({
    name: "list",
    arguments: {}
  });
  const listPayload = JSON.parse(listCall.content[0].text);
  assert.equal(listPayload.ok, true);
  assert.equal(listPayload.instruction, instructions.documents);
  assert.equal(listCall.structuredContent.instruction, instructions.documents);
  assert.equal(Object.hasOwn(listPayload, "humanNote"), false);
  assert.equal(Object.hasOwn(listPayload, "source"), false);
  assert.equal(Object.hasOwn(listCall.structuredContent, "source"), false);
  assert.deepEqual(listPayload.directories, [
    { name: "smoke", path: docsRoot, priority: 100 },
    { name: "smoke-tools", path: docsRoot, priority: 100 }
  ]);
  assert.deepEqual(listPayload.files, [{
    name: "smoke-exact-workflow",
    path: exactDocumentPath
  }]);
  assert.equal(listPayload.meta.enabledOnly, true);

  const listToolCall = await client.callTool({
    name: "list_tool",
    arguments: {}
  });
  const listToolPayload = JSON.parse(listToolCall.content[0].text);
  assert.equal(listToolPayload.instruction, instructions.tools);
  assert.equal(listToolCall.structuredContent.instruction, instructions.tools);
  assert.equal(Object.hasOwn(listToolPayload, "humanNote"), false);
  assert.deepEqual(listToolPayload.directories, [{
    name: "smoke-tools",
    path: toolRoot,
    documentPath: docsRoot,
    priority: 100,
    recursive: true,
    includeDocs: true,
    scannedToolFiles: [{
      name: "smoke-audio-generator",
      path: toolPath,
      priority: 150,
      workingDirectory: toolRoot,
      extension: ".py",
      type: "python-script",
      invocation: {
        kind: "python",
        command: "python",
        argumentsPrefix: [toolPath],
        requiresEnvironment: true
      }
    }]
  }]);
  assert.deepEqual(listToolPayload.files, [{
    name: "smoke-video-inspector",
    path: manualToolPath,
    priority: 125,
    workingDirectory: toolRoot,
    extension: ".ps1",
    type: "powershell-script",
    invocation: {
      kind: "powershell",
      command: "powershell",
      argumentsPrefix: ["-NoProfile", "-File", manualToolPath],
      requiresEnvironment: true
    }
  }]);
  assert.equal(listToolPayload.meta.enabledOnly, true);
  assert.equal(listToolPayload.meta.executed, false);
  assert.equal(Object.hasOwn(listToolPayload.directories[0].scannedToolFiles[0], "verified"), false);
  assert.equal(Object.hasOwn(listToolPayload.files[0], "verified"), false);

  const listPromptCall = await client.callTool({
    name: "list_prompt",
    arguments: {}
  });
  const listPromptPayload = JSON.parse(listPromptCall.content[0].text);
  assert.equal(listPromptPayload.instruction, instructions.prompts);
  assert.equal(listPromptCall.structuredContent.instruction, instructions.prompts);
  assert.equal(Object.hasOwn(listPromptPayload, "humanNote"), false);
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
  assert.equal(listSecretPayload.instruction, instructions.secrets);
  assert.equal(listSecretCall.structuredContent.instruction, instructions.secrets);
  assert.equal(Object.hasOwn(listSecretPayload, "humanNote"), false);
  assert.deepEqual(listSecretPayload.files, [{ name: "smoke-ftp", path: secretPath, format: "auto" }]);
  assert.equal(listSecretPayload.meta.filesRead, 0);
  assert.equal(listSecretPayload.meta.sensitiveValuesReturned, false);
  assert.doesNotMatch(JSON.stringify(listSecretPayload), /mcp-fixture-password/);

  const searchCall = await client.callTool({
    name: "search",
    arguments: { query: "minimax h3" }
  });
  const searchPayload = JSON.parse(searchCall.content[0].text);
  assert.equal(searchPayload.ok, true);
  assert.equal(Object.hasOwn(searchPayload, "instruction"), false);
  assert.equal(Object.hasOwn(searchPayload, "humanNote"), false);
  assert.equal(Object.hasOwn(searchPayload, "source"), false);
  assert.equal(Object.hasOwn(searchCall.structuredContent, "source"), false);
  assert.equal(searchPayload.results[0].path, readmePath);
  assert.equal(searchPayload.results[0].lineNumber, 2);
  assert.equal(searchPayload.scope.mode, "all-enabled");
  assert.deepEqual(searchPayload.scope.directories.map((entry) => entry.name), ["smoke"]);
  assert.deepEqual(searchPayload.scope.files.map((entry) => entry.name), ["smoke-exact-workflow"]);
  assert.deepEqual(searchPayload.results[0].grant, { type: "directory", name: "smoke" });
  assert.equal(searchPayload.meta.resultUnit, "file");
  assert.equal(searchPayload.meta.scopeMode, "all-enabled");
  assert.equal(searchPayload.meta.uniqueFilesMatched, 1);
  assert.equal(searchPayload.results[0].returnedMatchCount, 1);

  const scopedSearchCall = await client.callTool({
    name: "search",
    arguments: {
      query: "shared scope marker",
      directories: ["smoke"],
      files: ["smoke-exact-workflow"]
    }
  });
  const scopedSearchPayload = JSON.parse(scopedSearchCall.content[0].text);
  assert.equal(scopedSearchPayload.ok, true);
  assert.equal(scopedSearchPayload.scope.mode, "selected");
  assert.deepEqual(scopedSearchPayload.scope.directories, [{ name: "smoke", path: docsRoot, priority: 100 }]);
  assert.deepEqual(scopedSearchPayload.scope.files, [{
    name: "smoke-exact-workflow",
    path: exactDocumentPath
  }]);
  assert.deepEqual(new Set(scopedSearchPayload.results.map((entry) => entry.path)), new Set([
    readmePath,
    exactDocumentPath
  ]));
  assert.deepEqual(new Set(scopedSearchPayload.results.map((entry) => entry.grant.type)), new Set([
    "directory",
    "file"
  ]));

  const toolDirectorySearchCall = await client.callTool({
    name: "search",
    arguments: {
      query: "minimax h3",
      directories: ["smoke-tools"]
    }
  });
  const toolDirectorySearchPayload = JSON.parse(toolDirectorySearchCall.content[0].text);
  assert.equal(toolDirectorySearchPayload.ok, true);
  assert.equal(toolDirectorySearchPayload.scope.mode, "selected");
  assert.deepEqual(toolDirectorySearchPayload.scope.directories, [{
    name: "smoke-tools",
    path: docsRoot,
    priority: 100
  }]);
  assert.deepEqual(toolDirectorySearchPayload.scope.files, []);
  assert.deepEqual(toolDirectorySearchPayload.results.map((entry) => entry.path), [readmePath]);
  assert.deepEqual(toolDirectorySearchPayload.results[0].grant, {
    type: "directory",
    name: "smoke-tools"
  });

  const emptyScopeCall = await client.callTool({
    name: "search",
    arguments: { query: "error", directories: [], files: [] }
  });
  const emptyScopePayload = JSON.parse(emptyScopeCall.content[0].text);
  assert.equal(emptyScopeCall.isError, true);
  assert.equal(emptyScopePayload.error.code, "SEARCH_SCOPE_EMPTY");

  const fetchCall = await client.callTool({
    name: "fetch",
    arguments: { path: searchPayload.results[0].path }
  });
  const fetchPayload = JSON.parse(fetchCall.content[0].text);
  assert.equal(fetchPayload.ok, true);
  assert.equal(Object.hasOwn(fetchPayload, "source"), false);
  assert.equal(Object.hasOwn(fetchCall.structuredContent, "source"), false);
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
  assert.deepEqual(
    {
      workingDirectory: toolPayload.results[0].workingDirectory,
      extension: toolPayload.results[0].extension,
      type: toolPayload.results[0].type,
      invocation: toolPayload.results[0].invocation
    },
    {
      workingDirectory: listToolPayload.directories[0].scannedToolFiles[0].workingDirectory,
      extension: listToolPayload.directories[0].scannedToolFiles[0].extension,
      type: listToolPayload.directories[0].scannedToolFiles[0].type,
      invocation: listToolPayload.directories[0].scannedToolFiles[0].invocation
    }
  );

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
    arguments: { query: "mcp fixture password" }
  });
  const secretSearchPayload = JSON.parse(secretSearchCall.content[0].text);
  assert.equal(secretSearchPayload.results.length, 0);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    tools: listed.tools.map((tool) => tool.name).sort(),
    catalog: {
      instructions: {
        documents: listPayload.instruction,
        tools: listToolPayload.instruction,
        prompts: listPromptPayload.instruction,
        secrets: listSecretPayload.instruction
      },
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
    scopedSearch: {
      directories: scopedSearchPayload.scope.directories.map((entry) => entry.name),
      files: scopedSearchPayload.scope.files.map((entry) => entry.name),
      paths: scopedSearchPayload.results.map((entry) => entry.path)
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
  const resolvedSystemTemp = systemTemporaryRoot;
  const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  }
}
