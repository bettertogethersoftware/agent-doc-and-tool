# Tools Operator Workspace Design

Status: Implemented  
Updated: 2026-08-14

## Problem

The previous Tools tab represented a tool folder, its settings, its folder
Instruction, its scan commands, and every saved scanned grant as one expanding
form. It worked for a few entries but made the hierarchy unclear and created
multiple competing scroll areas at production scale.

## Goal

Turn Tools into an operator workspace that makes the configured object clear
at every level:

```text
Tool sources                 Selected source
  ffmpeg-8.1                   Overview | Tools | Documents | Instruction
  comfyui-h3-workflow-ex        - source settings
  agent-tool                    - separate tool/document grant review
                                - matching scan action per resource tab
```

Each source is one Tool bundle: `path` identifies the Tool root and the optional
`documentPath` identifies its documentation root. Scanned tools and documents
remain owned by that same parent directory, so `list_tool` returns both roots
and every enabled selected exact path together without requiring a follow-up
search. Direct exact tool files remain separate top-level grants. The
configuration adds a backward-compatible document scan scope: absent
`documentRecursive` values inherit the existing `recursive` value. It also
allows an optional `documentPath` to separate manuals from executables; when
the field is absent, documentation continues to inherit the Tool source
`path`.

## Interaction model

### Source catalog

- The left catalog contains only tool directories, never their children.
- Each source row shows a concise name, a secondary path, saved tool/document
  counts, enabled state, and validation state.
- Name and status filters narrow the source catalog. If a filter hides the
  current selection, the next visible source becomes selected.
- Adding a source clears restrictive filters so the new source is visible.

### Selected-source inspector

- **Overview** owns source name, Tool path, priority, documentation option,
  and enabled state.
- **Tools** shows only scanned tools. It owns its **Include subfolders** scope
  (`recursive`), **Scan tools**, tool-specific filtering, bulk
  enable/disable, and priority editing. Its scope also controls recursive
  tool discovery. Paths are secondary and copyable; a selected grant opens one
  focused editor rather than turning every table cell into an input.
- **Documents** shows only scanned documents. It owns its independent
  documentation location (`documentPath`), **Include subfolders** scope
  (`documentRecursive`), **Scan documents**, document-specific filtering, and
  bulk enable/disable. A blank documentation location inherits the Tool
  source path; an explicit location may point to an unrelated folder. Its
  recursion scope affects only Document scans; it does not change document
  discovery, `search`, or `fetch`. It does not show a meaningless Tool
  priority column. The same tab owns the selected Tool source's
  document-matching mode: it can inherit the Documents defaults or override
  extensions, exact filenames, and filename case sensitivity for the
  effective documentation folder and the scan. The command bar always displays
  the effective scan folder so an operator can verify that an explicit
  documentation path is being used instead of the Tool-path fallback.
- **Instruction** owns the optional folder Instruction and keeps that context
  separate from the Tools-tab Catalog Instruction.
- Each scan control and its own recursion scope live in the matching resource
  tab. This keeps a tool scan alongside Tool results and a document scan
  alongside Document results, avoiding a mixed table, shared scope, and a
  type-filtering detour.
- On desktop, the source catalog and selected-source inspector are separated
  by an adjustable, keyboard-accessible vertical splitter. This only changes
  the current UI session and never modifies a saved grant or source setting.

### Exact tool files

- Direct exact tool files remain distinct from source-owned scans.
- They live in a compact, collapsible Exact tool grants section so an empty
  state does not consume a page-sized card.

### Operator controls

- Source and grant counts show enabled and total values.
- Filter and status controls reduce local result scanning cost without mixing
  resource types.
- Bulk enable/disable applies only to currently visible Tools or Documents.
- Copy-path controls do not alter grants or invoke tools.
- The persistent save control stays positive; unsaved state is an amber status,
  not a destructive red save button.

## Acceptance criteria

1. The Tools catalog never displays scanned child grants beside source folders.
2. Selecting a source exposes its overview, separate Tool and Document result
   tabs, folder Instruction, and the corresponding scan action without a
   page-length round trip.
3. Scanning, enable/disable, removing grants, and saving preserve source-owned
   grants and write independent `path` and optional `documentPath` locations,
   `recursive` and `documentRecursive` scan scopes, plus optional
   `documentMatching` rules. `list_tool` reports the Tool path, effective
   documentation path, and enabled selected Tool/help paths together without
   enumerating either folder or requiring an additional search.
4. Direct exact tool files remain editable and clearly distinguished from
   source-owned grants.
5. All lists have one intentional local scroll area at large sizes; empty
   sections collapse.
6. Keyboard-focusable controls have labels and selected states are exposed to
   assistive technology.
7. Existing configuration, UI-server, MCP smoke, and validation tests pass,
   including nested-file coverage for independent Tool and Document scan
   scopes and documentation stored outside the Tool source tree.

## Delivery sequence

1. Replace the stacked source forms with source rows and an inspector.
2. Move scan result rendering into the inspector and add compact grant review.
3. Add filters, counts, bulk state actions, direct exact-grant disclosure, and
   footer semantic cleanup.
4. Update documentation, static tests, live UI checks, and full test suites.

## Verification

- The local UI was checked with three configured sources, including one source
  containing 89 saved grants. The source catalog stayed compact while the
  grants were rendered only in the selected-source table.
- Source filtering reselects a visible source when it hides the current one.
  Grant filtering tolerates punctuation differences, so a search such as
  `dac activations` matches `dac-activations` and `dac_activations` aliases.
- The exact-file disclosure opens independently and remains compact when no
  direct exact files are configured.
- `node --check ui/app.js`, `node --test test/ui-server.test.mjs`, `npm test`,
  `npm run test:mcp`, `npm run check`, and `git diff --check` pass.

## Follow-up proposal

The implemented scan-selection workflow deliberately preloads exact Tool and
documentation paths in `list_tool`. The proposed
[A Stronger Simplification for Tool Discovery](TOOL_DISCOVERY_SIMPLIFICATION_PLAN.md)
would make those selected Tool entries self-sufficient for normal invocation by
adding deterministic invocation metadata, while retaining `find_tool` only for
fresh verification and discovery of unselected files.
