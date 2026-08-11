import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { createNativeDropTargetManager, startUiServer } from "../src/ui-server.mjs";

function createFakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    return true;
  };
  return child;
}

async function createUiFixture(t) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-doc-ui-test-"));
  const docsRoot = path.join(temporaryRoot, "allowed docs");
  const exactFile = path.join(temporaryRoot, "dropped exact file.txt");
  const toolPath = path.join(docsRoot, "ffprobe.exe");
  const configPath = path.join(temporaryRoot, "search.config.json");
  await fs.mkdir(docsRoot, { recursive: true });
  await fs.writeFile(path.join(docsRoot, "workflow.json"), '{"description":"UI shell search target"}\n', "utf8");
  await fs.writeFile(toolPath, "fixture\n", "utf8");
  await fs.writeFile(exactFile, "Dropped exact file fixture.\n", "utf8");

  const config = {
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [{ name: "ui-fixture", path: docsRoot, priority: 100 }],
        extensions: "**.json;**.ai.md",
        fileNames: ["README.md"],
        files: []
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [{ name: "ui-tools", path: docsRoot, priority: 100, recursive: true, includeDocs: true }],
      files: [],
      extensions: ".exe;.py"
    },
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxFileBytes: 100000,
      maxFetchBytes: 100000,
      maxFiles: 1000,
      timeoutMs: 5000
    }
  };
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const ui = await startUiServer({ configPath, port: 0 });
  t.after(async () => {
    await ui.close();
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = path.resolve(os.tmpdir());
    const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });

  return { config, configPath, docsRoot, exactFile, toolPath, ui };
}

function apiHeaders(ui, json = false) {
  return {
    "x-agent-doc-token": ui.token,
    ...(json ? { "content-type": "application/json" } : {})
  };
}

test("configuration UI serves locally and protects its API", async (t) => {
  const fixture = await createUiFixture(t);
  assert.equal(fixture.ui.host, "127.0.0.1");

  const page = await fetch(fixture.ui.url);
  assert.equal(page.status, 200);
  const pageText = await page.text();
  assert.match(pageText, /Choose what your AI agent can find/);
  assert.match(pageText, /Drag and drop with the Windows drop box/);
  assert.match(pageText, /Register tools without running them/);

  const forbidden = await fetch(new URL("api/config", fixture.ui.url));
  assert.equal(forbidden.status, 403);

  const response = await fetch(new URL("api/config", fixture.ui.url), { headers: apiHeaders(fixture.ui) });
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.config.sources.local.extensions, "**.json;**.ai.md");
  assert.deepEqual(payload.check.sources.local.extensions, [".json", ".ai.md"]);
  assert.equal(payload.check.tools.directories[0].recursive, true);
});

test("configuration UI classifies dropped files and folders", async (t) => {
  const fixture = await createUiFixture(t);
  const response = await fetch(new URL("api/classify-dropped-paths", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({
      paths: [fixture.docsRoot, fixture.exactFile, fixture.exactFile, "relative-file.txt"]
    })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.items.map((item) => item.type), ["directory", "file"]);
  assert.equal(path.basename(payload.items[0].path), path.basename(fixture.docsRoot));
  assert.equal(path.basename(payload.items[1].path), path.basename(fixture.exactFile));
  assert.equal(payload.errors.length, 1);
  assert.equal(payload.errors[0].code, "PATH_NOT_ABSOLUTE");
});

test("native drop manager shows one console-hidden helper and shares concurrent requests", async () => {
  const launches = [];
  const child = createFakeChild();
  const manager = createNativeDropTargetManager({
    platform: "win32",
    powershellPath: "powershell.exe",
    scriptPath: "drop-target.ps1",
    timeoutMs: 1000,
    spawnProcess: (...arguments_) => {
      launches.push(arguments_);
      return child;
    }
  });

  const first = manager.show();
  const second = manager.show();
  assert.equal(first, second);
  assert.equal(launches.length, 1);
  assert.deepEqual(launches[0][1].slice(3, 5), ["-WindowStyle", "Hidden"]);
  assert.equal(launches[0][2].windowsHide, undefined);

  const droppedPath = "C:\\allowed\\folder";
  child.stdout.write(`${Buffer.from(droppedPath, "utf8").toString("base64")}\n`);
  child.emit("close", 0);
  assert.deepEqual(await first, [droppedPath]);
  assert.deepEqual(await second, [droppedPath]);
});

test("native drop manager kills and rejects a timed-out helper", async () => {
  const child = createFakeChild();
  const manager = createNativeDropTargetManager({
    platform: "win32",
    timeoutMs: 10,
    spawnProcess: () => child
  });

  await assert.rejects(manager.show(), (error) => error?.code === "UI_DROP_TARGET_TIMEOUT");
  assert.equal(child.killed, true);
});

test("configuration UI validates, saves, backs up, and searches", async (t) => {
  const fixture = await createUiFixture(t);
  const nextConfig = structuredClone(fixture.config);
  nextConfig.sources.local.fileNames.push("AGENTS.md");

  const saveResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: nextConfig })
  });
  const savePayload = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(savePayload.ok, true);
  assert.equal(savePayload.backupCreated, true);
  assert.equal(JSON.parse(await fs.readFile(fixture.configPath, "utf8")).sources.local.fileNames.at(-1), "AGENTS.md");
  assert.equal(JSON.parse(await fs.readFile(`${fixture.configPath}.bak`, "utf8")).sources.local.fileNames.at(-1), "README.md");

  const searchResponse = await fetch(new URL("api/search", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "ui shell target", source: "local" })
  });
  const searchPayload = await searchResponse.json();
  assert.equal(searchPayload.ok, true);
  assert.equal(searchPayload.results[0].path, path.join(fixture.docsRoot, "workflow.json"));

  const toolResponse = await fetch(new URL("api/find-tool", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "ffprobe" })
  });
  const toolPayload = await toolResponse.json();
  assert.equal(toolPayload.ok, true);
  assert.equal(toolPayload.meta.executed, false);
  assert.equal(toolPayload.results[0].path, fixture.toolPath);
});
