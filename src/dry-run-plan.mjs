import { z } from "zod";

import { AgentDocError } from "./errors.mjs";

export const DRY_RUN_PLAN_SCHEMA_VERSION = "1.0";
export const DRY_RUN_PLAN_KIND = "agent-dry-run-plan";

const TextSchema = z.string().trim().min(1).max(2_000);
const DescriptorSchema = z.object({
  name: TextSchema,
  kind: TextSchema.optional()
}).strict();
const OutputSchema = z.object({
  kind: TextSchema,
  destination: TextSchema.optional(),
  expected: TextSchema.optional()
}).strict();
const ToolProvenanceSchema = z.object({
  name: TextSchema,
  path: TextSchema,
  workingDirectory: TextSchema.optional(),
  extension: TextSchema.optional(),
  type: TextSchema.optional(),
  invocation: z.record(z.string(), z.unknown()).optional()
}).strict();
const DocumentProvenanceSchema = z.object({
  name: TextSchema,
  path: TextSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/iu).optional()
}).strict();

export const DryRunPlanSchema = z.object({
  schemaVersion: z.literal(DRY_RUN_PLAN_SCHEMA_VERSION),
  kind: z.literal(DRY_RUN_PLAN_KIND),
  ok: z.literal(true),
  status: z.enum(["awaiting-confirmation", "ready", "blocked"]),
  request: z.object({
    outcome: TextSchema,
    constraints: z.array(TextSchema).max(100).default([])
  }).strict(),
  prompt: TextSchema.nullable(),
  tool: TextSchema.nullable(),
  documentation: TextSchema.nullable(),
  operation: z.object({
    name: TextSchema,
    description: TextSchema,
    plannedArguments: z.array(TextSchema).max(100).default([])
  }).strict(),
  inputs: z.object({
    provided: z.array(DescriptorSchema).max(100).default([]),
    missing: z.array(DescriptorSchema).max(100).default([])
  }).strict(),
  outputs: z.array(OutputSchema).max(100).default([]),
  provenance: z.object({
    tool: ToolProvenanceSchema.optional(),
    documentation: DocumentProvenanceSchema.optional()
  }).strict().default({}),
  sideEffects: z.object({
    planned: z.array(TextSchema).max(100).default([]),
    performed: z.array(TextSchema).max(0).default([])
  }).strict(),
  execution: z.object({
    mode: z.literal("dry-run"),
    performed: z.literal(false)
  }).strict(),
  blockers: z.array(TextSchema).max(100).default([])
}).strict();

function normalizeDescriptor(value) {
  if (typeof value === "string") {
    return { name: value };
  }
  return value;
}

function normalizeDescriptors(values = []) {
  return values.map(normalizeDescriptor);
}

function normalizeTextList(values = []) {
  return values.map((value) => String(value));
}

function planValidationError(message, details = undefined) {
  return new AgentDocError("DRY_RUN_PLAN_INVALID", message, details);
}

export function validateDryRunPlan(value) {
  const parsed = DryRunPlanSchema.safeParse(value);
  if (!parsed.success) {
    throw planValidationError("Dry-run plan does not match the version 1.0 contract.", {
      issues: parsed.error.issues
    });
  }

  const plan = parsed.data;
  if (plan.status === "ready" && (plan.inputs.missing.length > 0 || plan.blockers.length > 0)) {
    throw planValidationError("A ready dry-run plan cannot contain missing inputs or blockers.", {
      missingInputs: plan.inputs.missing,
      blockers: plan.blockers
    });
  }
  if (plan.status === "blocked" && plan.inputs.missing.length === 0 && plan.blockers.length === 0) {
    throw planValidationError("A blocked dry-run plan must identify a missing input or blocker.");
  }
  return plan;
}

export function createDryRunPlan({
  request,
  prompt = null,
  tool = null,
  documentation = null,
  operation,
  inputs = {},
  outputs = [],
  provenance = {},
  sideEffects = {},
  blockers = [],
  status = undefined
}) {
  const provided = normalizeDescriptors(inputs.provided ?? []);
  const missing = normalizeDescriptors(inputs.missing ?? []);
  const normalizedBlockers = normalizeTextList(blockers);
  const resolvedStatus = status ?? (
    missing.length > 0 || normalizedBlockers.length > 0 ? "blocked" : "ready"
  );

  return validateDryRunPlan({
    schemaVersion: DRY_RUN_PLAN_SCHEMA_VERSION,
    kind: DRY_RUN_PLAN_KIND,
    ok: true,
    status: resolvedStatus,
    request: {
      outcome: request.outcome,
      constraints: normalizeTextList(request.constraints ?? [])
    },
    prompt,
    tool,
    documentation,
    operation: {
      name: operation.name,
      description: operation.description,
      plannedArguments: normalizeTextList(operation.plannedArguments ?? [])
    },
    inputs: {
      provided,
      missing
    },
    outputs,
    provenance,
    sideEffects: {
      planned: normalizeTextList(sideEffects.planned ?? []),
      // This field is deliberately forced empty. A dry-run plan describes
      // intended effects; it never reports an effect as already performed.
      performed: []
    },
    execution: {
      mode: "dry-run",
      performed: false
    },
    blockers: normalizedBlockers
  });
}
