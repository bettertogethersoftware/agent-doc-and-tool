import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureLocalConfig } from "../src/init-config.mjs";

test("local configuration is created once and never overwritten", async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-doc-config-test-"));
  const examplePath = path.join(temporaryRoot, "search.config.example.json");
  const configPath = path.join(temporaryRoot, "nested", "search.config.json");
  const example = '{"version":1,"sources":{}}\n';
  await fs.writeFile(examplePath, example, "utf8");

  t.after(async () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = path.resolve(os.tmpdir());
    const relative = path.relative(resolvedSystemTemp, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });

  const created = await ensureLocalConfig({ configPath, examplePath });
  assert.equal(created.created, true);
  assert.equal(await fs.readFile(configPath, "utf8"), example);

  const personalConfig = '{"personal":"path"}\n';
  await fs.writeFile(configPath, personalConfig, "utf8");
  const preserved = await ensureLocalConfig({ configPath, examplePath });
  assert.equal(preserved.created, false);
  assert.equal(await fs.readFile(configPath, "utf8"), personalConfig);
});
