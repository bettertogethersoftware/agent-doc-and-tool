import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AgentDocError } from "../src/errors.mjs";
import { createDryRunPlan, validateDryRunPlan } from "../src/dry-run-plan.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const toolProvenance = {
  name: "dry-run-h3-video",
  path: "C:\\temp\\agent-doc-tool-dry-run\\tools\\h3_video_mock.py",
  workingDirectory: "C:\\temp\\agent-doc-tool-dry-run\\tools",
  extension: ".py",
  type: "python-script",
  invocation: {
    kind: "python",
    command: "python",
    argumentsPrefix: ["C:\\temp\\agent-doc-tool-dry-run\\tools\\h3_video_mock.py"],
    requiresEnvironment: true
  }
};

const documentProvenance = {
  name: "dry-run-h3-talking-portrait-workflow",
  path: "C:\\temp\\agent-doc-tool-dry-run\\docs\\h3-talking-portrait-workflow.md",
  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
};

test("createDryRunPlan returns a reproducible ready plan without execution", () => {
  const plan = createDryRunPlan({
    request: {
      outcome: "Create a talking-portrait video.",
      constraints: ["Do not publish the result."]
    },
    prompt: "Youtube-Video",
    tool: "dry-run-h3-video",
    documentation: "dry-run-h3-talking-portrait-workflow",
    operation: {
      name: "create",
      description: "Create a talking-portrait video.",
      plannedArguments: ["<input image>", "<script text>", "--output", "<output path>"]
    },
    inputs: {
      provided: ["source image", { name: "script", kind: "text" }]
    },
    outputs: [{ kind: "video", destination: "<output path>" }],
    provenance: {
      tool: toolProvenance,
      documentation: documentProvenance
    },
    sideEffects: {
      planned: ["create a local video file after authorization"]
    }
  });

  assert.equal(plan.schemaVersion, "1.0");
  assert.equal(plan.kind, "agent-dry-run-plan");
  assert.equal(plan.ok, true);
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.inputs.provided, [
    { name: "source image" },
    { name: "script", kind: "text" }
  ]);
  assert.deepEqual(plan.provenance, {
    tool: toolProvenance,
    documentation: documentProvenance
  });
  assert.deepEqual(plan.sideEffects.performed, []);
  assert.deepEqual(plan.execution, { mode: "dry-run", performed: false });
});

test("createDryRunPlan marks missing inputs and blockers as blocked", () => {
  const plan = createDryRunPlan({
    request: { outcome: "Create a video." },
    operation: {
      name: "create",
      description: "Create a video."
    },
    inputs: {
      missing: [{ name: "source image", kind: "image" }]
    },
    blockers: ["The source image is required."]
  });

  assert.equal(plan.status, "blocked");
  assert.deepEqual(plan.inputs.missing, [{ name: "source image", kind: "image" }]);
  assert.deepEqual(plan.blockers, ["The source image is required."]);
  assert.equal(plan.execution.performed, false);
  assert.deepEqual(plan.sideEffects.performed, []);
});

test("validateDryRunPlan rejects execution claims and inconsistent status", () => {
  const base = createDryRunPlan({
    request: { outcome: "Inspect a video." },
    operation: {
      name: "inspect",
      description: "Inspect a video."
    }
  });

  assert.throws(
    () => validateDryRunPlan({ ...base, execution: { mode: "dry-run", performed: true } }),
    (error) => error instanceof AgentDocError && error.code === "DRY_RUN_PLAN_INVALID"
  );
  assert.throws(
    () => validateDryRunPlan({ ...base, status: "ready", blockers: ["Needs confirmation."] }),
    (error) => error instanceof AgentDocError && error.code === "DRY_RUN_PLAN_INVALID"
  );
  assert.throws(
    () => validateDryRunPlan({ ...base, status: "blocked", blockers: [], inputs: { provided: [], missing: [] } }),
    (error) => error instanceof AgentDocError && error.code === "DRY_RUN_PLAN_INVALID"
  );
  assert.throws(
    () => validateDryRunPlan({ ...base, sideEffects: { planned: [], performed: ["created file"] } }),
    (error) => error instanceof AgentDocError && error.code === "DRY_RUN_PLAN_INVALID"
  );
});

test("the published dry-run contract example satisfies the runtime validator", async () => {
  const markdown = await fs.readFile(path.join(projectRoot, "docs", "DRY_RUN_PLAN_CONTRACT.md"), "utf8");
  const example = markdown.match(/```json\r?\n([\s\S]*?)\r?\n```/u)?.[1];
  assert.ok(example, "the contract document must contain a JSON example");
  const plan = validateDryRunPlan(JSON.parse(example));
  assert.equal(plan.kind, "agent-dry-run-plan");
  assert.equal(plan.execution.performed, false);
  assert.deepEqual(plan.sideEffects.performed, []);
});
