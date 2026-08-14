# A Stronger Simplification for Tool Discovery

Status: Phase 1 implemented; Phases 2 and 3 remain proposed

Created: 2026-08-14

Compatibility: Additive MCP response change; no configuration migration

Implementation update: Phase 1 now uses a shared Tool metadata helper in both
`list_tool` and `find_tool`, returns metadata for saved exact Tool entries,
and aligns the MCP, README, UI guide, and project skill guidance with the
saved-Tool-first workflow. Phase 2 broad-scan optimization and Phase 3 API
reassessment remain future work.

## Decision

Make `list_tool({})` sufficient for the normal use of every enabled Tool file
that a human has already selected and saved. Add deterministic Tool and
invocation metadata to the saved exact Tool entries returned by `list_tool`,
while keeping `list_tool` configuration-only and non-verifying.

Keep `find_tool(query)` as a fallback with two responsibilities:

1. Discover a matching executable or script that exists inside an enabled
   Tool folder but was not selected and saved by the human.
2. Perform fresh filesystem verification when the caller needs proof that a
   configured path is currently an allowed regular, non-link file.

An agent must not call `find_tool` merely because a selected executable is not
on `PATH`. When `list_tool` already returns the selected full path, invocation
metadata, and associated documentation grants, that result is sufficient for
normal use.

This plan preserves the implemented
[Tools Operator Workspace Design](TOOLS_OPERATOR_WORKSPACE_DESIGN.md). It is
intentionally narrower than the alternative
[One-Call Tool Catalog Design](LIST_TOOL_ENUMERATION_DESIGN.md): it does not
replace the configuration schema, enumerate every Tool folder during
`list_tool`, remove `find_tool`, or redesign the Tool UI.

## Problem

The Tool UI now lets a human scan a Tool folder, review matching files, and save
selected executables or scripts as exact full paths. `list_tool` returns those
selected paths in `scannedToolFiles`, together with the owning Tool folder,
folder Instruction, effective documentation path, and selected documentation
files.

The normal path-resolution problem is therefore already solved. However, the
current agent instructions can still cause this sequence:

```text
list_tool
  -> receive a selected full path
  -> call find_tool with the selected name
  -> verify every configured exact Tool
  -> scan every enabled Tool folder
  -> return the same path with invocation metadata
```

`find_tool` currently collects all enabled exact candidates and scans all
enabled Tool directories before scoring the query. It does not stop when a
saved alias or executable basename is an exact match. This repeats work and
weakens the purpose of preloading exact Tool paths for the agent.

For the current FFmpeg bundle, `list_tool` already returns exact paths for
`ffmpeg.exe`, `ffplay.exe`, and `ffprobe.exe`. A subsequent
`find_tool("ffmpeg")` returns the same `ffmpeg.exe` path after rechecking the
three selected files and scanning the Tool folder. That second call adds value
only when fresh verification is required.

## Goals

- One `list_tool({})` call supplies everything needed to invoke a selected,
  saved Tool file normally.
- A selected Tool and its selected help files remain visibly associated with
  the same Tool bundle.
- `list_tool` remains fast, deterministic, configuration-only, local-only, and
  non-executing.
- `find_tool` remains available for unselected-file discovery and current
  filesystem verification.
- Agents prefer human-reviewed saved selections over broad folder discovery.
- Existing configuration files and Tool UI workflows continue to work without
  migration.
- Existing MCP clients that ignore unknown response fields continue to work.

## Non-goals

- Do not execute a Tool, run `--help`, modify `PATH`, or test whether a Tool
  behaves correctly.
- Do not claim that a path is currently verified from a configuration-only
  `list_tool` call.
- Do not enumerate Tool directories during `list_tool`.
- Do not remove recursive folder discovery from `find_tool` in this change.
- Do not replace the existing `tools.directories`, `tools.files`,
  `scannedToolFiles`, or `scannedDocumentFiles` configuration model.
- Do not merge Tool matching rules with Document matching rules.
- Do not change the authorization boundary: an enabled Tool directory remains
  an allowlisted discovery root, and an enabled selected Tool remains an exact
  grant.

## Revised `list_tool` contract

### Existing bundle fields

Each enabled Tool directory continues to return:

- `name`
- Tool root `path`
- effective documentation root `documentPath`
- `priority`
- `recursive`
- `includeDocs`
- optional folder `instruction`
- enabled `scannedToolFiles`
- enabled `scannedDocumentFiles`

Top-level `files` continues to contain enabled manually added exact Tool files.
Disabled folders and disabled child entries remain omitted.

### Added metadata for exact Tool entries

Add the following fields to every entry in `scannedToolFiles` and top-level
`files`:

- `workingDirectory`: the parent directory of the configured full path.
- `extension`: the lower-case file extension.
- `type`: the Tool type derived from the extension.
- `invocation`: deterministic invocation metadata derived from the extension.

Do not add `verified: true`. `list_tool` does not inspect the filesystem and
must not imply that the configured path currently exists, is readable, or is a
regular non-link file. The absence of `verified` is deliberate; it is not a
failed verification.

Example selected Tool entry:

```json
{
  "name": "tool-folder-1-ffmpeg",
  "path": "C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe",
  "priority": 100,
  "workingDirectory": "C:\\Tools\\ffmpeg\\bin",
  "extension": ".exe",
  "type": "executable",
  "invocation": {
    "kind": "direct",
    "command": "C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe",
    "argumentsPrefix": [],
    "requiresEnvironment": false
  }
}
```

Example selected script entry:

```json
{
  "name": "media-render",
  "path": "C:\\Tools\\media\\render.py",
  "priority": 80,
  "workingDirectory": "C:\\Tools\\media",
  "extension": ".py",
  "type": "python-script",
  "invocation": {
    "kind": "python",
    "command": "python",
    "argumentsPrefix": [
      "C:\\Tools\\media\\render.py"
    ],
    "requiresEnvironment": true
  }
}
```

### Invocation mapping

Use one shared mapping for both `list_tool` and `find_tool`:

| Extension | `type` | `invocation.kind` | Command and prefix |
| --- | --- | --- | --- |
| `.exe`, `.com` | `executable` | `direct` | Full path; no prefix |
| `.cmd`, `.bat` | `batch-script` | `command-shell` | Full path; no prefix |
| `.ps1` | `powershell-script` | `powershell` | `powershell`; `-NoProfile`, `-File`, full path |
| `.py` | `python-script` | `python` | `python`; full path |
| `.js`, `.mjs`, `.cjs` | `node-script` | `node` | `node`; full path |
| Other exact file | `configured-file` | `unspecified` | Full path; no prefix |

The mapping describes how the configured file would normally be launched. It
does not establish that the required interpreter is installed or authorize an
agent to execute the command.

### Response compatibility

The new fields are additive. Keep the existing `list_tool` request shape and
top-level response structure. Existing clients can continue reading only
`name`, `path`, and `priority`.

Keep `schemaVersion: "1.0"` for this additive change unless the project adopts
a strict rule that every optional response-field addition requires a version
bump. If such a rule is adopted, change it to `1.1`; do not report `2.0`
because neither the request nor the existing response hierarchy is replaced.

## Revised agent workflow

```text
list_tool({})
  -> read the Tools Instruction and relevant folder Instruction
  -> match the requested Tool against saved scannedToolFiles and files
     |-> saved match found
     |    -> use its configured path and invocation metadata directly
     |    -> search/fetch its selected sibling documentation when needed
     |    `-> call find_tool only if fresh path verification is material
     `-> no saved match
          `-> call find_tool to discover an unselected matching file inside
              an enabled Tool directory
```

Examples where `find_tool` must be skipped:

- `list_tool` returns `tool-folder-1-ffmpeg` and the task needs FFmpeg's full
  path.
- `list_tool` returns a selected PowerShell or Python script and the agent needs
  its interpreter and argument prefix.
- The user identifies a saved Tool alias and its returned configured path is
  sufficient for the requested operation.

Examples where `find_tool` remains appropriate:

- No saved Tool alias or basename matches the request.
- A new eligible executable appeared inside an enabled Tool folder after the
  last UI scan.
- The caller must confirm that a configured path currently resolves to an
  allowed regular non-link file.
- The caller is diagnosing a stale, moved, unavailable, ignored, protected, or
  linked Tool path and needs filesystem warnings.

## `find_tool` fallback behavior

The public `find_tool` request and result contract can remain compatible. Its
description and server guidance must identify it as fallback discovery and
verification rather than a mandatory resolution step after `list_tool`.

As a follow-up optimization, process saved exact Tool candidates before broad
directory discovery:

1. Normalize and score enabled manual exact files and selected
   `scannedToolFiles`.
2. Verify the saved candidates that match at least one query term.
3. When one or more candidates exactly match the normalized configured alias or
   executable basename, return those verified candidates without scanning Tool
   directories.
4. Otherwise continue with the existing bounded directory discovery, safety
   checks, ranking, deduplication, warnings, and result limits.

An exact-match shortcut must return all equally matching enabled saved entries
within the configured result limit; it must not silently choose between two
different Tool bundles. The response metadata should expose whether directory
discovery ran, for example through the existing `directoriesScanned` count.

This optimization is not required for the first additive delivery. Correct
agent guidance and invocation metadata remove the redundant call from the
normal path; the shortcut reduces cost when a caller explicitly asks for fresh
verification.

## MCP and guidance changes

Replace unconditional server guidance such as:

```text
When a task needs a local executable or script that is not reliably on PATH,
call find_tool.
```

with guidance equivalent to:

```text
Call list_tool first. When an enabled saved scanned Tool or manual exact Tool
matches the task, use its returned full path and invocation metadata directly;
being absent from PATH does not require find_tool. Call find_tool only to
discover an unselected Tool inside an enabled Tool directory or to perform
fresh filesystem verification. Neither method executes a Tool or grants
permission to run it.
```

Phase 1 updates all matching guidance together:

- MCP server instructions and `list_tool`/`find_tool` descriptions.
- README method descriptions and recommended sequences.
- Configuration UI Guide workflow text.
- Repository and installed agent Tool skill guidance, where applicable.
- CLI/MCP-facing help examples so the normal flow no longer requires a `find_tool` call after `list_tool`.

## Implementation plan

### Phase 1: Make saved Tool entries self-sufficient

1. Extract the existing extension-to-invocation logic from
   `src/tool-service.mjs` into a small shared Tool metadata module.
2. Use that shared function in `find_tool` without changing its output.
3. Enrich enabled `scannedToolFiles` and top-level exact `files` in
   `src/catalog-service.mjs` with `workingDirectory`, `extension`, `type`, and
   `invocation`.
4. Preserve `list_tool` as a configuration-only call: no `stat`, `lstat`,
   `realpath`, directory read, executable read, help call, or process launch.
5. Update MCP descriptions, server instructions, README, UI Guide, CLI help,
   and applicable skill guidance to prefer direct saved paths.
6. Update response examples and counts without changing the saved configuration
   schema.

### Phase 2: Avoid broad scans during explicit verification

1. Refactor `find_tool` so query scoring can identify matching saved exact
   candidates before directory enumeration.
2. Verify only matching exact candidates instead of every configured exact
   Tool file.
3. Short-circuit broad folder discovery for exact saved alias or basename
   matches, while preserving multiple equally matching results.
4. Retain the current broad discovery path when there is no exact saved match.
5. Preserve secret exclusions, protected-path checks, link rules, ignore rules,
   recursion, timeouts, file limits, warnings, ranking, and deduplication.

### Phase 3: Reassess the remaining API split

After the additive behavior is stable, evaluate whether callers still need one
combined `find_tool` method. If verification and broad discovery create
confusing semantics, consider introducing an exact `verify_tool` operation and
renaming or narrowing `find_tool` to discovery only. Do not add another MCP
method until real usage demonstrates that the split reduces confusion enough
to justify the larger public surface.

## Required tests

### Catalog metadata

- `list_tool` returns invocation metadata for selected `.exe`, `.com`, `.cmd`,
  `.bat`, `.ps1`, `.py`, `.js`, `.mjs`, and `.cjs` entries.
- Top-level exact Tool files receive the same metadata as source-owned selected
  Tool files.
- The shared metadata helper produces byte-for-byte equivalent fields in
  `list_tool` and `find_tool` for the same path.
- `workingDirectory`, extension normalization, interpreter prefixes, and
  `requiresEnvironment` values match the documented table.
- Unknown exact-file extensions use the existing `configured-file` and
  `unspecified` fallback.

### Configuration-only boundary

- `list_tool` still returns a configured path when the file has subsequently
  moved or disappeared; it does not claim `verified: true`.
- A `list_tool` call performs no directory enumeration or process execution.
- Disabled folders, disabled selected Tools, and disabled exact Tool files are
  still omitted before metadata is built.
- Tool and Document paths, selected documentation entries, priorities, and
  Instructions remain unchanged.

### Fallback discovery and verification

- `find_tool` still discovers an eligible unselected file inside an enabled
  Tool directory.
- `find_tool` still rejects or omits unavailable files, links, protected paths,
  configured secret paths, ignored entries, and files outside the verified
  root.
- Exact saved alias and basename matches can be freshly verified without broad
  directory enumeration after Phase 2.
- Ambiguous exact matches return all eligible matches within the result limit.
- A query with no exact saved match still performs bounded recursive discovery.
- Existing timeout, file-limit, warning, ranking, and deduplication tests remain
  green.

### End-to-end behavior

- One `list_tool({})` call returns the three saved FFmpeg paths with direct
  invocation metadata and their sibling documentation selections.
- MCP smoke coverage confirms that an agent does not need `find_tool` to learn
  or invoke the saved FFmpeg path.
- `find_tool("ffmpeg")` remains available when the caller explicitly needs
  fresh verification.
- README, UI Guide, CLI help, server descriptions, and skill guidance contain
  no unconditional `find_tool` step after a matching saved path.
- Full configuration, service, UI, MCP, safety, and static-check suites pass.

## Acceptance criteria

This simplification is complete when:

1. Every enabled selected or manual exact Tool returned by `list_tool` includes
   deterministic working-directory, type, extension, and invocation metadata.
2. `list_tool` does not inspect the filesystem and never reports
   `verified: true`.
3. The documented primary workflow uses a matching saved Tool path directly.
4. Server and agent guidance calls `find_tool` only for unselected-file
   discovery or material fresh verification.
5. The FFmpeg bundle can be understood and normally invoked from one
   `list_tool({})` response, including its Tool and documentation relationship.
6. `find_tool` still safely discovers unselected Tools under enabled folder
   grants and still returns verified invocation results.
7. No configuration migration or Tool UI rewrite is required.
8. Existing clients that consume only the original `list_tool` fields remain
   compatible.
9. All affected tests and full project verification pass.

## Rejected alternatives

### Always call `find_tool` after `list_tool`

This repeats path discovery and can scan broad Tool folders even when the exact
human-selected path is already present. It defeats the preload workflow.

### Make `list_tool` enumerate every Tool directory

This would turn a deterministic configuration catalog into a potentially
expensive filesystem operation and would require timeout, truncation, stale
filesystem, and completeness semantics on every catalog call.

### Remove `find_tool` immediately

This would remove current filesystem verification and discovery of eligible
files that were not selected in the last UI scan. That can be a valid future
strict-curation policy, but it is a separate authorization-model decision and
is not required to eliminate the current redundant normal call.

### Report selected paths as verified from configuration

A saved full path records human intent, not current filesystem state. Reporting
`verified: true` without an actual safety check would make the response easier
to use but semantically false.

## Authorization model retained by this plan

The implemented model remains a folder-authorized model with preferred exact
selections:

- Saved selected Tools are the preferred, human-reviewed paths presented first
  through `list_tool`.
- Enabled Tool directories authorize bounded fallback discovery through
  `find_tool` according to suffix, recursion, ignore, link, secret, protected
  path, and limit rules.
- Neither discovery nor deterministic invocation metadata authorizes execution;
  execution remains governed by the current user request and higher-priority
  instructions.

If the product later adopts a strict human-selected model, broad directory
discovery should be removed explicitly and documented as an authorization
change. That decision should not be hidden inside this response simplification.
