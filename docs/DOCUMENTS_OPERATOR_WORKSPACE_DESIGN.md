# Documents Operator Workspace Design

Status: Implemented  
Updated: 2026-08-13

## Problem

The Documents tab split folders and exact files into separate full-width cards.
That is understandable for setup, but it becomes costly to scan at scale: the
operator has to compare two lists, read dense inline fields, and leave the
current context to change an item or run a test.

## Goal

Bring Documents to the same master-detail model as Tools without changing the
saved document configuration or the MCP `list`, `search`, and `fetch`
contracts.

```text
Document grants                 Selected grant
  motion-studio  Folder           identity, path, priority, state
  release-notes  Exact file       scope semantics and validation
```

## Interaction model

- One filterable catalog contains folder roots and exact file grants. Each row
  declares its type, path, enabled state, and path-validation state.
- Selecting a row opens one focused inspector. Folder-only priority remains
  editable there; exact files deliberately do not acquire a synthetic
  priority.
- Adding and browsing are grouped explicitly by grant type. The drop box is a
  separate import path, not a competing substitute for those actions.
- Matching rules and read-only test search become collapsible utilities so an
  empty test panel does not consume a page-sized area.
- The layout keeps the existing button language: blue browse/import, green
  add/save, amber validate, and violet read-only test.

## Acceptance criteria

1. Folder roots and exact file grants remain distinct in saved configuration.
2. The catalog filters by text, type, and enabled state and keeps selection
   valid when filters hide the current row.
3. The inspector permits existing name/path/enabled/priority edits, including
   per-path validation on blur.
4. `collectConfig`, drag/drop, native pickers, validation, and document search
   continue to operate against the same data shape.
5. The matching and test utilities no longer create an oversized empty page.
6. UI-server, MCP smoke/live, configuration checks, and live UI validation
   pass without saving the private local configuration.

## Verification

- `node --check ui/app.js`
- `node --test test/ui-server.test.mjs`
- `npm test` (61 tests)
- `npm run test:mcp`
- `npm run check`
- `npm run test:mcp:live`
- `git diff --check`
- Live local UI: checked catalog filtering, row selection, exact-file editing,
  validation-state synchronization, the folder-only priority control, and the
  collapsed matching, limits, and test utilities. Temporary grants were
  discarded without saving.
