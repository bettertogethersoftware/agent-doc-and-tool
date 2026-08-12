import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkConfiguration, fetchDocument, searchDocuments } from "../src/search-service.mjs";

async function createFixture(t) {
  const systemTemporaryRoot = await fs.realpath(os.tmpdir());
  const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-doc-search-test-"));
  const docsRoot = path.join(temporaryRoot, "docs");
  const ignoredRoot = path.join(docsRoot, "node_modules", "generic-tool");
  const generatedRoot = path.join(docsRoot, "generated");
  const copiesRoot = path.join(docsRoot, "copies");
  await fs.mkdir(ignoredRoot, { recursive: true });
  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.mkdir(copiesRoot, { recursive: true });

  const readmePath = path.join(docsRoot, "README.md");
  const aiPath = path.join(docsRoot, "workflow.ai.md");
  const jsonPath = path.join(docsRoot, "workflow.settings.json");
  const longJsonPath = path.join(docsRoot, "minified.json");
  const ignoredPath = path.join(ignoredRoot, "README.md");
  const ignoredJsonPath = path.join(generatedRoot, "ignored.json");
  const explicitPath = path.join(temporaryRoot, "special.instructions.txt");
  const outsidePath = path.join(temporaryRoot, "outside.txt");
  const rankedPath = path.join(docsRoot, "ranked.ai.md");
  const rankedCopyPath = path.join(copiesRoot, "ranked-copy.ai.md");
  const secondRankedPath = path.join(docsRoot, "second-ranked.ai.md");

  const readmeContent = "# Local workflow\r\nUse MiniMax H3 video for the verified local workflow.\r\n";
  await fs.writeFile(readmePath, readmeContent, "utf8");
  await fs.writeFile(aiPath, "The render checker validates every H3 output.\n", "utf8");
  await fs.writeFile(jsonPath, '{"description":"Orion JSON workflow configuration"}\n', "utf8");
  await fs.writeFile(longJsonPath, `{"padding":"${"x".repeat(2_000)}","description":"Nebula line sentinel"}\n`, "utf8");
  await fs.writeFile(ignoredPath, "MiniMax H3 video generic copy.\n", "utf8");
  await fs.writeFile(ignoredJsonPath, '{"description":"Quasar ignored JSON target"}\n', "utf8");
  await fs.writeFile(explicitPath, "Special Falcon tool instructions.\n", "utf8");
  await fs.writeFile(outsidePath, "This file is not allowlisted.\n", "utf8");
  const rankedContent = [
    '<img src="atlas.png" alt="Atlas Search Guide">',
    '[![Atlas Search Guide](https://img.shields.io/badge/Atlas-Search-blue)](https://example.test)',
    "# Atlas Guide for Search Workflows",
    "The verified Atlas guide explains this local search workflow."
  ].join("\n");
  await fs.writeFile(rankedPath, rankedContent, "utf8");
  await fs.writeFile(rankedCopyPath, rankedContent, "utf8");
  await fs.writeFile(secondRankedPath, "# Atlas Search Guide for the secondary workflow\n", "utf8");
  await fs.writeFile(path.join(temporaryRoot, ".agent-searchignore"), "node_modules/\nignored.json\n", "utf8");

  const configPath = path.join(temporaryRoot, "search.config.json");
  await fs.writeFile(configPath, JSON.stringify({
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [{ name: "fixture", path: docsRoot, priority: 100 }],
        extensions: "**.json;**.ai.md",
        fileNames: ["README.md"],
        files: [{ name: "falcon-instructions", path: explicitPath }]
      }
    },
    ignoreFile: ".agent-searchignore",
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxFileBytes: 100000,
      maxFetchBytes: 100000,
      maxFiles: 1000,
      timeoutMs: 5000
    }
  }, null, 2), "utf8");

  t.after(async () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = systemTemporaryRoot;
    const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });

  return {
    configPath,
    readmePath,
    readmeContent,
    jsonPath,
    longJsonPath,
    ignoredPath,
    ignoredJsonPath,
    explicitPath,
    outsidePath,
    rankedPath,
    rankedCopyPath,
    secondRankedPath
  };
}

async function createScopedFixture(t) {
  const systemTemporaryRoot = await fs.realpath(os.tmpdir());
  const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-doc-scope-test-"));
  const primaryRoot = path.join(temporaryRoot, "bts-logs");
  const secondaryRoot = path.join(temporaryRoot, "other-logs");
  const disabledRoot = path.join(temporaryRoot, "disabled-logs");
  const toolDocsRoot = path.join(temporaryRoot, "tool-docs");
  await Promise.all([
    fs.mkdir(primaryRoot, { recursive: true }),
    fs.mkdir(secondaryRoot, { recursive: true }),
    fs.mkdir(disabledRoot, { recursive: true }),
    fs.mkdir(toolDocsRoot, { recursive: true })
  ]);

  const primaryLog = path.join(primaryRoot, "primary.log");
  const secondaryLog = path.join(secondaryRoot, "secondary.log");
  const disabledLog = path.join(disabledRoot, "disabled.log");
  const exactLog = path.join(temporaryRoot, "MyWebViewPlugin.log");
  const disabledExactLog = path.join(temporaryRoot, "disabled-exact.log");
  const toolReadme = path.join(toolDocsRoot, "README.md");
  await Promise.all([
    fs.writeFile(primaryLog, "Scoped error marker from primary BTS logs.\n", "utf8"),
    fs.writeFile(secondaryLog, "Scoped error marker from an unrelated application.\n", "utf8"),
    fs.writeFile(disabledLog, "Scoped error marker from a disabled directory.\n", "utf8"),
    fs.writeFile(exactLog, "Scoped error marker from MyWebViewPlugin.\n", "utf8"),
    fs.writeFile(disabledExactLog, "Scoped error marker from a disabled exact file.\n", "utf8"),
    fs.writeFile(toolReadme, "Scoped error marker from implicit tool documentation.\n", "utf8")
  ]);

  const configPath = path.join(temporaryRoot, "search.config.json");
  await fs.writeFile(configPath, JSON.stringify({
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [
          { name: "bts-app-logs", path: primaryRoot, priority: 100, enabled: true },
          { name: "other-app-logs", path: secondaryRoot, priority: 50, enabled: true },
          { name: "disabled-app-logs", path: disabledRoot, priority: 25, enabled: false }
        ],
        extensions: ".log;.md",
        fileNames: ["README.md"],
        files: [
          { name: "bts-app-mywebviewplugin-log", path: exactLog, enabled: true },
          { name: "bts-app-overlap-log", path: primaryLog, enabled: true },
          { name: "disabled-exact-log", path: disabledExactLog, enabled: false }
        ]
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [
        {
          name: "scope-tools",
          path: toolDocsRoot,
          priority: 75,
          recursive: true,
          includeDocs: true,
          enabled: true
        }
      ],
      files: [],
      extensions: ".exe"
    },
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxFileBytes: 100_000,
      maxFetchBytes: 100_000,
      maxFiles: 1_000,
      timeoutMs: 5_000
    }
  }, null, 2), "utf8");

  t.after(async () => {
    const relative = path.relative(systemTemporaryRoot, temporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  });

  return {
    configPath,
    primaryRoot,
    primaryLog,
    secondaryLog,
    exactLog,
    disabledLog,
    disabledExactLog,
    toolReadme
  };
}

test("unscoped search preserves all-enabled behavior and reports its resolved scope", async (t) => {
  const fixture = await createScopedFixture(t);
  const result = await searchDocuments({ query: "scoped error marker" }, { configPath: fixture.configPath });

  assert.equal(result.scope.mode, "all-enabled");
  assert.deepEqual(result.scope.directories.map((entry) => entry.name), [
    "bts-app-logs",
    "tool:scope-tools",
    "other-app-logs"
  ]);
  assert.deepEqual(result.scope.files.map((entry) => entry.name), [
    "bts-app-mywebviewplugin-log",
    "bts-app-overlap-log"
  ]);
  assert.equal(result.meta.scopeMode, "all-enabled");
  assert.equal(result.meta.directoriesSelected, 3);
  assert.equal(result.meta.filesSelected, 2);
  assert.deepEqual(new Set(result.results.map((entry) => entry.path)), new Set([
    fixture.primaryLog,
    fixture.secondaryLog,
    fixture.exactLog,
    fixture.toolReadme
  ]));
  assert.ok(result.results.every((entry) => ["directory", "file"].includes(entry.grant.type)));
  assert.ok(result.results.every((entry) => ![fixture.disabledLog, fixture.disabledExactLog].includes(entry.path)));
});

test("directory-only scope resolves canonical names and excludes every other grant category", async (t) => {
  const fixture = await createScopedFixture(t);
  const result = await searchDocuments({
    query: "scoped error marker",
    directories: ["BTS-APP-LOGS", "bts-app-logs"]
  }, { configPath: fixture.configPath });

  assert.equal(result.scope.mode, "selected");
  assert.deepEqual(result.scope.directories, [{
    name: "bts-app-logs",
    path: fixture.primaryRoot,
    priority: 100
  }]);
  assert.deepEqual(result.scope.files, []);
  assert.deepEqual(result.results.map((entry) => entry.path), [fixture.primaryLog]);
  assert.deepEqual(result.results[0].grant, { type: "directory", name: "bts-app-logs" });
  assert.equal(result.meta.directoriesSelected, 1);
  assert.equal(result.meta.filesSelected, 0);
});

test("exact-file-only scope searches a named file outside every directory", async (t) => {
  const fixture = await createScopedFixture(t);
  const result = await searchDocuments({
    query: "scoped error marker",
    files: ["BTS-APP-MYWEBVIEWPLUGIN-LOG"]
  }, { configPath: fixture.configPath });

  assert.deepEqual(result.scope.directories, []);
  assert.deepEqual(result.scope.files, [{
    name: "bts-app-mywebviewplugin-log",
    path: fixture.exactLog
  }]);
  assert.deepEqual(result.results.map((entry) => entry.path), [fixture.exactLog]);
  assert.deepEqual(result.results[0].grant, {
    type: "file",
    name: "bts-app-mywebviewplugin-log"
  });
});

test("combined scope searches the selected union without implicit tool documentation", async (t) => {
  const fixture = await createScopedFixture(t);
  const result = await searchDocuments({
    query: "scoped error marker",
    directories: ["bts-app-logs"],
    files: ["bts-app-mywebviewplugin-log"],
    maxResults: 10
  }, { configPath: fixture.configPath });

  assert.deepEqual(new Set(result.results.map((entry) => entry.path)), new Set([
    fixture.primaryLog,
    fixture.exactLog
  ]));
  assert.ok(result.results.every((entry) => ![fixture.secondaryLog, fixture.toolReadme].includes(entry.path)));
  assert.deepEqual(result.scope.directories.map((entry) => entry.name), ["bts-app-logs"]);
  assert.deepEqual(result.scope.files.map((entry) => entry.name), ["bts-app-mywebviewplugin-log"]);
});

test("overlapping selected grants read and return one physical file once", async (t) => {
  const fixture = await createScopedFixture(t);
  const result = await searchDocuments({
    query: "scoped error marker",
    directories: ["bts-app-logs"],
    files: ["bts-app-overlap-log"]
  }, { configPath: fixture.configPath });

  assert.deepEqual(result.results.map((entry) => entry.path), [fixture.primaryLog]);
  assert.equal(result.meta.filesRead, 1);
  assert.deepEqual(result.results[0].grant, { type: "file", name: "bts-app-overlap-log" });
});

test("scoped search rejects empty, unknown, disabled, and non-array selections atomically", async (t) => {
  const fixture = await createScopedFixture(t);

  await assert.rejects(
    searchDocuments({ query: "error", directories: [], files: [] }, { configPath: fixture.configPath }),
    (error) => error?.code === "SEARCH_SCOPE_EMPTY"
  );
  await assert.rejects(
    searchDocuments({
      query: "error",
      directories: ["bts-app-logs", "missing-directory"],
      files: ["missing-file"]
    }, { configPath: fixture.configPath }),
    (error) => {
      assert.equal(error?.code, "SEARCH_SCOPE_NOT_FOUND");
      assert.deepEqual(error.details.unknownDirectories, ["missing-directory"]);
      assert.deepEqual(error.details.unknownFiles, ["missing-file"]);
      assert.ok(error.details.availableDirectories.includes("bts-app-logs"));
      assert.ok(error.details.availableFiles.includes("bts-app-mywebviewplugin-log"));
      return true;
    }
  );
  await assert.rejects(
    searchDocuments({
      query: "error",
      directories: ["disabled-app-logs"],
      files: ["disabled-exact-log"]
    }, { configPath: fixture.configPath }),
    (error) => {
      assert.equal(error?.code, "SEARCH_SCOPE_DISABLED");
      assert.deepEqual(error.details.disabledDirectories, ["disabled-app-logs"]);
      assert.deepEqual(error.details.disabledFiles, ["disabled-exact-log"]);
      return true;
    }
  );
  await assert.rejects(
    searchDocuments({ query: "error", directories: "bts-app-logs" }, { configPath: fixture.configPath }),
    (error) => error?.code === "SEARCH_SCOPE_INVALID"
  );
  await assert.rejects(
    searchDocuments({
      query: "error",
      directories: Array.from({ length: 501 }, (_value, index) => `grant-${index}`)
    }, { configPath: fixture.configPath }),
    (error) => error?.code === "SEARCH_SCOPE_INVALID"
  );
  await assert.rejects(
    searchDocuments({ query: "error", directories: [fixture.primaryRoot] }, { configPath: fixture.configPath }),
    (error) => error?.code === "SEARCH_SCOPE_NOT_FOUND"
  );
});

test("search finds compound-word variants and ignores excluded trees", async (t) => {
  const fixture = await createFixture(t);
  const result = await searchDocuments({ query: "minimax h3video", source: "local" }, { configPath: fixture.configPath });

  assert.equal(result.ok, true);
  assert.equal(result.meta.indexed, false);
  assert.equal(result.meta.networkUsed, false);
  assert.ok(result.results.some((hit) => hit.path === fixture.readmePath && hit.lineNumber === 2));
  assert.ok(result.results.every((hit) => hit.path !== fixture.ignoredPath));
  assert.deepEqual(result.queryPlan.terms, ["minimax", "h3", "video"]);
});

test("ignore-file patterns are applied individually after enumeration", async (t) => {
  const fixture = await createFixture(t);
  const result = await searchDocuments({ query: "quasar ignored target", source: "local" }, { configPath: fixture.configPath });

  assert.ok(result.results.every((hit) => hit.path !== fixture.ignoredJsonPath));
  assert.ok(result.meta.skippedIgnored > 0);
});

test("fetch returns exact configured content and identity", async (t) => {
  const fixture = await createFixture(t);
  const result = await fetchDocument({ path: fixture.readmePath, source: "local" }, { configPath: fixture.configPath });

  assert.equal(result.ok, true);
  assert.equal(result.content, fixture.readmeContent);
  assert.equal(result.lineCount, 3);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("specific files can be searched and fetched outside roots", async (t) => {
  const fixture = await createFixture(t);
  const searchResult = await searchDocuments({ query: "falcon tool", source: "local" }, { configPath: fixture.configPath });
  assert.equal(searchResult.results[0].path, fixture.explicitPath);

  const fetchResult = await fetchDocument({ path: fixture.explicitPath, source: "local" }, { configPath: fixture.configPath });
  assert.match(fetchResult.content, /Falcon tool/);
});

test("semicolon-separated glob-style extension filters search each suffix", async (t) => {
  const fixture = await createFixture(t);
  const searchResult = await searchDocuments({ query: "orion json", source: "local" }, { configPath: fixture.configPath });

  assert.equal(searchResult.results[0].path, fixture.jsonPath);

  const checkResult = await checkConfiguration({ configPath: fixture.configPath });
  assert.deepEqual(checkResult.sources.local.extensions, [".json", ".ai.md"]);
});

test("search bounds exceptionally long matching lines and reports truncation", async (t) => {
  const fixture = await createFixture(t);
  const searchResult = await searchDocuments({ query: "nebula sentinel", source: "local" }, { configPath: fixture.configPath });
  const hit = searchResult.results.find((result) => result.path === fixture.longJsonPath);

  assert.ok(hit);
  assert.equal(hit.lineTextTruncated, true);
  assert.equal(hit.lineText.length, 1000);
  assert.ok(hit.lineTextLength > hit.lineText.length);
  assert.match(hit.lineText, /Nebula line sentinel/);
});

test("search returns one ranked result per unique file with nested secondary snippets", async (t) => {
  const fixture = await createFixture(t);
  const searchResult = await searchDocuments({ query: "atlas search guide", source: "local" }, { configPath: fixture.configPath });

  assert.equal(searchResult.meta.resultUnit, "file");
  assert.equal(searchResult.meta.filesMatched, 3);
  assert.equal(searchResult.meta.uniqueFilesMatched, 2);
  assert.equal(searchResult.meta.duplicateFilesOmitted, 1);
  assert.equal(searchResult.meta.snippetsPerFile, 3);
  assert.equal(searchResult.results.length, 2);
  assert.deepEqual(new Set(searchResult.results.map((result) => result.path)), new Set([
    fixture.rankedPath,
    fixture.secondRankedPath
  ]));

  const ranked = searchResult.results.find((result) => result.path === fixture.rankedPath);
  assert.ok(ranked);
  assert.equal(ranked.lineNumber, 3);
  assert.equal(ranked.lineText, "# Atlas Guide for Search Workflows");
  assert.equal(ranked.matchType, "all_terms_line");
  assert.deepEqual(ranked.fileMatchedTerms, ["atlas", "search", "guide"]);
  assert.equal(ranked.matchCount, 4);
  assert.equal(ranked.returnedMatchCount, 3);
  assert.equal(ranked.additionalMatches.length, 2);
  assert.equal(ranked.duplicateCount, 1);
  assert.ok(searchResult.results.every((result) => result.path !== fixture.rankedCopyPath));
});

test("search defaults to one snippet while still counting every matching line", async (t) => {
  const fixture = await createFixture(t);
  const config = JSON.parse(await fs.readFile(fixture.configPath, "utf8"));
  delete config.limits.maxMatchesPerFile;
  await fs.writeFile(fixture.configPath, JSON.stringify(config, null, 2), "utf8");

  const searchResult = await searchDocuments({ query: "atlas search guide", source: "local" }, { configPath: fixture.configPath });
  const ranked = searchResult.results.find((result) => result.path === fixture.rankedPath);

  assert.equal(searchResult.meta.snippetsPerFile, 1);
  assert.equal(ranked.matchCount, 4);
  assert.equal(ranked.returnedMatchCount, 1);
  assert.deepEqual(ranked.additionalMatches, []);
});

test("fetch rejects files that were not granted by human configuration", async (t) => {
  const fixture = await createFixture(t);
  await assert.rejects(
    fetchDocument({ path: fixture.outsidePath, source: "local" }, { configPath: fixture.configPath }),
    (error) => error?.code === "FETCH_PATH_NOT_ALLOWED"
  );
});

test("fetch rejects relative paths", async (t) => {
  const fixture = await createFixture(t);
  await assert.rejects(
    fetchDocument({ path: "README.md", source: "local" }, { configPath: fixture.configPath }),
    (error) => error?.code === "FETCH_PATH_NOT_ABSOLUTE"
  );
});

test("check reports direct scan configuration without indexing or network", async (t) => {
  const fixture = await createFixture(t);
  const result = await checkConfiguration({ configPath: fixture.configPath });

  assert.equal(result.backend, "direct-scan");
  assert.equal(result.indexed, false);
  assert.equal(result.networkEnabled, false);
  assert.equal(result.sources.local.roots[0].available, true);
  assert.deepEqual(result.tools.directories, []);
  assert.deepEqual(result.tools.files, []);
});
