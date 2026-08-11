import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { createNativeDropTargetManager, createNativePickerScript, startUiServer } from "../src/ui-server.mjs";

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
  const secretPath = path.join(temporaryRoot, "ftp-secret.txt");
  const configPath = path.join(temporaryRoot, "search.config.json");
  await fs.mkdir(docsRoot, { recursive: true });
  await fs.writeFile(path.join(docsRoot, "workflow.json"), '{"description":"UI shell search target"}\n', "utf8");
  await fs.writeFile(toolPath, "fixture\n", "utf8");
  await fs.writeFile(exactFile, "Dropped exact file fixture.\n", "utf8");
  await fs.writeFile(secretPath, "hostname=ftp.example.test\npassword=ui-fixture-password\n", "utf8");

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
    secrets: {
      files: [{ name: "ui-ftp", path: secretPath, format: "auto" }],
      maxFileBytes: 100000
    },
    prompts: [
      { name: "youtube-mv", keywords: ["cinematic", "music video", "youtube", "feature length"], content: "Create a YouTube music video with deliberate pacing.", enabled: true },
      { name: "short mv", keywords: ["cinematic", "music video", "youtube"], content: "Create a short music video.", enabled: true }
    ],
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

  return { config, configPath, docsRoot, exactFile, secretPath, toolPath, ui };
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
  assert.match(pageText, /Agent Docs &amp; Tools configuration/);
  assert.match(pageText, /id="prompts-tab" class="tab is-active"/);
  assert.ok(pageText.indexOf('id="prompts-tab"') < pageText.indexOf('id="documents-tab"'));
  assert.match(pageText, /data-field="keywords"/);
  assert.match(pageText, /Drag and drop with the Windows drop box/);
  assert.match(pageText, /Register tools without running them/);
  assert.match(pageText, /Keep reusable prompts close to your agent/);
  assert.match(pageText, /Register exact credential files/);

  const forbidden = await fetch(new URL("api/config", fixture.ui.url));
  assert.equal(forbidden.status, 403);

  const response = await fetch(new URL("api/config", fixture.ui.url), { headers: apiHeaders(fixture.ui) });
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.config.sources.local.extensions, "**.json;**.ai.md");
  assert.deepEqual(payload.check.sources.local.extensions, [".json", ".ai.md"]);
  assert.equal(payload.check.tools.directories[0].recursive, true);
  assert.equal(payload.check.prompts.enabledCount, 2);
  assert.deepEqual(payload.check.prompts.entries[0].keywords, ["cinematic", "music video", "youtube", "feature length"]);
  assert.deepEqual(payload.check.secrets.files[0].fields, ["hostname", "password"]);
  assert.doesNotMatch(JSON.stringify(payload), /ui-fixture-password/);
});

test("configuration UI inspects and finds secret metadata without returning values", async (t) => {
  const fixture = await createUiFixture(t);
  const inspectResponse = await fetch(new URL("api/inspect-secret", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ name: "ui-ftp", path: fixture.secretPath, format: "auto" })
  });
  const inspected = await inspectResponse.json();
  assert.equal(inspectResponse.status, 200);
  assert.equal(inspected.secret.path, fixture.secretPath);
  assert.deepEqual(inspected.secret.fields, ["hostname", "password"]);
  assert.doesNotMatch(JSON.stringify(inspected), /ui-fixture-password/);

  const findResponse = await fetch(new URL("api/find-secret", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "hostname" })
  });
  const found = await findResponse.json();
  assert.equal(findResponse.status, 200);
  assert.equal(found.results[0].name, "ui-ftp");
  assert.equal(found.meta.sensitiveValuesReturned, false);
  assert.doesNotMatch(JSON.stringify(found), /ui-fixture-password/);
});

test("configuration UI requires every prompt query term across aliases and keywords, never body text", async (t) => {
  const fixture = await createUiFixture(t);
  const findResponse = await fetch(new URL("api/find-prompt", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "feature length" })
  });
  const found = await findResponse.json();
  assert.equal(findResponse.status, 200);
  assert.deepEqual(found.results.map((entry) => entry.name), ["youtube-mv"]);
  assert.deepEqual(found.results[0].matchedFields, ["keywords"]);
  assert.match(found.results[0].preview, /YouTube music video/);
  assert.equal(Object.hasOwn(found.results[0], "content"), false);
  assert.equal(found.meta.matchMode, "all-terms");

  const exactTermsResponse = await fetch(new URL("api/find-prompt", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "short mv" })
  });
  const exactTerms = await exactTermsResponse.json();
  assert.equal(exactTermsResponse.status, 200);
  assert.deepEqual(exactTerms.results.map((entry) => entry.name), ["short mv"]);

  const bodyOnlyResponse = await fetch(new URL("api/find-prompt", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "deliberate pacing" })
  });
  const bodyOnly = await bodyOnlyResponse.json();
  assert.equal(bodyOnly.results.length, 0);
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

test("native picker dialogs use a topmost owner window", () => {
  for (const kind of ["directory", "file", "secret-file"]) {
    const script = createNativePickerScript(kind);
    assert.match(script, /\$owner\.TopMost = \$true/);
    assert.match(script, /\$owner\.BringToFront\(\)/);
    assert.match(script, /ShowDialog\(\$owner\)/);
    assert.match(script, /\$owner\.Dispose\(\)/);
  }
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

test("configuration UI saves disabled states across every tab", async (t) => {
  const fixture = await createUiFixture(t);
  const nextConfig = structuredClone(fixture.config);
  nextConfig.sources.local.roots[0].enabled = false;
  nextConfig.sources.local.files.push({ path: fixture.exactFile, enabled: false });
  nextConfig.tools.directories[0].enabled = false;
  nextConfig.tools.files.push({ name: "disabled-ffprobe", path: fixture.toolPath, priority: 100, enabled: false });
  nextConfig.secrets.files[0].enabled = false;
  nextConfig.prompts[0].enabled = false;

  const saveResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: nextConfig })
  });
  const savePayload = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(savePayload.ok, true);

  const saved = JSON.parse(await fs.readFile(fixture.configPath, "utf8"));
  assert.equal(saved.sources.local.roots[0].enabled, false);
  assert.equal(saved.sources.local.files[0].enabled, false);
  assert.equal(saved.tools.directories[0].enabled, false);
  assert.equal(saved.tools.files[0].enabled, false);
  assert.equal(saved.secrets.files[0].enabled, false);
  assert.equal(saved.prompts[0].enabled, false);
  assert.equal(savePayload.check.sources.local.roots[0].available, null);
  assert.equal(savePayload.check.sources.local.files[0].available, null);
  assert.equal(savePayload.check.tools.directories[0].available, null);
  assert.equal(savePayload.check.tools.files[0].available, null);
  assert.equal(savePayload.check.secrets.files[0].available, null);
  assert.equal(savePayload.check.prompts.entries[0].enabled, false);

  const searchResponse = await fetch(new URL("api/search", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "ui shell target", source: "local" })
  });
  const toolResponse = await fetch(new URL("api/find-tool", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "ffprobe" })
  });
  const secretResponse = await fetch(new URL("api/find-secret", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "hostname" })
  });
  const promptResponse = await fetch(new URL("api/find-prompt", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "feature length" })
  });
  assert.equal((await searchResponse.json()).results.length, 0);
  assert.equal((await toolResponse.json()).results.length, 0);
  assert.equal((await secretResponse.json()).results.length, 0);
  assert.equal((await promptResponse.json()).results.length, 0);
});
