import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseConfig } from "../src/config.mjs";
import { findPrompts, readPrompt } from "../src/prompt-service.mjs";

function baseConfig(prompts = []) {
  return {
    version: 1,
    defaultSource: "local",
    sources: {
      local: {
        roots: [],
        extensions: ".md",
        fileNames: ["README.md"],
        files: []
      }
    },
    ignore: [],
    caseSensitive: false,
    followLinks: false,
    tools: { directories: [], files: [], extensions: ".exe;.py" },
    secrets: { files: [], maxFileBytes: 100_000 },
    prompts,
    limits: {
      maxResults: 20,
      maxMatchesPerFile: 3,
      maxLineChars: 1_000,
      maxFileBytes: 100_000,
      maxFetchBytes: 100_000,
      maxFiles: 1_000,
      timeoutMs: 5_000
    }
  };
}

async function createFixture(t) {
  const systemTemporaryRoot = await fs.realpath(os.tmpdir());
  const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-prompt-test-"));
  const configPath = path.join(temporaryRoot, "search.config.json");
  const content = [
    "Create a cinematic YouTube music video.",
    "Use deliberate scene pacing and verify the final render."
  ].join("\n");
  await fs.writeFile(configPath, `${JSON.stringify(baseConfig([
    { name: "youtube-mv", keywords: ["cinematic", "music video", "youtube", "feature length"], content, enabled: true },
    { name: "short mv", keywords: ["cinematic", "music video", "youtube"], content: "Create a short music video.", enabled: true },
    { name: "disabled-draft", keywords: "orchestral;storyboard", content: "Hidden draft prompt.", enabled: false }
  ]), null, 2)}\n`, "utf8");

  t.after(async () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = systemTemporaryRoot;
    const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });
  return { configPath, content };
}

test("findPrompts matches only names and optional keywords", async (t) => {
  const fixture = await createFixture(t);
  const byName = await findPrompts({ query: "youtube feature" }, { configPath: fixture.configPath });
  const shortName = await findPrompts({ query: "short mv" }, { configPath: fixture.configPath });
  const broadName = await findPrompts({ query: "mv" }, { configPath: fixture.configPath });
  const byKeyword = await findPrompts({ query: "feature length" }, { configPath: fixture.configPath });
  const byBodyOnly = await findPrompts({ query: "deliberate pacing" }, { configPath: fixture.configPath });

  assert.deepEqual(byName.results.map((entry) => entry.name), ["youtube-mv"]);
  assert.ok(byName.results[0].matchedFields.includes("name"));
  assert.equal(Object.hasOwn(byName.results[0], "content"), false);
  assert.deepEqual(byName.results[0].keywords, ["cinematic", "music video", "youtube", "feature length"]);
  assert.match(byName.results[0].preview, /cinematic YouTube music video/);
  assert.deepEqual(shortName.results.map((entry) => entry.name), ["short mv"]);
  assert.equal(shortName.results[0].allTermsMatched, true);
  assert.deepEqual(broadName.results.map((entry) => entry.name).sort(), ["short mv", "youtube-mv"]);
  assert.equal(byName.meta.promptsEnabled, 2);
  assert.equal(byName.meta.promptsDisabled, 1);
  assert.deepEqual(byName.meta.searchFields, ["name", "keywords"]);
  assert.equal(byName.meta.matchMode, "all-terms");
  assert.equal(byKeyword.results[0].name, "youtube-mv");
  assert.deepEqual(byKeyword.results[0].matchedFields, ["keywords"]);
  assert.equal(byBodyOnly.results.length, 0);
});

test("readPrompt returns exact enabled prompt text and identity", async (t) => {
  const fixture = await createFixture(t);
  const result = await readPrompt({ prompt: "YouTube-MV" }, { configPath: fixture.configPath });

  assert.equal(result.name, "youtube-mv");
  assert.equal(result.content, fixture.content);
  assert.equal(result.lineCount, 2);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.meta.networkUsed, false);
});

test("disabled prompts cannot be found or read", async (t) => {
  const fixture = await createFixture(t);
  const found = await findPrompts({ query: "orchestral storyboard" }, { configPath: fixture.configPath });
  assert.equal(found.results.length, 0);
  await assert.rejects(
    readPrompt({ prompt: "disabled-draft" }, { configPath: fixture.configPath }),
    (error) => error?.code === "PROMPT_DISABLED"
  );
});

test("prompt aliases are unique case-insensitively and prompt text cannot be blank", async () => {
  await assert.rejects(
    parseConfig(baseConfig([
      { name: "YouTube-MV", content: "First prompt." },
      { name: "youtube-mv", content: "Second prompt." }
    ]), path.join(os.tmpdir(), "duplicate-prompts.json")),
    (error) => error?.code === "CONFIG_PROMPT_NAME_DUPLICATE"
  );
  await assert.rejects(
    parseConfig(baseConfig([{ name: "blank", content: "  \n" }]), path.join(os.tmpdir(), "blank-prompt.json")),
    (error) => error?.code === "CONFIG_PROMPT_CONTENT_EMPTY"
  );

  const withoutKeywords = await parseConfig(
    baseConfig([{ name: "name-only", content: "A valid name-only prompt." }]),
    path.join(os.tmpdir(), "optional-prompt-keywords.json")
  );
  assert.deepEqual(withoutKeywords.prompts[0].keywords, []);
});
