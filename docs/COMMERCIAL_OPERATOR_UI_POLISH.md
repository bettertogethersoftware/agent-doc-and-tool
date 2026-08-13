# Commercial operator UI polish

## Purpose

The Configuration UI is designed for people who manage large local catalogs.
This pass reduces visual noise and scrolling without weakening the explicit
human-grant and secret-access boundaries.

## Interaction model

- Each tab keeps its own **Catalog Instruction**. The closed control reports
  only whether it is configured and its character count; it never echoes the
  raw instruction text in the workspace header. Activating it opens the
  existing editable field, so the exact stored text remains available to its
  owner.
- Desktop catalog workspaces use independent list and inspector surfaces.
  A short catalog stays short instead of inheriting the editor's height; a
  long catalog can scroll in its own surface.
- On desktop, a vertical splitter between the catalog and the selected-item
  detail lets an operator tune the working width. It supports dragging plus
  Arrow keys, Home, and End, and does not write to the saved configuration.
- Prompts retain the master-detail workflow and add **Focus editor** for
  editing a long prompt without the catalog pane competing for space. Escape
  returns to the catalog view.
- Documents, Tools, and Secrets use the same selected-row treatment. Secrets
  use violet, Documents use blue, Tools use teal, and Prompts use green so the
  active resource type is recognizable at a glance. Validation, warning, and
  destructive-action colors retain their shared meaning across all tabs.
- A selected Tool source separates **Tools** and **Documents** into their own
  tabs. **Scan tools** lives with Tool results and **Scan documents** lives
  with Document results. Each tab also owns an independent **Include
  subfolders** scope, removing the mixed table, shared-scope ambiguity, and
  type-filtering tax. Bulk grant controls remain scoped to the visible resource
  tab.
- The global action bar explains whether edits are saved, makes the save
  consequence explicit when dirty, and supports `Ctrl+S` / `Cmd+S` to save.
  Saving still performs the existing validation first.

## Guide

The **Guide** tab is an operational quick reference, not a duplicate set of
large prose panels. It presents the configuration-to-validation-to-save-to-test
sequence, shows each tab's MCP discovery path, states the safety boundary, and
links directly to the relevant workspace.

## Safety invariants

- Changing the presentation does not change the `instructions` schema or the
  independent top-level `instruction` returned by `list`, `list_tool`,
  `list_prompt`, and `list_secret`.
- A Catalog Instruction is context only. It never expands a grant, permits
  execution, reveals a secret, or overrides the current request.
- Secret values are never rendered in the catalog, inspector, guide, or
  status bar.
- Reload continues to require confirmation when there are unsaved edits; the
  UI does not write configuration unless the user explicitly saves.

## Responsive behavior

At narrow widths the workspace stacks normally, the persistent action bar
retains enough height for its controls, and the Guide simplifies to one column.
The desktop split surfaces are therefore an enhancement rather than a separate
interaction model.

## Verification checklist

1. A configured Instruction shows a status and character count, not its text.
2. Select a prompt and enter/exit Focus editor; confirm the editor grows and
   Escape restores the catalog.
3. Open Documents, Tools, and Secrets with one item and with many items; list
   and inspector heights should remain independent.
4. Drag or keyboard-adjust each desktop splitter; check it leaves grants and
   the dirty state unchanged.
5. Open a Tool source, switch between Tools and Documents, and confirm each
   tab shows only its matching results, scan action, and independent
   **Include subfolders** setting.
6. Check the Guide links route to the corresponding tab.
7. Make an edit, confirm the action bar explains that saving exposes it to the
   local agent, then reload or save intentionally.
