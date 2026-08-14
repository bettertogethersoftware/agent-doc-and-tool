import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { successToolResult } from "../src/mcp-result.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("MCP orchestration has no configured-Tool process execution path", async () => {
  const serverSource = await fs.readFile(path.join(projectRoot, "src", "server.mjs"), "utf8");
  assert.doesNotMatch(serverSource, /node:child_process/u);
  assert.doesNotMatch(serverSource, /\b(?:spawn|execFile|fork)\s*\(/u);
  assert.match(serverSource, /readOnlyHint:\s*true/gu);
  assert.match(serverSource, /destructiveHint:\s*false/gu);
  assert.match(serverSource, /openWorldHint:\s*false/gu);
});

test("successful MCP payloads carry a false execution marker", () => {
  const result = successToolResult({
    schemaVersion: "1.0",
    ok: true,
    value: "discovery",
    meta: { backend: "test" }
  });
  const textPayload = JSON.parse(result.content[0].text);

  assert.equal(result.structuredContent.meta.executed, false);
  assert.equal(textPayload.meta.executed, false);
  assert.deepEqual(textPayload, result.structuredContent);
  assert.throws(
    () => successToolResult({ schemaVersion: "1.0", ok: true, meta: { executed: true } }),
    /cannot report executed work/u
  );
});

test("the execution boundary documents the read-only helper exception", async () => {
  const contract = await fs.readFile(path.join(projectRoot, "docs", "EXECUTION_BOUNDARY_CONTRACT.md"), "utf8");
  assert.match(contract, /must not[\s\S]*run a configured Tool/iu);
  assert.match(contract, /bounded direct `ripgrep`/u);
  assert.match(contract, /separate authorized execution channel/u);
});
