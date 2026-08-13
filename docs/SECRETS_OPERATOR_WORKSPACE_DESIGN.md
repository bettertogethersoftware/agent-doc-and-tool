# Secrets Operator Workspace Design

Status: Implemented  
Updated: 2026-08-14

## Problem

The Secrets tab used a full-width editable row for every exact file, followed
by a permanently expanded test area. That made a growing catalog difficult to
scan and mixed safe metadata with editing controls.

## Goal

Give Secrets the same dense master-detail operating model as Documents and
Tools while making its security boundary more obvious: select an exact-file
grant, edit its configuration metadata in one inspector, and never reveal a
credential value.

```text
Exact secret grants              Selected secret
  production-ftp  NAME=value       alias, path, format, enabled state
  signing-key     Opaque value     validation and detected field metadata
```

## Interaction model

- The catalog filters by alias or configured path and can be narrowed to
  enabled or disabled grants. Its compact rows show only alias, format,
  shortened path, enabled state, and validation state.
- Selecting a row opens one selected-secret inspector. The inspector edits the
  existing `name`, exact `path`, `format`, and `enabled` configuration fields;
  it does not edit, load, or display secret values.
- The import strip, Browse file, and Add secret actions remain visible at the
  top of the workspace. Folders and links remain rejected by the server.
- Path and format changes explicitly mark the selected row as needing
  reinspection. Existing validation can still be run for all saved or unsaved
  rows without saving.
- The read-only `find_secret` check is collapsed by default so it does not
  compete with catalog work. It returns only service, path, format, and field
  metadata.
- The inspector keeps a visible metadata-only boundary reminder. Field names
  may be shown after inspection, but their values never enter the page or the
  configuration response.

## Compatibility and safety

1. The saved `secrets.files` array and its `name`, `path`, `format`, and
   `enabled` values are unchanged.
2. `list_secret`, `find_secret`, and `read_secret` keep their existing access
   contract. `read_secret` remains explicit-field access only.
3. The browser never receives a secret value from list, inspection,
   validation, or discovery UI paths.
4. Disabled rows remain saved but are excluded from agent discovery.
5. Configured secret files remain excluded from document and tool discovery.

## Acceptance criteria

1. A large exact-file catalog can be scanned, filtered, and selected without
   expanding every row.
2. A selected grant can be renamed, repathed, reformatted, enabled/disabled,
   and deleted through one inspector.
3. Empty, filtered-empty, selected, disabled, and invalid path states are
   visually distinct.
4. No UI text, API response, test result, or browser verification exposes a
   secret value.
5. The existing save, validation, native picker, drop box, secret inspection,
   and read-only search flows retain their behavior.

## Verification

- `node --check ui/app.js`
- `node --test test/ui-server.test.mjs`
- `npm test`
- `npm run test:mcp`
- `npm run check`
- `npm run test:mcp:live`
- `git diff --check`
- Live local UI: verified compact prompt-catalog sizing, secret catalog
  filtering and selection, metadata-only inspector content, and the collapsed
  discovery utility without saving private configuration.
