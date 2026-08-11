import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkConfiguration, fetchDocument, searchDocuments } from "../src/search-service.mjs";
import { findSecrets, readSecret } from "../src/secret-service.mjs";
import { findTools } from "../src/tool-service.mjs";

async function createFixture(t) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-entry-toggle-test-"));
  const enabledDocs = path.join(temporaryRoot, "enabled-docs");
  const disabledDocs = path.join(temporaryRoot, "disabled-docs");
  const enabledTools = path.join(temporaryRoot, "enabled-tools");
  const disabledTools = path.join(temporaryRoot, "disabled-tools");
  await Promise.all([
    fs.mkdir(enabledDocs, { recursive: true }),
    fs.mkdir(disabledDocs, { recursive: true }),
    fs.mkdir(enabledTools, { recursive: true }),
    fs.mkdir(disabledTools, { recursive: true })
  ]);

  const enabledDocument = path.join(enabledDocs, "README.md");
  const disabledRootDocument = path.join(disabledDocs, "README.md");
  const enabledExactDocument = path.join(temporaryRoot, "enabled-exact.txt");
  const disabledExactDocument = path.join(temporaryRoot, "disabled-exact.txt");
  const enabledTool = path.join(enabledTools, "enabled-helper.exe");
  const disabledTool = path.join(disabledTools, "disabled-helper.exe");
  const disabledToolReadme = path.join(disabledTools, "README.md");
  const enabledExactTool = path.join(temporaryRoot, "enabled-exact-tool.py");
  const disabledExactTool = path.join(temporaryRoot, "disabled-exact-tool.py");
  const enabledSecret = path.join(temporaryRoot, "enabled-secret.txt");
  const disabledSecret = path.join(temporaryRoot, "disabled-secret.txt");
  const missingPath = path.join(temporaryRoot, "does-not-exist");

  await Promise.all([
    fs.writeFile(enabledDocument, "Enabled document marker.\n", "utf8"),
    fs.writeFile(disabledRootDocument, "Disabled root marker.\n", "utf8"),
    fs.writeFile(enabledExactDocument, "Enabled exact marker.\n", "utf8"),
    fs.writeFile(disabledExactDocument, "Disabled exact marker.\n", "utf8"),
    fs.writeFile(enabledTool, "fixture\n", "utf8"),
    fs.writeFile(disabledTool, "fixture\n", "utf8"),
    fs.writeFile(disabledToolReadme, "Disabled tool documentation marker.\n", "utf8"),
    fs.writeFile(enabledExactTool, "print('enabled')\n", "utf8"),
    fs.writeFile(disabledExactTool, "print('disabled')\n", "utf8"),
    fs.writeFile(enabledSecret, "hostname=enabled.example.test\npassword=enabled-value\n", "utf8"),
    fs.writeFile(disabledSecret, "hostname=disabled.example.test\npassword=disabled-value\n", "utf8")
  ]);

  const configPath = path.join(temporaryRoot, "search.config.json");
  await fs.writeFile(configPath, `${JSON.stringify({
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [
          { name: "enabled-docs", path: enabledDocs, priority: 100, enabled: true },
          { name: "disabled-docs", path: disabledDocs, priority: 100, enabled: false },
          { name: "disabled-missing-docs", path: missingPath, priority: 100, enabled: false }
        ],
        extensions: ".md;.txt",
        fileNames: ["README.md"],
        files: [
          { path: enabledExactDocument, enabled: true },
          { path: disabledExactDocument, enabled: false },
          { path: `${missingPath}.txt`, enabled: false }
        ]
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [
        { name: "enabled-tools", path: enabledTools, priority: 100, recursive: true, includeDocs: true, enabled: true },
        { name: "disabled-tools", path: disabledTools, priority: 100, recursive: true, includeDocs: true, enabled: false },
        { name: "disabled-missing-tools", path: missingPath, priority: 100, recursive: true, includeDocs: true, enabled: false }
      ],
      files: [
        { name: "enabled-exact-tool", path: enabledExactTool, priority: 100, enabled: true },
        { name: "disabled-exact-tool", path: disabledExactTool, priority: 100, enabled: false },
        { name: "disabled-missing-tool", path: `${missingPath}.py`, priority: 100, enabled: false }
      ],
      extensions: ".exe;.py"
    },
    secrets: {
      files: [
        { name: "enabled-secret", path: enabledSecret, format: "env", enabled: true },
        { name: "disabled-secret", path: disabledSecret, format: "env", enabled: false },
        { name: "disabled-missing-secret", path: `${missingPath}.env`, format: "env", enabled: false }
      ],
      maxFileBytes: 100_000
    },
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxLineChars: 1_000,
      maxFileBytes: 100_000,
      maxFetchBytes: 100_000,
      maxFiles: 1_000,
      timeoutMs: 5_000
    }
  }, null, 2)}\n`, "utf8");

  t.after(async () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = path.resolve(os.tmpdir());
    const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });

  return {
    configPath,
    disabledExactDocument,
    disabledSecret,
    enabledExactDocument
  };
}

test("disabled document grants are neither searched nor fetched", async (t) => {
  const fixture = await createFixture(t);

  const enabledRoot = await searchDocuments({ query: "enabled document marker", source: "local" }, { configPath: fixture.configPath });
  const enabledExact = await searchDocuments({ query: "enabled exact marker", source: "local" }, { configPath: fixture.configPath });
  const disabledRoot = await searchDocuments({ query: "disabled root marker", source: "local" }, { configPath: fixture.configPath });
  const disabledExact = await searchDocuments({ query: "disabled exact marker", source: "local" }, { configPath: fixture.configPath });
  const disabledToolDocs = await searchDocuments({ query: "disabled tool documentation", source: "local" }, { configPath: fixture.configPath });

  assert.equal(enabledRoot.results.length, 1);
  assert.equal(enabledExact.results[0].path, fixture.enabledExactDocument);
  assert.equal(disabledRoot.results.length, 0);
  assert.equal(disabledExact.results.length, 0);
  assert.equal(disabledToolDocs.results.length, 0);
  await assert.rejects(
    fetchDocument({ path: fixture.disabledExactDocument, source: "local" }, { configPath: fixture.configPath }),
    (error) => error?.code === "FETCH_PATH_NOT_ALLOWED"
  );
});

test("disabled tool grants are excluded before discovery", async (t) => {
  const fixture = await createFixture(t);

  const enabledDirectory = await findTools({ query: "enabled helper" }, { configPath: fixture.configPath });
  const enabledExact = await findTools({ query: "enabled exact tool" }, { configPath: fixture.configPath });
  const disabledDirectory = await findTools({ query: "disabled helper" }, { configPath: fixture.configPath });
  const disabledExact = await findTools({ query: "disabled exact tool" }, { configPath: fixture.configPath });

  assert.ok(enabledDirectory.results.some((entry) => entry.name === "enabled-helper.exe"));
  assert.ok(enabledExact.results.some((entry) => entry.name === "enabled-exact-tool"));
  assert.ok(disabledDirectory.results.every((entry) => entry.name !== "disabled-helper.exe"));
  assert.ok(disabledExact.results.every((entry) => entry.name !== "disabled-exact-tool"));
  assert.equal(enabledDirectory.meta.directoriesEnabled, 1);
  assert.equal(enabledDirectory.meta.directoriesDisabled, 2);
  assert.equal(enabledDirectory.meta.exactFilesEnabled, 1);
  assert.equal(enabledDirectory.meta.exactFilesDisabled, 2);
});

test("disabled secrets cannot be discovered or read and remain protected", async (t) => {
  const fixture = await createFixture(t);

  const found = await findSecrets({ query: "hostname" }, { configPath: fixture.configPath });
  assert.deepEqual(found.results.map((entry) => entry.name), ["enabled-secret"]);
  assert.equal(found.meta.secretFilesEnabled, 1);
  assert.equal(found.meta.secretFilesDisabled, 2);
  await assert.rejects(
    readSecret({ secret: "disabled-secret", keys: ["hostname"] }, { configPath: fixture.configPath }),
    (error) => error?.code === "SECRET_DISABLED"
  );
  await assert.rejects(
    fetchDocument({ path: fixture.disabledSecret, source: "local" }, { configPath: fixture.configPath }),
    (error) => error?.code === "FETCH_PATH_PROTECTED"
  );
});

test("configuration checks retain disabled entries without probing missing paths", async (t) => {
  const fixture = await createFixture(t);
  const checked = await checkConfiguration({ configPath: fixture.configPath });

  const disabledRoot = checked.sources.local.roots.find((entry) => entry.name === "disabled-missing-docs");
  const disabledDocument = checked.sources.local.files.find((entry) => entry.path.endsWith("does-not-exist.txt"));
  const disabledToolDirectory = checked.tools.directories.find((entry) => entry.name === "disabled-missing-tools");
  const disabledToolFile = checked.tools.files.find((entry) => entry.name === "disabled-missing-tool");
  const disabledSecret = checked.secrets.files.find((entry) => entry.name === "disabled-missing-secret");

  for (const entry of [disabledRoot, disabledDocument, disabledToolDirectory, disabledToolFile, disabledSecret]) {
    assert.equal(entry.enabled, false);
    assert.equal(entry.available, null);
    assert.equal(entry.type, "disabled");
    assert.equal(Object.hasOwn(entry, "error"), false);
  }
});
