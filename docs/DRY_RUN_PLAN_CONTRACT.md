# Dry-run plan contract

Version: `1.0`

This is the agent's response contract after it has selected the relevant
prompt, Tool, and documentation. It is intentionally separate from the local
documentation MCP's discovery methods: the MCP remains read-only, and the
contract does not add an execution method or grant permission to run anything.

## Invariants

Every dry-run plan must satisfy all of these rules:

- `kind` is `agent-dry-run-plan`.
- `schemaVersion` is `1.0`.
- `execution.mode` is `dry-run`.
- `execution.performed` is always `false`.
- `sideEffects.performed` is always an empty array.
- `status` is `ready` only when `inputs.missing` and `blockers` are both empty.
- `status` is `blocked` when a required input or other material blocker is
  present.
- `status` may be `awaiting-confirmation` when prompt selection or another
  required user confirmation has not yet happened.
- Tool and documentation references use exact aliases returned by the MCP.
  Their resolved paths and invocation metadata belong under `provenance`.
- Missing values use placeholders such as `<input image>` or `<output path>`;
  secret values must never be copied into the plan.
- A plan describes intended work. It must not claim that a process started, a
  file was created, a result was verified, or anything was published.

The `agent-dry-run-plan` value is not an execution request. A separate,
authorized execution channel must independently check user authorization,
confirmation, credentials, inputs, interface details, and side effects before
running anything.

## Shape

```json
{
  "schemaVersion": "1.0",
  "kind": "agent-dry-run-plan",
  "ok": true,
  "status": "ready",
  "request": {
    "outcome": "Create a talking-portrait video from the supplied image and script.",
    "constraints": [
      "Do not publish or upload the result."
    ]
  },
  "prompt": "Youtube-Video",
  "tool": "dry-run-h3-video",
  "documentation": "dry-run-h3-talking-portrait-workflow",
  "operation": {
    "name": "create",
    "description": "Create a talking-portrait video using the selected H3 workflow.",
    "plannedArguments": [
      "<input image>",
      "<script text>",
      "--output",
      "<output path>"
    ]
  },
  "inputs": {
    "provided": [
      {
        "name": "source image",
        "kind": "image"
      },
      {
        "name": "script",
        "kind": "text"
      }
    ],
    "missing": []
  },
  "outputs": [
    {
      "kind": "video",
      "destination": "<output path>",
      "expected": "A locally rendered video file; not created during this dry run."
    }
  ],
  "provenance": {
    "tool": {
      "name": "dry-run-h3-video",
      "path": "C:\\temp\\agent-doc-tool-dry-run\\tools\\h3_video_mock.py",
      "workingDirectory": "C:\\temp\\agent-doc-tool-dry-run\\tools",
      "extension": ".py",
      "type": "python-script",
      "invocation": {
        "kind": "python",
        "command": "python",
        "argumentsPrefix": [
          "C:\\temp\\agent-doc-tool-dry-run\\tools\\h3_video_mock.py"
        ],
        "requiresEnvironment": true
      }
    },
    "documentation": {
      "name": "dry-run-h3-talking-portrait-workflow",
      "path": "C:\\temp\\agent-doc-tool-dry-run\\docs\\h3-talking-portrait-workflow.md",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  },
  "sideEffects": {
    "planned": [
      "Create a local video file after a later authorized execution."
    ],
    "performed": []
  },
  "execution": {
    "mode": "dry-run",
    "performed": false
  },
  "blockers": []
}
```

The example's SHA-256 is a format placeholder. A real plan should copy the
identity returned by `fetch`; it must not invent a document hash.

## Blocked example

When a required input is missing, keep the same shape and make the blocker
explicit:

```json
{
  "schemaVersion": "1.0",
  "kind": "agent-dry-run-plan",
  "ok": true,
  "status": "blocked",
  "request": {
    "outcome": "Create a talking-portrait video.",
    "constraints": []
  },
  "prompt": "Youtube-Video",
  "tool": "dry-run-h3-video",
  "documentation": "dry-run-h3-talking-portrait-workflow",
  "operation": {
    "name": "create",
    "description": "Create a talking-portrait video.",
    "plannedArguments": [
      "<input image>",
      "<script text>",
      "--output",
      "<output path>"
    ]
  },
  "inputs": {
    "provided": [],
    "missing": [
      {
        "name": "source image",
        "kind": "image"
      },
      {
        "name": "script",
        "kind": "text"
      }
    ]
  },
  "outputs": [],
  "provenance": {},
  "sideEffects": {
    "planned": [],
    "performed": []
  },
  "execution": {
    "mode": "dry-run",
    "performed": false
  },
  "blockers": [
    "The source image and script are required before execution can be considered."
  ]
}
```

The MCP discovery sequence remains the same. The agent builds this object only
after the smallest required sequence has completed:

```text
list_prompt
  -> select prompt and confirm when the prompt workflow requires it
list_tool
  -> select exact Tool and invocation metadata
search/fetch
  -> select and read the exact manual, using the Priority 3 conditional list rule
agent-dry-run-plan
  -> report the structured plan with execution.performed: false
```

The final line is an agent response, not a call that runs the selected Tool.
