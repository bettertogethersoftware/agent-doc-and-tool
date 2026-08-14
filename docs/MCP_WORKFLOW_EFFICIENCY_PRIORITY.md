# MCP Workflow Efficiency Priorities

Status: Priority 0 implemented; Priorities 1-5 remain proposed

## Decision

The highest-priority MCP change is to make `list_tool` a complete,
self-sufficient Tool bundle and update the MCP guidance so an agent does not
call `find_tool` after an already-selected Tool has been returned.

This is the missing bridge between discovering the correct capability and
constructing a reproducible invocation. It should be implemented before
optimizing fallback discovery or adding execution capabilities.

## Current gap

The current implementation has the invocation mapping in
`src/tool-service.mjs`, but `list_tool` does not yet return that metadata from
`src/catalog-service.mjs`. The normal agent path can therefore still become:

```text
list_tool
  -> receive a selected script path
  -> infer whether it needs Python, Node, PowerShell, or direct execution
  -> call find_tool
  -> repeat discovery and verification
```

The intended path is:

```text
list_tool
  -> receive the exact path and invocation metadata
  -> read the associated manual
  -> build the command plan
  -> skip find_tool
```

The MCP server guidance must be updated at the same time. Guidance that says
to call `find_tool` whenever a local executable or script is needed conflicts
with the saved-Tool workflow.

## Priority 0: complete `list_tool`

### 0.1 Create a shared Tool metadata helper

Extract the existing extension-to-invocation mapping into a shared module,
for example:

```text
src/tool-metadata.mjs
```

Use the same helper in both `list_tool` and `find_tool` so both methods return
consistent metadata for the same path.

### 0.2 Enrich selected Tool entries

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

### 0.3 Update MCP guidance

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

### 0.4 Add regression tests

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

list
  -> obtain the exact document scope when needed

search
  -> search the selected manual

fetch
  -> read the complete manual

plan
  -> produce the command and identify missing inputs

execute
  -> use a separate authorized execution channel

verify
  -> inspect the actual output
```

There should be no `find_tool` call when `list_tool` already returned the
selected Tool and sufficient invocation metadata.

## Follow-up priorities

### Priority 1: add structured capability metadata

Add optional routing metadata to Tool bundles so selection is based on
capabilities and operations, not only names and free-text keywords:

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

### Priority 2: define a dry-run plan contract

The agent should be able to return a consistent plan without executing a
process:

```json
{
  "prompt": "Youtube-Video",
  "tool": "h3-video",
  "documentation": "h3-talking-portrait-workflow",
  "execution": {
    "mode": "dry-run",
    "performed": false
  }
}
```

A dry run must not create, modify, publish, upload, delete, or send anything.

### Priority 3: make document discovery conditional

`list` remains a useful scope and authorization check, but it should not be
called repeatedly when `list_tool` already provides exact sibling document
aliases.

Use the following rule:

```text
Use list when the document scope is not already known.
Use exact sibling document aliases when list_tool already provides them.
Always use scoped search for a selected Tool.
```

Do not silently broaden a scoped search after an unsuccessful query. Retry once
with a shorter query, then report that the configured documentation was
insufficient.

### Priority 4: keep execution separate from discovery

The local documentation MCP should remain read-only. Its responsibility is to
provide:

```text
prompt selection
tool selection
documentation discovery
invocation planning
```

A separate authorized execution channel should handle:

```text
running the selected process
creating or modifying files
publishing or uploading results
```

Prompt selection and human notes must never silently become permission to run
an arbitrary script.

### Priority 5: optimize `find_tool` fallback behavior

After the normal saved-Tool path is self-sufficient, optimize `find_tool` so
it verifies matching saved candidates before scanning entire enabled folders.

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
the agent locates its associated manual
the agent does not call find_tool
no process is executed during discovery
the dry-run plan is complete and reproducible
```

This is the smallest end-to-end test that demonstrates the proposed MCP
workflow is genuinely more efficient.
