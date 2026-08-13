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
  const systemTemporaryRoot = await fs.realpath(os.tmpdir());
  const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-doc-ui-test-"));
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
    instructions: {
      documents: "Use the configured document grants only.\nAsk before publishing.",
      tools: "Use the configured tool grants only.\nAsk before publishing.",
      prompts: "Use the configured prompt grants only.\nAsk before publishing.",
      secrets: "Use the configured secret grants only.\nAsk before publishing."
    },
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
    const resolvedSystemTemp = systemTemporaryRoot;
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
  const styles = await fetch(new URL("styles.css", fixture.ui.url));
  assert.equal(styles.status, 200);
  const stylesText = await styles.text();
  const app = await fetch(new URL("app.js", fixture.ui.url));
  assert.equal(app.status, 200);
  const appText = await app.text();
  assert.match(pageText, /Agent Docs &amp; Tools configuration/);
  assert.match(stylesText, /\.shell\s*\{[\s\S]*?width:\s*calc\(100%\s*-\s*32px\)/);
  assert.match(stylesText, /\.catalog-instruction-panel\s*\{/);
  assert.match(stylesText, /\.catalog-workspace\s*\{/);
  assert.match(stylesText, /\.button\.action-import/);
  assert.match(stylesText, /\.button\.action-test/);
  assert.match(stylesText, /\.button\.action-validate/);
  assert.match(stylesText, /\.button\.action-danger/);
  assert.match(stylesText, /\.instruction-disclosure/);
  assert.match(stylesText, /\.prompt-workspace-grid/);
  assert.match(stylesText, /\.prompt-editor-panel/);
  assert.match(stylesText, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(pageText, /human-readme-panel|README for every catalog|human-note/);
  for (const [catalog, method] of [["documents", "list"], ["tools", "list_tool"], ["prompts", "list_prompt"], ["secrets", "list_secret"]]) {
    assert.match(pageText, new RegExp(`id="${catalog}-instruction"[^>]*maxlength="5000"`));
    assert.match(pageText, new RegExp(`id="${catalog}-instruction-summary"`));
    assert.match(pageText, new RegExp(`${catalog.toUpperCase()} · ${method.toUpperCase()}`));
  }
  assert.match(pageText, /id="documents-panel" class="tab-panel catalog-workspace documents-workspace"/);
  assert.match(pageText, /id="tools-panel" class="tab-panel catalog-workspace"/);
  assert.match(pageText, /id="secrets-panel" class="tab-panel catalog-workspace"/);
  assert.ok(pageText.indexOf('id="documents-instruction"') > pageText.indexOf('id="documents-panel"'));
  assert.ok(pageText.indexOf('id="tools-instruction"') > pageText.indexOf('id="tools-panel"'));
  assert.ok(pageText.indexOf('id="prompts-instruction"') > pageText.indexOf('id="prompts-panel"'));
  assert.ok(pageText.indexOf('id="secrets-instruction"') > pageText.indexOf('id="secrets-panel"'));
  assert.match(appText, /documentsInstruction:\s*document\.querySelector\("#documents-instruction"\)/);
  assert.match(appText, /toolsInstruction:\s*document\.querySelector\("#tools-instruction"\)/);
  assert.match(appText, /promptsInstruction:\s*document\.querySelector\("#prompts-instruction"\)/);
  assert.match(appText, /secretsInstruction:\s*document\.querySelector\("#secrets-instruction"\)/);
  assert.match(appText, /next\.instructions\s*=\s*\{/);
  assert.doesNotMatch(appText, /humanReadmePanel|elements\.humanNote/);
  assert.doesNotMatch(appText, /\bnoteInput\b/);
  assert.match(pageText, /id="prompts-tab" class="tab is-active"/);
  assert.ok(pageText.indexOf('id="prompts-tab"') < pageText.indexOf('id="documents-tab"'));
  assert.ok(pageText.indexOf('id="secrets-tab"') < pageText.indexOf('id="help-tab"'));
  assert.match(pageText, /id="help-tab"[^>]*aria-controls="help-panel"/);
  assert.match(pageText, /id="help-tab" class="tab tab-utility"/);
  assert.match(pageText, /id="help-panel"[^>]*aria-labelledby="help-tab"[^>]*hidden/);
  assert.match(appText, /helpTab:\s*document\.querySelector\("#help-tab"\)/);
  assert.match(appText, /helpPanel:\s*document\.querySelector\("#help-panel"\)/);
  assert.match(appText, /const tabOrder = \["prompts", "documents", "tools", "secrets", "help"\]/);
  assert.match(pageText, /data-field="keywords"/);
  assert.match(pageText, /id="prompt-catalog-filter"/);
  assert.match(pageText, /id="prompt-status-filter"/);
  assert.match(pageText, /id="prompt-editor-panel"/);
  assert.match(pageText, /id="prompt-editor-content"/);
  assert.match(pageText, /data-action="select"/);
  assert.match(pageText, /<textarea data-field="content" hidden><\/textarea>/);
  assert.match(appText, /selectedPromptId:\s*null/);
  assert.match(appText, /function updatePromptCatalog\(\)/);
  assert.match(appText, /function syncPromptEditor\(\)/);
  assert.match(pageText, /Drop from File Explorer/);
  const toolsPanelText = pageText.slice(pageText.indexOf('id="tools-panel"'), pageText.indexOf('id="prompts-panel"'));
  const promptsPanelText = pageText.slice(pageText.indexOf('id="prompts-panel"'), pageText.indexOf('id="secrets-panel"'));
  const secretsPanelText = pageText.slice(pageText.indexOf('id="secrets-panel"'), pageText.indexOf('id="help-panel"'));
  const helpPanelText = pageText.slice(pageText.indexOf('id="help-panel"'), pageText.indexOf("</main>"));
  assert.doesNotMatch(toolsPanelText, /TOOL HELP/);
  assert.doesNotMatch(promptsPanelText, /PROMPT HELP/);
  assert.doesNotMatch(secretsPanelText, /SECRET HELP/);
  assert.match(helpPanelText, /PROMPT HELP/);
  assert.match(helpPanelText, /DOCUMENT HELP/);
  assert.match(helpPanelText, /TOOL HELP/);
  assert.match(helpPanelText, /SECRET HELP/);
  assert.match(helpPanelText, /Use reusable prompts safely/);
  assert.match(helpPanelText, /Search only approved local documents/);
  assert.match(helpPanelText, /Discover tools before running them/);
  assert.match(helpPanelText, /Grant exact credential files carefully/);
  assert.match(helpPanelText, /<code>list<\/code> inventories enabled grants/);
  assert.doesNotMatch(pageText, /Register tools without running them/);
  assert.doesNotMatch(pageText, /Keep reusable prompts close to your agent/);
  assert.doesNotMatch(pageText, /Register exact credential files/);
  assert.match(pageText, /Document name or alias/);
  assert.match(pageText, /id="max-matches-per-file"/);
  assert.match(pageText, /Separate patterns with semicolons/);
  assert.match(pageText, /id="validate-paths"/);
  assert.match(pageText, /Validate paths/);
  assert.match(pageText, /id="ignore-file-state"/);
  assert.match(pageText, /data-action="scan-tool"/);
  assert.match(pageText, /data-action="scan-document"/);
  assert.match(pageText, /data-role="scan-results"/);
  assert.match(pageText, /data-role="tool-scan-result-content"/);
  assert.match(pageText, /data-role="document-scan-result-content"/);
  assert.match(pageText, /data-role="folder-instruction"/);
  assert.match(pageText, /Folder Instruction/);
  assert.match(pageText, /Saved with this folder and returned as its <code>instruction<\/code> by/);
  assert.match(pageText, /data-field="recursive"/);
  assert.doesNotMatch(pageText, /UI preview only for now/);
  assert.doesNotMatch(pageText, /Scan results for this folder/);
  assert.doesNotMatch(pageText, /Scan Tool results/);
  assert.doesNotMatch(pageText, /Scan Document results/);
  assert.match(pageText, /Options &amp; scans/);

  const forbidden = await fetch(new URL("api/config", fixture.ui.url));
  assert.equal(forbidden.status, 403);

  const response = await fetch(new URL("api/config", fixture.ui.url), { headers: apiHeaders(fixture.ui) });
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.config.instructions, fixture.config.instructions);
  assert.equal(payload.config.sources.local.extensions, "**.json;**.ai.md");
  assert.deepEqual(payload.check.sources.local.extensions, [".json", ".ai.md"]);
  assert.equal(payload.check.tools.directories[0].recursive, true);
  assert.equal(payload.check.prompts.enabledCount, 2);
  assert.deepEqual(payload.check.prompts.entries[0].keywords, ["cinematic", "music video", "youtube", "feature length"]);
  assert.deepEqual(payload.check.secrets.files[0].fields, ["hostname", "password"]);
  assert.doesNotMatch(JSON.stringify(payload), /ui-fixture-password/);
});

test("configuration UI validates saved and unsaved paths without modifying configuration", async (t) => {
  const fixture = await createUiFixture(t);
  const missingFile = path.join(path.dirname(fixture.configPath), "missing-document.txt");
  const missingDirectory = path.join(path.dirname(fixture.configPath), "missing-disabled-directory");
  const configBefore = await fs.readFile(fixture.configPath, "utf8");

  const response = await fetch(new URL("api/validate-paths", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({
      entries: [
        { id: "document-directory", kind: "directory", path: fixture.docsRoot, enabled: true },
        { id: "document-file", kind: "file", path: fixture.exactFile, enabled: true },
        { id: "wrong-directory-type", kind: "directory", path: fixture.exactFile, enabled: true },
        { id: "wrong-file-type", kind: "file", path: fixture.docsRoot, enabled: true },
        { id: "missing-file", kind: "file", path: missingFile, enabled: true },
        { id: "disabled-missing-directory", kind: "directory", path: missingDirectory, enabled: false },
        { id: "unsaved-relative-file", kind: "file", path: path.basename(fixture.exactFile), enabled: true },
        { id: "empty-file", kind: "file", path: "", enabled: true }
      ]
    })
  });
  const payload = await response.json();
  const entries = new Map(payload.entries.map((entry) => [entry.id, entry]));

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.summary, {
    total: 8,
    valid: 3,
    invalid: 5,
    enabledInvalid: 4,
    disabledInvalid: 1
  });
  assert.equal(entries.get("document-directory").valid, true);
  assert.equal(entries.get("document-directory").actualType, "directory");
  assert.equal(entries.get("document-file").valid, true);
  assert.equal(entries.get("wrong-directory-type").code, "PATH_TYPE_MISMATCH");
  assert.equal(entries.get("wrong-directory-type").actualType, "file");
  assert.equal(entries.get("wrong-file-type").code, "PATH_TYPE_MISMATCH");
  assert.equal(entries.get("wrong-file-type").actualType, "directory");
  assert.equal(entries.get("missing-file").code, "PATH_UNAVAILABLE");
  assert.equal(entries.get("disabled-missing-directory").enabled, false);
  assert.equal(entries.get("disabled-missing-directory").valid, false);
  assert.equal(entries.get("unsaved-relative-file").valid, true);
  assert.equal(entries.get("unsaved-relative-file").path, fixture.exactFile);
  assert.equal(entries.get("empty-file").code, "PATH_EMPTY");
  assert.equal(await fs.readFile(fixture.configPath, "utf8"), configBefore);

  const duplicateResponse = await fetch(new URL("api/validate-paths", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({
      entries: [
        { id: "duplicate", kind: "file", path: fixture.exactFile },
        { id: "duplicate", kind: "directory", path: fixture.docsRoot }
      ]
    })
  });
  const duplicatePayload = await duplicateResponse.json();
  assert.equal(duplicateResponse.status, 400);
  assert.equal(duplicatePayload.error.code, "UI_PATH_ENTRY_ID_DUPLICATE");
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

test("configuration UI scans attached folders by matching rules, bypasses global ignores, and caps only after a 101st match", async (t) => {
  const fixture = await createUiFixture(t);
  const scanRoot = path.join(path.dirname(fixture.configPath), "attached scan folder");
  const toolDirectory = path.join(scanRoot, "bin");
  const documentDirectory = path.join(scanRoot, "docs");
  const readmePath = path.join(scanRoot, "README.md");
  const apiPath = path.join(documentDirectory, "api.md");
  const rootToolPath = path.join(scanRoot, "root-tool.exe");
  await fs.mkdir(toolDirectory, { recursive: true });
  await fs.mkdir(documentDirectory, { recursive: true });
  await fs.writeFile(readmePath, "Attached folder readme.\n", "utf8");
  await fs.writeFile(apiPath, "Nested attached folder documentation.\n", "utf8");
  await fs.writeFile(rootToolPath, "fixture\n", "utf8");
  await Promise.all(Array.from({ length: 99 }, (_unused, index) => (
    fs.writeFile(path.join(toolDirectory, `tool-${String(index).padStart(3, "0")}.exe`), "fixture\n", "utf8")
  )));

  const draftConfig = structuredClone(fixture.config);
  draftConfig.tools.directories = [{
    name: "attached-scan-folder",
    path: scanRoot,
    priority: 100,
    recursive: false,
    includeDocs: false,
    enabled: true
  }];
  draftConfig.tools.extensions = ".exe";
  draftConfig.sources.local.extensions = ".md";
  draftConfig.sources.local.fileNames = ["README.md"];
  draftConfig.ignore = ["bin/", "docs/"];
  draftConfig.limits.maxFiles = 1_000;
  draftConfig.limits.timeoutMs = 5_000;
  const configBefore = await fs.readFile(fixture.configPath, "utf8");

  const toolResponse = await fetch(new URL("api/scan-attached-folder", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ kind: "tool", directoryPath: scanRoot, config: draftConfig })
  });
  const toolPayload = await toolResponse.json();
  assert.equal(toolResponse.status, 200);
  assert.equal(toolPayload.ok, true);
  assert.equal(toolPayload.meta.recursive, false);
  assert.equal(toolPayload.meta.resultLimit, 100);
  assert.deepEqual(toolPayload.results.map((entry) => entry.path), [rootToolPath]);
  assert.equal(toolPayload.meta.hasMore, false);
  assert.equal(toolPayload.meta.truncated, false);
  assert.ok(toolPayload.results.every((entry) => path.isAbsolute(entry.path) && entry.path.endsWith(".exe")));

  const documentResponse = await fetch(new URL("api/scan-attached-folder", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ kind: "document", directoryPath: scanRoot, config: draftConfig })
  });
  const documentPayload = await documentResponse.json();
  assert.equal(documentResponse.status, 200);
  assert.equal(documentPayload.meta.recursive, false);
  assert.deepEqual(documentPayload.results.map((entry) => entry.path), [readmePath]);

  draftConfig.tools.directories[0].recursive = true;
  const recursiveToolResponse = await fetch(new URL("api/scan-attached-folder", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ kind: "tool", directoryPath: scanRoot, config: draftConfig })
  });
  const recursiveToolPayload = await recursiveToolResponse.json();
  assert.equal(recursiveToolResponse.status, 200);
  assert.equal(recursiveToolPayload.meta.recursive, true);
  assert.equal(recursiveToolPayload.results.length, 100);
  assert.equal(recursiveToolPayload.meta.hasMore, false);
  assert.equal(recursiveToolPayload.meta.truncated, false);
  assert.ok(recursiveToolPayload.results.some((entry) => entry.path === rootToolPath));
  assert.ok(recursiveToolPayload.results.some((entry) => entry.path === path.join(toolDirectory, "tool-000.exe")));

  const recursiveDocumentResponse = await fetch(new URL("api/scan-attached-folder", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ kind: "document", directoryPath: scanRoot, config: draftConfig })
  });
  const recursiveDocumentPayload = await recursiveDocumentResponse.json();
  assert.equal(recursiveDocumentResponse.status, 200);
  assert.equal(recursiveDocumentPayload.meta.recursive, true);
  assert.deepEqual(new Set(recursiveDocumentPayload.results.map((entry) => entry.path)), new Set([readmePath, apiPath]));

  await fs.writeFile(path.join(toolDirectory, "tool-099.exe"), "fixture\n", "utf8");
  const limitedResponse = await fetch(new URL("api/scan-attached-folder", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ kind: "tool", directoryPath: scanRoot, config: draftConfig })
  });
  const limitedPayload = await limitedResponse.json();
  assert.equal(limitedResponse.status, 200);
  assert.equal(limitedPayload.results.length, 100);
  assert.equal(limitedPayload.meta.hasMore, true);
  assert.equal(limitedPayload.meta.truncated, true);
  assert.ok(limitedPayload.warnings.some((warning) => warning.code === "SCAN_RESULT_LIMIT_REACHED"));
  assert.equal(await fs.readFile(fixture.configPath, "utf8"), configBefore);

  const unattachedResponse = await fetch(new URL("api/scan-attached-folder", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({
      kind: "tool",
      directoryPath: path.join(path.dirname(fixture.configPath), "not-attached"),
      config: draftConfig
    })
  });
  const unattachedPayload = await unattachedResponse.json();
  assert.equal(unattachedResponse.status, 400);
  assert.equal(unattachedPayload.error.code, "UI_SCAN_DIRECTORY_NOT_ATTACHED");
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
  nextConfig.instructions.tools = "Prefer local tools.\n\nAsk before publishing.";
  nextConfig.sources.local.fileNames.push("AGENTS.md");
  nextConfig.limits.maxResults = 25;
  await Promise.all(Array.from({ length: 21 }, (_unused, index) => (
    fs.writeFile(
      path.join(fixture.docsRoot, `ui-target-${index + 1}.ai.md`),
      `<img alt="UI shell search target ${index + 1}">\n`,
      "utf8"
    )
  )));

  const saveResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: nextConfig })
  });
  const savePayload = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(savePayload.ok, true);
  assert.equal(savePayload.backupCreated, true);
  const savedConfig = JSON.parse(await fs.readFile(fixture.configPath, "utf8"));
  const backupConfig = JSON.parse(await fs.readFile(`${fixture.configPath}.bak`, "utf8"));
  assert.deepEqual(savedConfig.instructions, nextConfig.instructions);
  assert.deepEqual(backupConfig.instructions, fixture.config.instructions);
  assert.equal(savedConfig.sources.local.fileNames.at(-1), "AGENTS.md");
  assert.equal(backupConfig.sources.local.fileNames.at(-1), "README.md");

  const searchResponse = await fetch(new URL("api/search", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "ui shell target", source: "local" })
  });
  const searchPayload = await searchResponse.json();
  assert.equal(searchPayload.ok, true);
  assert.equal(searchPayload.results[0].path, path.join(fixture.docsRoot, "workflow.json"));
  assert.equal(searchPayload.results.length, 22);
  assert.equal(searchPayload.meta.truncated, false);
  assert.equal(searchPayload.meta.resultUnit, "file");
  assert.equal(searchPayload.results[0].returnedMatchCount, 1);

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

test("configuration UI rejects an over-limit catalog Instruction without replacing the saved configuration", async (t) => {
  const fixture = await createUiFixture(t);
  const configBefore = await fs.readFile(fixture.configPath, "utf8");
  const nextConfig = structuredClone(fixture.config);
  nextConfig.instructions.tools = "x".repeat(5_001);

  const response = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: nextConfig })
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "CONFIG_SCHEMA_INVALID");
  assert.ok(payload.error.details.issues.some((issue) => issue.path === "instructions.tools"));
  assert.equal(await fs.readFile(fixture.configPath, "utf8"), configBefore);
});

test("configuration UI saves disabled states across every tab", async (t) => {
  const fixture = await createUiFixture(t);
  const nextConfig = structuredClone(fixture.config);
  nextConfig.sources.local.roots[0].enabled = false;
  nextConfig.sources.local.files.push({ name: "disabled-exact-document", path: fixture.exactFile, enabled: false });
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
  assert.equal(saved.sources.local.files[0].name, "disabled-exact-document");
  assert.equal(saved.tools.directories[0].enabled, false);
  assert.equal(saved.tools.files[0].enabled, false);
  assert.equal(saved.secrets.files[0].enabled, false);
  assert.equal(saved.prompts[0].enabled, false);
  assert.equal(savePayload.check.sources.local.roots[0].available, null);
  assert.equal(savePayload.check.sources.local.files[0].available, null);
  assert.equal(savePayload.check.sources.local.files[0].name, "disabled-exact-document");
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

test("configuration UI saves a Folder Instruction and selected scanned tool and document grants", async (t) => {
  const fixture = await createUiFixture(t);
  const scannedToolPath = path.join(fixture.docsRoot, "generate_video.py");
  const scannedDocumentPath = path.join(fixture.docsRoot, "custom-tool.md");
  await Promise.all([
    fs.writeFile(scannedToolPath, "print('custom generator')\n", "utf8"),
    fs.writeFile(scannedDocumentPath, "Custom tool guide marker.\n", "utf8")
  ]);

  const nextConfig = structuredClone(fixture.config);
  nextConfig.tools.directories[0].instruction = "This folder contains custom media utilities.";
  nextConfig.tools.directories[0].scannedToolFiles = [{
    name: "ui-tools-generate-video",
    path: scannedToolPath,
    priority: 325,
    enabled: true
  }];
  nextConfig.tools.directories[0].scannedDocumentFiles = [{
    name: "ui-tools-custom-guide",
    path: scannedDocumentPath,
    enabled: true
  }];

  const saveResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: nextConfig })
  });
  const savePayload = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(savePayload.ok, true);

  const saved = JSON.parse(await fs.readFile(fixture.configPath, "utf8"));
  assert.equal(saved.tools.directories[0].instruction, "This folder contains custom media utilities.");
  assert.deepEqual(saved.tools.directories[0].scannedToolFiles, [{
    name: "ui-tools-generate-video",
    path: scannedToolPath,
    priority: 325,
    enabled: true
  }]);
  assert.deepEqual(saved.tools.directories[0].scannedDocumentFiles, [{
    name: "ui-tools-custom-guide",
    path: scannedDocumentPath,
    enabled: true
  }]);

  const searchResponse = await fetch(new URL("api/search", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({
      query: "custom tool guide",
      source: "local",
      directories: [],
      files: ["ui-tools-custom-guide"]
    })
  });
  const searchPayload = await searchResponse.json();
  assert.equal(searchResponse.status, 200);
  assert.deepEqual(searchPayload.results.map((entry) => entry.path), [scannedDocumentPath]);

  const toolResponse = await fetch(new URL("api/find-tool", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "generate video" })
  });
  const toolPayload = await toolResponse.json();
  assert.equal(toolResponse.status, 200);
  assert.ok(toolPayload.results.some((entry) => (
    entry.name === "ui-tools-generate-video"
    && entry.path === scannedToolPath
    && entry.priority === 325
  )));
});

test("configuration API accepts selected document grant names without broadening", async (t) => {
  const fixture = await createUiFixture(t);
  const nextConfig = structuredClone(fixture.config);
  nextConfig.sources.local.files.push({
    name: "ui-exact-document",
    path: fixture.exactFile,
    enabled: true
  });
  const saveResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: nextConfig })
  });
  assert.equal(saveResponse.status, 200);

  const searchResponse = await fetch(new URL("api/search", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({
      query: "dropped exact fixture",
      directories: [],
      files: ["UI-EXACT-DOCUMENT"]
    })
  });
  const searchPayload = await searchResponse.json();
  assert.equal(searchResponse.status, 200);
  assert.equal(searchPayload.scope.mode, "selected");
  assert.deepEqual(searchPayload.scope.directories, []);
  assert.deepEqual(searchPayload.scope.files, [{
    name: "ui-exact-document",
    path: fixture.exactFile
  }]);
  assert.deepEqual(searchPayload.results.map((entry) => entry.path), [fixture.exactFile]);

  const invalidResponse = await fetch(new URL("api/search", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ query: "error", directories: "ui-fixture" })
  });
  const invalidPayload = await invalidResponse.json();
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidPayload.error.code, "SEARCH_SCOPE_INVALID");
});

test("configuration API rejects ambiguous document grant identifiers", async (t) => {
  const fixture = await createUiFixture(t);
  const duplicateDirectoryConfig = structuredClone(fixture.config);
  duplicateDirectoryConfig.sources.local.roots.push({
    name: "UI-FIXTURE",
    path: fixture.docsRoot,
    priority: 50
  });
  const directoryResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: duplicateDirectoryConfig })
  });
  const directoryPayload = await directoryResponse.json();
  assert.equal(directoryResponse.status, 400);
  assert.equal(directoryPayload.error.code, "CONFIG_DOCUMENT_DIRECTORY_NAME_DUPLICATE");

  const duplicateFileConfig = structuredClone(fixture.config);
  duplicateFileConfig.sources.local.files.push(
    { name: "first-exact", path: fixture.exactFile },
    { name: "FIRST-EXACT", path: path.join(fixture.docsRoot, "workflow.json") }
  );
  const fileResponse = await fetch(new URL("api/config", fixture.ui.url), {
    method: "POST",
    headers: apiHeaders(fixture.ui, true),
    body: JSON.stringify({ config: duplicateFileConfig })
  });
  const filePayload = await fileResponse.json();
  assert.equal(fileResponse.status, 400);
  assert.equal(filePayload.error.code, "CONFIG_DOCUMENT_FILE_NAME_DUPLICATE");
});
