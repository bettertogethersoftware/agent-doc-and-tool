import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { listToolCatalog } from "../src/catalog-service.mjs";
import { toolMetadataFor } from "../src/tool-metadata.mjs";

const metadataCases = [
    {
      fileName: "runner.exe",
      extension: ".exe",
      type: "executable",
      invocation: (filePath) => ({ kind: "direct", command: filePath, argumentsPrefix: [], requiresEnvironment: false })
    },
    {
      fileName: "runner.COM",
      extension: ".com",
      type: "executable",
      invocation: (filePath) => ({ kind: "direct", command: filePath, argumentsPrefix: [], requiresEnvironment: false })
    },
    {
      fileName: "runner.cmd",
      extension: ".cmd",
      type: "batch-script",
      invocation: (filePath) => ({ kind: "command-shell", command: filePath, argumentsPrefix: [], requiresEnvironment: true })
    },
    {
      fileName: "runner.bat",
      extension: ".bat",
      type: "batch-script",
      invocation: (filePath) => ({ kind: "command-shell", command: filePath, argumentsPrefix: [], requiresEnvironment: true })
    },
    {
      fileName: "runner.ps1",
      extension: ".ps1",
      type: "powershell-script",
      invocation: (filePath) => ({ kind: "powershell", command: "powershell", argumentsPrefix: ["-NoProfile", "-File", filePath], requiresEnvironment: true })
    },
    {
      fileName: "runner.PY",
      extension: ".py",
      type: "python-script",
      invocation: (filePath) => ({ kind: "python", command: "python", argumentsPrefix: [filePath], requiresEnvironment: true })
    },
    {
      fileName: "runner.js",
      extension: ".js",
      type: "node-script",
      invocation: (filePath) => ({ kind: "node", command: "node", argumentsPrefix: [filePath], requiresEnvironment: true })
    },
    {
      fileName: "runner.mjs",
      extension: ".mjs",
      type: "node-script",
      invocation: (filePath) => ({ kind: "node", command: "node", argumentsPrefix: [filePath], requiresEnvironment: true })
    },
    {
      fileName: "runner.cjs",
      extension: ".cjs",
      type: "node-script",
      invocation: (filePath) => ({ kind: "node", command: "node", argumentsPrefix: [filePath], requiresEnvironment: true })
    },
    {
      fileName: "runner.custom",
      extension: ".custom",
      type: "configured-file",
      invocation: (filePath) => ({ kind: "unspecified", command: filePath, argumentsPrefix: [], requiresEnvironment: true })
    }
];

test("tool metadata maps supported extensions deterministically without filesystem verification", () => {
  const toolDirectory = path.join(path.parse(process.cwd()).root, "tool-metadata-fixture");

  for (const fixture of metadataCases) {
    const filePath = path.join(toolDirectory, fixture.fileName);
    assert.deepEqual(toolMetadataFor(filePath), {
      workingDirectory: toolDirectory,
      extension: fixture.extension,
      type: fixture.type,
      invocation: fixture.invocation(filePath)
    });
  }
});

test("list_tool exposes metadata for every supported selected extension without inspecting files", async (t) => {
  const systemTemporaryRoot = await fs.realpath(os.tmpdir());
  const temporaryRoot = await fs.mkdtemp(path.join(systemTemporaryRoot, "agent-tool-metadata-test-"));
  const configPath = path.join(temporaryRoot, "search.config.json");
  const entries = metadataCases.map((fixture, index) => ({
    name: `saved-tool-${index + 1}`,
    path: path.join(temporaryRoot, fixture.fileName),
    priority: 100 - index
  }));

  await fs.writeFile(configPath, `${JSON.stringify({
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
    tools: {
      directories: [],
      files: entries,
      extensions: ".exe;.com;.cmd;.bat;.ps1;.py;.js;.mjs;.cjs"
    }
  }, null, 2)}\n`, "utf8");

  t.after(async () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const relative = path.relative(systemTemporaryRoot, resolvedTemporaryRoot);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await fs.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  });

  const listed = await listToolCatalog({ configPath });
  assert.deepEqual(listed.files, entries.map((entry, index) => ({
    name: entry.name,
    path: entry.path,
    priority: entry.priority,
    workingDirectory: temporaryRoot,
    extension: metadataCases[index].extension,
    type: metadataCases[index].type,
    invocation: metadataCases[index].invocation(entry.path)
  })));
  assert.ok(listed.files.every((entry) => Object.hasOwn(entry, "verified") === false));
});
