# Catalog Instructions Design

Status: Implemented  
Updated: 2026-08-13

## Goal

Replace the shared Human README with independent **Instructions**. Each
configuration tab owns one Instruction, and only its matching catalog-list
method returns it. This prevents guidance intended for one grant type from
appearing in every other catalog response.

## Catalog contract

| UI tab | Configuration key | MCP method | Response field |
| --- | --- | --- | --- |
| Documents | `instructions.documents` | `list` | `instruction` |
| Tools | `instructions.tools` | `list_tool` | `instruction` |
| Prompts | `instructions.prompts` | `list_prompt` | `instruction` |
| Secrets | `instructions.secrets` | `list_secret` | `instruction` |

Every response always includes its top-level `instruction`, including an empty
string when that tab has no saved text. `search`, `fetch`, `find_*`, and
`read_*` methods do not return this field.

Tool folders can also have an optional `instruction`. That nested field applies
only to its folder and is returned inside that folder's `list_tool` directory
entry; it is distinct from the Tools-tab top-level Instruction.

## Configuration model

```json
{
  "version": 1,
  "instructions": {
    "documents": "Search approved documents before guessing about a workflow.",
    "tools": "Read the selected tool documentation before use.",
    "prompts": "Confirm the selected reusable prompt before applying it.",
    "secrets": "Prefer a granted file path and request only necessary fields."
  }
}
```

Each value is a string of at most 5,000 characters. Outer whitespace is
trimmed and internal paragraphs are preserved.

Older root-level `humanNote`, transitional `humanNotes`, and per-tool-folder
`humanNote` fields are accepted when loading an existing configuration. Missing
new values fall back to the legacy value. The Configuration UI renders that
fallback, then saves the current `instructions` and folder `instruction`
fields, removing the old top-level forms.

## UI behavior

- The global README panel is removed.
- Documents, Tools, Prompts, and Secrets each have a compact, collapsed
  **Catalog Instruction** control that explicitly names its matching MCP list
  method and reports configured/empty state plus a character count. It does
  not echo stored Instruction text in the workspace header; open it only when
  changing its text.
- The Tool-folder control is named **Folder Instruction**.
- The **Guide** tab is available from the `?` tab-bar utility. It contains a
  compact operational flow, MCP discovery paths, and links back to the
  matching workspace; it has no editable Instruction field.
- All Instruction text participates in the normal reload, dirty-state,
  validation, save, and backup workflow.

## Dense operator workspace

The configuration UI is designed for repeated use with large catalogs rather
than a step-by-step setup wizard:

- On wide displays, each catalog's collapsed Instruction and import control
  share the first row. Documents uses one filterable catalog for folder roots
  and exact files, with a selected-grant inspector rather than competing
  full-width forms.
- Long entry collections scroll inside their own panel. Their title, actions,
  and column labels remain visible above the local list, avoiding a long page
  round trip to add, validate, or inspect another entry.
- Prompts use one compact catalog list rather than one expanded form per
  prompt. Select a row to edit its full text in the adjacent inspector; name,
  keyword, and status filters reduce the catalog without creating another
  page-level scroll region. Prompt-body text remains editor-only and is not
  used for catalog filtering.
- Static descriptions are short labels. The active catalog method is displayed
  in the Instruction disclosure label, for example `DOCUMENTS · LIST`.
- Action colors are semantic and paired with text labels: blue imports or
  browses local paths, green adds or saves, violet runs read-only tests, teal
  runs folder scans, and amber validates paths. Color reinforces the action;
  it is not the only way to identify a control.

## Safety boundary

Instructions are human-authored context, not authority. They never expand
enabled grants, allow execution, permit secret disclosure, authorize
publishing, or override the current request or higher-priority instructions.
Agents must not assume that an Instruction returned by one catalog also applies
to another catalog.

## Verification

The automated checks cover independent values in all four catalog payloads,
both serialized and structured MCP content, legacy-field migration, the
5,000-character limit, UI placement and labels, UI save/backup behavior, and
the absence of the deprecated response field from catalog and non-catalog
payloads.

The Documents-specific master-detail catalog redesign is documented in
[Documents Operator Workspace Design](DOCUMENTS_OPERATOR_WORKSPACE_DESIGN.md).
The Tools-specific master-detail catalog redesign is documented in
[Tools Operator Workspace Design](TOOLS_OPERATOR_WORKSPACE_DESIGN.md).
The Secrets-specific master-detail catalog redesign is documented in
[Secrets Operator Workspace Design](SECRETS_OPERATOR_WORKSPACE_DESIGN.md).
