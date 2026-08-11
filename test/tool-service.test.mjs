import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { fetchDocument, searchDocuments } from "../src/search-service.mjs";
import { findTools } from "../src/tool-service.mjs";

async function createToolFixture(t) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-tool-search-test-"));
  const binaryDirectory = path.join(temporaryRoot, "media bin");
  const musicDirectory = path.join(temporaryRoot, "music tools");
  const nestedDirectory = path.join(binaryDirectory, "nested");
  const ignoredDirectory = path.join(musicDirectory, "__pycache__");
  const helperDirectory = path.join(musicDirectory, "helpers");
  await fs.mkdir(nestedDirectory, { recursive: true });
  await fs.mkdir(ignoredDirectory, { recursive: true });
  await fs.mkdir(helperDirectory, { recursive: true });

  const ffmpegPath = path.join(binaryDirectory, "ffmpeg.exe");
  const ffplayPath = path.join(binaryDirectory, "ffplay.exe");
  const ffprobePath = path.join(binaryDirectory, "ffprobe.exe");
  const nestedPath = path.join(nestedDirectory, "nested-tool.exe");
  const musicScriptPath = path.join(musicDirectory, "generate_music_stable_audio3.py");
  const readmePath = path.join(musicDirectory, "README.md");
  const ignoredPath = path.join(ignoredDirectory, "cached_helper.py");
  const deepToolPath = path.join(helperDirectory, "deep_audio_tool.py");
  const unrelatedPath = path.join(binaryDirectory, "notes.txt");

  for (const filePath of [ffmpegPath, ffplayPath, ffprobePath, nestedPath]) {
    await fs.writeFile(filePath, "fixture\n", "utf8");
  }
  await fs.writeFile(musicScriptPath, "print('fixture')\n", "utf8");
  await fs.writeFile(readmePath, "# Stable Audio 3\nUse the local music workflow safely.\n", "utf8");
  await fs.writeFile(ignoredPath, "fixture\n", "utf8");
  await fs.writeFile(deepToolPath, "print('deep fixture')\n", "utf8");
  await fs.writeFile(unrelatedPath, "fixture\n", "utf8");
  await fs.writeFile(path.join(temporaryRoot, ".agent-searchignore"), "**/__pycache__/\n", "utf8");

  const configPath = path.join(temporaryRoot, "search.config.json");
  await fs.writeFile(configPath, `${JSON.stringify({
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [],
        extensions: ".ai.md;.md",
        fileNames: ["README.md"],
        files: []
      }
    },
    ignoreFile: ".agent-searchignore",
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: {
      directories: [
        { name: "media-bin", path: binaryDirectory, priority: 100, recursive: false, includeDocs: false },
        { name: "music-tools", path: musicDirectory, priority: 90, includeDocs: true }
      ],
      files: [{ name: "stable-audio-generator", path: musicScriptPath, priority: 200 }],
      extensions: ".exe;.py"
    },
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxLineChars: 1000,
      maxFileBytes: 100000,
      maxFetchBytes: 100000,
      maxFiles: 1000,
      timeoutMs: 5000
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
    ffmpegPath,
    ffplayPath,
    ffprobePath,
    nestedPath,
    musicScriptPath,
    readmePath,
    ignoredPath,
    deepToolPath,
    unrelatedPath
  };
}

test("find_tool resolves executables from a configured directory", async (t) => {
  const fixture = await createToolFixture(t);
  const result = await findTools({ query: "ffprobe" }, { configPath: fixture.configPath });

  assert.equal(result.ok, true);
  assert.equal(result.meta.executed, false);
  assert.equal(result.meta.networkUsed, false);
  assert.equal(result.results[0].path, fixture.ffprobePath);
  assert.equal(result.results[0].type, "executable");
  assert.equal(result.results[0].invocation.command, fixture.ffprobePath);
});

test("find_tool normalizes letter-number names and returns Python invocation metadata", async (t) => {
  const fixture = await createToolFixture(t);
  const result = await findTools({ query: "stable audio 3" }, { configPath: fixture.configPath });

  assert.equal(result.results[0].path, fixture.musicScriptPath);
  assert.equal(result.results[0].type, "python-script");
  assert.deepEqual(result.results[0].invocation, {
    kind: "python",
    command: "python",
    argumentsPrefix: [fixture.musicScriptPath],
    requiresEnvironment: true
  });
  assert.equal(result.results[0].workingDirectory, path.dirname(fixture.musicScriptPath));
  assert.equal(result.results[0].allTermsMatched, true);
});

test("tool directories honor recursion, suffixes, and ignore rules", async (t) => {
  const fixture = await createToolFixture(t);

  const nested = await findTools({ query: "nested tool" }, { configPath: fixture.configPath });
  assert.ok(nested.results.every((entry) => entry.path !== fixture.nestedPath));

  const ignored = await findTools({ query: "cached helper" }, { configPath: fixture.configPath });
  assert.ok(ignored.results.every((entry) => entry.path !== fixture.ignoredPath));

  const recursiveByDefault = await findTools({ query: "deep audio tool" }, { configPath: fixture.configPath });
  assert.equal(recursiveByDefault.results[0].path, fixture.deepToolPath);

  const unrelated = await findTools({ query: "notes" }, { configPath: fixture.configPath });
  assert.ok(unrelated.results.every((entry) => entry.path !== fixture.unrelatedPath));
});

test("a tool directory can also allow its README for search and fetch", async (t) => {
  const fixture = await createToolFixture(t);
  const searchResult = await searchDocuments({ query: "stable audio 3", source: "local" }, { configPath: fixture.configPath });

  assert.ok(searchResult.results.some((entry) => entry.path === fixture.readmePath));
  const fetchResult = await fetchDocument({ path: fixture.readmePath, source: "local" }, { configPath: fixture.configPath });
  assert.match(fetchResult.content, /local music workflow/);
});
