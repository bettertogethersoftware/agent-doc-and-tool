# MCP Workflow Efficiency Priorities

Status: Priorities 0 through 4 and the `find_tool` fallback optimization are implemented; the remaining execution capability itself remains separate and proposed.

## Decision

The highest-priority MCP change is to make `list_tool` a complete,
self-sufficient Tool bundle and update the MCP guidance so an agent does not
call `find_tool` after an already-selected Tool has been returned.

This is the bridge between discovering the correct capability and constructing
a reproducible invocation. It was implemented before optimizing fallback
discovery and remains a prerequisite for adding any execution capability.

## Implemented foundation

Priority 0 added the shared invocation-metadata helper and returns that
metadata from `list_tool` for every enabled selected or manual exact Tool. The
normal agent path is now:

```text
list_tool
  -> receive the exact path and invocation metadata
  -> read the associated manual
  -> build the command plan
  -> skip find_tool
```

The MCP server guidance identifies `find_tool` as fallback discovery or fresh
verification, rather than a mandatory step after a matching saved Tool.

## Priority 0: complete `list_tool` (implemented)

### 0.1 Create a shared Tool metadata helper (implemented)

Extract the existing extension-to-invocation mapping into a shared module,
for example:

```text
src/tool-metadata.mjs
```

Use the same helper in both `list_tool` and `find_tool` so both methods return
consistent metadata for the same path.

### 0.2 Enrich selected Tool entries (implemented)

Add the following fields to every enabled selected Tool entry returned by
`list_tool`, including entries in `scannedToolFiles` and top-level exact
`files`:

```json
{
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
}
```

Use the following deterministic mapping:

| Extension | Type | Invocation kind | Command/prefix |
| --- | --- | --- | --- |
| `.exe`, `.com` | `executable` | `direct` | Full path, no prefix |
| `.cmd`, `.bat` | `batch-script` | `command-shell` | Full path, no prefix |
| `.ps1` | `powershell-script` | `powershell` | `powershell`, `-NoProfile`, `-File`, full path |
| `.py` | `python-script` | `python` | `python`, full path |
| `.js`, `.mjs`, `.cjs` | `node-script` | `node` | `node`, full path |
| Other exact file | `configured-file` | `unspecified` | Full path, no prefix |

The metadata describes how the configured file would normally be launched. It
does not verify that the file currently exists, confirm that an interpreter is
installed, or grant permission to execute the Tool.

### 0.3 Update MCP guidance (implemented)

Replace unconditional guidance such as:

```text
When a task needs a local executable or script, call find_tool.
```

with guidance equivalent to:

```text
Call list_tool first. If an enabled saved Tool matches the task, use its
configured path and invocation metadata directly. Do not call find_tool merely
because the executable is not on PATH. Use find_tool only for unselected-file
discovery or material fresh filesystem verification.
```

Keep this wording aligned across:

- `src/server.mjs` instructions;
- MCP method descriptions;
- README workflow examples;
- CLI help;
- the base agent skill;
- any future Tool workflow companion skill.

### 0.4 Add regression tests (implemented)

Test that:

- `list_tool` returns metadata for `.exe`, `.com`, `.cmd`, `.bat`, `.ps1`,
  `.py`, `.js`, `.mjs`, and `.cjs` entries;
- top-level exact Tool files receive the same metadata as selected Tool files;
- `list_tool` and `find_tool` use equivalent metadata for the same path;
- `list_tool` does not verify files, enumerate directories, run help, or launch
  processes;
- disabled folders and disabled child entries remain omitted;
- an exact saved Tool can be understood without calling `find_tool`.

## Intended agent workflow

For a request such as:

```text
agent-prompt create a talking portrait from this image and script
```

the normal path should be:

```text
list_prompt
  -> select the configured prompt

read_prompt
  -> show a partial preview
  -> wait for confirmation because agent-prompt was explicit

list_tool
  -> select the exact human-approved Tool
  -> receive its path and invocation metadata

list (only when the exact document scope is not already in list_tool)
  -> obtain the broader Tool documentation directory or another exact grant

search
  -> search the selected sibling alias directly with directories: [] when available
  -> otherwise search the exact names resolved by list

fetch
  -> read the complete manual

plan
  -> return the versioned agent-dry-run-plan contract
  -> include the command or operation, missing inputs, provenance, and side effects

execute
  -> use a separate authorized execution channel

verify
  -> inspect the actual output
```

There should be no `find_tool` call when `list_tool` already returned the
selected Tool and sufficient invocation metadata.

## Follow-up priorities

### Priority 1: add structured capability metadata (implemented)

`list_tool` now returns optional, human-configured routing metadata directly
on each enabled Tool bundle and manually added exact Tool file. The fields are
intended to help an agent select an already allowlisted grant using the task's
capabilities and operations, rather than relying only on names and free-text
keywords:

```json
{
  "capabilities": [
    "video-generation",
    "talking-portrait",
    "image-to-video"
  ],
  "operations": [
    "create"
  ],
  "inputKinds": [
    "image",
    "script",
    "audio"
  ],
  "outputKinds": [
    "video"
  ]
}
```

Keep this metadata domain-neutral so the same model supports document,
coding, research, data, automation, and media workflows.

The Configuration UI exposes all four comma-separated fields for Tool folders
and exact Tool files. The schema validates bounded label lists, normalizes
labels to lower case with collapsed whitespace, de-duplicates them, and omits
empty fields from the catalog response. Existing configurations remain valid.

Scanned Tool children deliberately do not receive copied or inferred routing
metadata. They remain nested in their parent Tool bundle, whose labels provide
the authoritative context. Routing labels are descriptive configuration only:
they do not verify a path, inspect a file, authorize execution, or broaden the
configured access boundary.

### Priority 2: define a dry-run plan contract (implemented)

The agent now has one machine-readable response shape for plans that describe
an operation without executing it. The contract is documented in
[DRY_RUN_PLAN_CONTRACT.md](DRY_RUN_PLAN_CONTRACT.md) and is enforced by the
reusable `src/dry-run-plan.mjs` builder and validator.

The contract retains the selected prompt, Tool, and documentation aliases,
then adds the operation, provided and missing inputs, expected outputs,
provenance, planned side effects, blockers, and an explicit execution marker:

```json
{
  "schemaVersion": "1.0",
  "kind": "agent-dry-run-plan",
  "status": "ready",
  "prompt": "Youtube-Video",
  "tool": "h3-video",
  "documentation": "h3-talking-portrait-workflow",
  "execution": {
    "mode": "dry-run",
    "performed": false
  },
  "sideEffects": {
    "planned": ["create local video file"],
    "performed": []
  }
}
```

`status` is `blocked` when required inputs or material blockers remain and
`awaiting-confirmation` when the prompt workflow still requires confirmation.
Paths, invocation metadata, and fetched-document identity are copied into
`provenance` from exact MCP results; the agent must use placeholders for
missing values and never place secret values in a plan. The plan is an agent
response contract, not a new MCP execution method, so the public MCP method
set remains read-only and unchanged.

### Priority 3: make document discovery conditional (implemented)

`list` remains a useful document-scope and authorization check, but it is now
conditional for a selected Tool. When `list_tool` already provides an enabled
exact sibling `scannedDocumentFiles` alias, the agent can search that alias
directly without calling `list` to rediscover the same grant.

The implemented rule is:

```text
Use list when a selected Tool's document scope is not already known.
Use list_tool's exact sibling scannedDocumentFiles aliases directly in search.files.
Pass directories: [] with an exact sibling files selector.
Use list when the whole Tool documentation directory or another document grant is needed.
Always use scoped search for a selected Tool.
```

The exact-alias path is:

```text
list_tool
  -> select the Tool bundle and its exact sibling document alias
search({ query: "usage and arguments", directories: [], files: ["tool-readme"] })
  -> fetch the returned absolute path
```

The `search` method accepts exact file names returned by either `list` or
`list_tool`'s `scannedDocumentFiles`. It still rejects paths, unknown names,
disabled grants, and empty scopes. Do not silently broaden a scoped search
after an unsuccessful query. Retry once with a shorter query while preserving
the same exact scope, then report that the configured documentation was
insufficient.

### Priority 4: keep execution separate from discovery (implemented)

The local documentation MCP remains read-only and now exposes an explicit
machine-readable boundary. The complete contract is documented in
[EXECUTION_BOUNDARY_CONTRACT.md](EXECUTION_BOUNDARY_CONTRACT.md). Its
responsibility is to provide:

```text
prompt selection
tool selection
documentation discovery
invocation planning
```

Every successful MCP response carries `meta.executed: false`. The response
layer rejects a service payload that tries to report `executed: true`, and all
registered MCP methods are annotated read-only, non-destructive, idempotent,
and closed-world. Search may use the bounded direct `ripgrep` helper for
read-only file enumeration; `find_tool` may perform the documented bounded
filesystem verification fallback. Neither helper launches a configured Tool
or invokes a shell.

A separate authorized execution channel should handle:

```text
running the selected process
creating or modifying files
publishing or uploading results
```

Prompt selection, Catalog Instructions, folder notes, fetched documentation,
Tool paths, invocation metadata, and dry-run plans never silently become
permission to run an arbitrary script. A separate authorized execution channel
must independently confirm the user request, prompt confirmation, interface,
inputs, environment, credentials, paths, and side effects, then verify the
actual result after execution.

### Priority 5: optimize `find_tool` fallback behavior (implemented as Phase 2 of the simplification plan)

After the normal saved-Tool path became self-sufficient, `find_tool` was
optimized to score enabled saved exact candidates first, verify only those with
at least one query-term match, and skip enabled-folder enumeration when one or
more verified candidates exactly match a configured alias or executable
basename. When no such verified exact match exists, it retains the existing
bounded directory discovery path.

Keep `find_tool` available for:

- discovering an eligible file that was not saved in the UI;
- diagnosing a stale or moved configured path;
- performing explicit fresh filesystem verification;
- resolving a request that is not represented in the saved catalog.

Do not remove it from the public API until the project deliberately adopts a
strict human-selected-only authorization model.

## Acceptance test

Given a saved Python Tool:

```text
list_tool returns its exact path and Python invocation metadata
list_tool returns an exact sibling document alias when one is saved
the agent searches that alias with directories: [] and files: [alias]
the agent does not call list merely to rediscover that exact alias
the agent calls list only when a broader or unresolved document scope is needed
the agent does not call find_tool
no configured Tool process is executed during discovery
the agent returns kind: agent-dry-run-plan
the plan has execution.mode: dry-run and execution.performed: false
the plan has sideEffects.performed: []
missing inputs and blockers make the plan status blocked
```

This is the smallest end-to-end test that demonstrates the proposed MCP
workflow is genuinely more efficient.
