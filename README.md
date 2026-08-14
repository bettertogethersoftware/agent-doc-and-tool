# Agent Docs & Tools

Read-only local documentation, tool, reusable-prompt, and exact secret-file access for AI agents. The package exposes eleven MCP tools.

Each catalog method returns its own top-level `instruction` written in the matching Configuration UI tab: `list` uses Documents, `list_tool` uses Tools, `list_prompt` uses Prompts, and `list_secret` uses Secrets. An Instruction is task context only: it does not broaden grants, authorize execution, permit secret disclosure, or override the current request.

The tools are:

- `list()` returns only the enabled document folders and enabled exact files, including enabled Tool folders configured with `includeDocs` and enabled scanned document selections saved beneath tool folders. Folder entries include their configured name, resolved path, and priority; exact-file entries include their configured name and resolved path. It reports grants rather than recursively enumerating directory contents, and disabled entries are omitted.
- `search(query, directories?, files?)` scans all enabled document grants by default, or only directory and exact-file grants selected by names returned from `list`. An enabled Tool folder with `includeDocs: true` is a selectable document directory, so agents can pass its listed name through `directories`. Scope names stay separate from document-content terms. It returns one ranked result per distinct matching file, led by the best matching line rather than the first line encountered. Byte-identical copies are collapsed.
- `fetch(path)` returns the complete text and SHA-256 identity of a file selected from search results.
- `list_tool()` returns only enabled tool directories and manually added exact tool files. A returned tool directory can also include its folder Instruction, selected scanned tool files, and selected scanned document files with their direct paths. Those nested selections have no `origin` field: they are the saved, enabled agent grants owned by that folder. It does not enumerate, verify, invoke, or execute tools.
- `find_tool(query)` resolves human-allowlisted executables and scripts by name or capability. It returns a verified full path, type, and invocation metadata without running anything or changing `PATH`.
- `list_prompt()` returns enabled reusable-prompt names and discovery keywords without returning prompt bodies.
- `find_prompt(query)` finds enabled reusable prompts by name, alias, or optional keywords and returns names with bounded previews. Every query term must match across the name and keywords; prompt body text is never searched.
- `read_prompt(prompt)` returns the complete text and SHA-256 identity of one enabled prompt selected by its exact configured name or alias.
- `list_secret()` returns enabled exact secret-file grants by name, resolved path, and configured format without opening the files or returning detected fields or values.
- `find_secret(query)` resolves human-allowlisted exact secret files by alias, filename, path terms, or detected field names. It returns the path and metadata, never values.
- `read_secret(secret, keys)` reads one configured secret alias. Key/value files require explicit field names when they contain more than one field; opaque token, password, or key files return one value.

The current backend scans files directly. It does not build an index, contact the web, or query databases. Those can be added later as separate providers without changing the tool contract.

## Install and verify

Requires Node.js 20 or newer.

```powershell
npm install
npm run setup:config
npm test
npm run test:mcp
npm run test:mcp:live
npm run check
npm run ui
```

All CLI commands write JSON to stdout:

```powershell
node .\src\cli.mjs list --source local
node .\src\cli.mjs list-tool
node .\src\cli.mjs list-prompt
node .\src\cli.mjs list-secret
node .\src\cli.mjs search --query "minimax h3" --source local
node .\src\cli.mjs fetch --path "C:\full\path\returned-by-search\README.md" --source local
node .\src\cli.mjs find-tool --query "ffprobe"
node .\src\cli.mjs find-prompt --query "youtube mv"
node .\src\cli.mjs read-prompt --prompt "youtube-mv"
```

## MCP method reference

Every method accepts one JSON object and is registered as read-only, non-destructive, idempotent, and closed-world. The server reloads the private configuration on every call and performs no network requests. Successful application payloads use `schemaVersion: "1.0"` and `ok: true`. The MCP response places the same payload in both `content[0].text` as serialized JSON and `structuredContent`.

Application errors set the MCP result's `isError` flag and use this shape:

```json
{
  "schemaVersion": "1.0",
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

The `details` member appears only when additional structured context is available. MCP input-schema failures can be rejected by the SDK before a method handler runs.

Query-driven methods return a `queryPlan` containing the canonical `normalizedQuery` and deduplicated `terms` used for matching.

### `list`, `list_tool`, `list_prompt`, and `list_secret`

The four catalog methods provide a broad view of the grants that are currently enabled in the human configuration. They reload `config/search.config.json` on every call, return the matching normalized top-level `instruction`, resolve configured paths to absolute paths, and omit disabled entries entirely. They do not return disabled names, paths, or counts. An unconfigured Instruction is returned as an empty string for a predictable response contract.

| MCP method | Input | Enabled entries returned | Deliberately not performed |
| --- | --- | --- | --- |
| `list` | `{}` | Documents top-level `instruction`; document directories with `name`, `path`, and `priority`, including enabled Tool folders with `includeDocs`; exact document files with `name` and `path`, including enabled selected scanned documents | Recursive file enumeration or document-content search |
| `list_tool` | `{}` | Tools top-level `instruction`; tool directories with `name`, `path`, `priority`, `recursive`, `includeDocs`, optional folder-specific `instruction`, and enabled selected scan entries; manually added exact tool files with `name`, `path`, and `priority` | Directory enumeration, file verification, help calls, invocation, or execution |
| `list_prompt` | `{}` | Prompts top-level `instruction`; reusable prompts with `name` and discovery `keywords` | Prompt-body retrieval or preview generation |
| `list_secret` | `{}` | Secrets top-level `instruction`; exact secret-file grants with `name`, `path`, and configured `format` | Opening secret files, detecting fields, or returning values |

Only document directories, tool directories, manually added exact tool files, and selected scanned tool files have a configured `priority`. Exact document files, selected scanned document files, prompts, and secret files do not have priority fields in the current configuration schema, so the server does not invent synthetic values for them.

#### `list`

Use `list` to inspect enabled document grants.

Request:

```json
{}
```

A successful response has this shape:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "instruction": "Search the approved local documents before using an unfamiliar workflow.",
  "directories": [
    {
      "name": "project-docs",
      "path": "C:\\path\\to\\project",
      "priority": 100
    }
  ],
  "files": [
    {
      "name": "release-notes",
      "path": "C:\\path\\to\\exact-document.md"
    }
  ],
  "meta": {
    "backend": "configuration",
    "indexed": false,
    "networkUsed": false,
    "enabledOnly": true,
    "directoriesReturned": 1,
    "filesReturned": 1,
    "configPath": "C:\\path\\to\\search.config.json"
  }
}
```

It does not enumerate files below a directory or search document contents.

#### `list_tool`

Use `list_tool` with an empty object to inspect enabled tool grants:

```json
{}
```

An enabled tool catalog response has this shape:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "instruction": "Read the selected tool documentation before using a local executable or script.",
  "directories": [
    {
      "name": "media-tools",
      "path": "C:\\path\\to\\media-tools",
      "priority": 100,
      "recursive": true,
      "includeDocs": true,
      "instruction": "Use these media utilities for conversion and inspection.",
      "scannedToolFiles": [
        {
          "name": "media-tools-ffprobe",
          "path": "C:\\path\\to\\media-tools\\bin\\ffprobe.exe",
          "priority": 100
        }
      ],
      "scannedDocumentFiles": [
        {
          "name": "media-tools-readme",
          "path": "C:\\path\\to\\media-tools\\README.md"
        }
      ]
    }
  ],
  "files": [
    {
      "name": "ffprobe",
      "path": "C:\\path\\to\\ffprobe.exe",
      "priority": 100
    }
  ],
  "meta": {
    "backend": "configuration",
    "indexed": false,
    "networkUsed": false,
    "enabledOnly": true,
    "executed": false,
    "directoriesReturned": 1,
    "filesReturned": 1,
    "scannedToolFilesReturned": 1,
    "scannedDocumentFilesReturned": 1,
    "toolFilesReturned": 2,
    "configPath": "C:\\path\\to\\search.config.json"
  }
}
```

`files` continues to contain manually added exact tool files. The top-level `instruction` is the Tools-tab Instruction and is always present. Saved scan selections stay nested under the tool folder that owns its separate Instruction and scan controls; that folder-specific `instruction` and the scan arrays are omitted when empty. No `origin` field is returned. A selected scanned tool is also discoverable by `find_tool`; a selected scanned document also appears as an exact document file in `list` and can be selected by name in `search` and read with `fetch`.

For an unfamiliar saved custom tool, keep the direct tool/document relationship rather than performing a broad machine search:

```text
list_tool({})
  -> read the Tools Instruction, then the parent folder's separate Instruction and direct scanned tool path
  -> identify a sibling scanned document alias, when one is present
search({ query: "usage and arguments", directories: [], files: ["folder-readme"] })
  -> fetch the returned absolute document path
  -> use find_tool only when verification or invocation metadata is needed
```

The nested tool and document aliases are unique case-insensitively within their respective grant categories. Agents should use a document alias, not its path, in the `search.files` selector; `fetch` still requires the absolute path returned by `search`.

#### `list_prompt`

Use `list_prompt` with an empty object. An enabled prompt catalog contains discovery metadata but no prompt text:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "instruction": "Confirm the selected reusable prompt before applying it.",
  "prompts": [
    {
      "name": "youtube-mv",
      "keywords": ["cinematic", "music video"]
    }
  ],
  "meta": {
    "backend": "configuration",
    "indexed": false,
    "networkUsed": false,
    "enabledOnly": true,
    "promptContentReturned": false,
    "promptsReturned": 1,
    "configPath": "C:\\path\\to\\search.config.json"
  }
}
```

#### `list_secret`

Use `list_secret` with an empty object. An enabled secret catalog exposes grant metadata but does not touch the secret files:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "instruction": "Prefer the granted file path and request only the secret fields that are needed.",
  "files": [
    {
      "name": "production-ftp",
      "path": "C:\\private\\ftp-credentials.txt",
      "format": "auto"
    }
  ],
  "meta": {
    "backend": "configuration",
    "indexed": false,
    "networkUsed": false,
    "enabledOnly": true,
    "filesRead": 0,
    "sensitiveValuesReturned": false,
    "filesReturned": 1,
    "configPath": "C:\\path\\to\\search.config.json"
  }
}
```

### `search`

Search enabled document roots and enabled exact document files. An enabled tool folder whose `includeDocs` setting allows documentation search is also a document-directory grant: it appears in `list` and can be passed by name through `search.directories`. Enabled scanned document selections saved under tool folders are exact document files: they appear in `list`, can be passed by name through `search.files`, and can be read with `fetch`. When a Tool folder name collides with a configured Document-folder name, `list` exposes the Tool grant under a collision-safe `tool:<name>` form; use that returned name. An unscoped request uses the complete default document allowlist:

```json
{
  "query": "minimax h3",
  "maxResults": 10
}
```

To search selected document grants, call `list`, keep only document-content terms in `query`, and pass the chosen configured names through `directories` and `files`:

```json
{
  "query": "runtime error",
  "directories": [
    "bts-app-logs"
  ],
  "files": [
    "bts-app-mywebviewplugin-log"
  ],
  "maxResults": 50
}
```

| Input field | Required | Rules |
| --- | --- | --- |
| `query` | Yes | Non-empty document-content terms, at most 500 characters. Punctuation, symbols, case, and letter-number boundaries are normalized into search terms. Do not put grant names here merely to constrain scope. |
| `maxResults` | No | Positive integer from 1 to 500, additionally capped by `limits.maxResults`. |
| `directories` | No | At most 500 configured document-directory names returned by `list`, including enabled Tool folders with `includeDocs`. Values are names, not paths. Supplying this or `files` activates selected mode. |
| `files` | No | At most 500 configured exact-document-file names returned by `list`. Values are names, not paths. Supplying this or `directories` activates selected mode. |

When neither selector is supplied, `scope.mode` is `all-enabled`. When either selector is supplied, `scope.mode` is `selected`; an omitted selector category means none from that category. One empty array is valid when the other contains at least one name, but two explicit empty arrays return `SEARCH_SCOPE_EMPTY`. Selected mode searches only the named document grants. An enabled Tool folder is searched only when its listed document-directory name is explicitly selected; unrelated Tool documentation is never added implicitly.

Names resolve exactly, with a unique case-insensitive exact match accepted for convenience. Repeated request names are deduplicated. Paths, wildcards, substrings, fuzzy names, unknown grants, and disabled grants are not accepted as selectors. The server validates the complete scope before scanning: `SEARCH_SCOPE_NOT_FOUND`, `SEARCH_SCOPE_DISABLED`, and `SEARCH_SCOPE_INVALID` fail atomically and never broaden or partially execute the search.

A successful response confirms the canonical names and resolved paths that were searched:

```json
{
  "scope": {
    "mode": "selected",
    "directories": [
      {
        "name": "bts-app-logs",
        "path": "C:\\path\\to\\BTS\\Logs",
        "priority": 100
      }
    ],
    "files": [
      {
        "name": "bts-app-mywebviewplugin-log",
        "path": "C:\\path\\to\\MyWebViewPlugin.log"
      }
    ]
  }
}
```

All normalized query terms must occur somewhere in a file for that file to qualify. Results are ranked per unique file, and byte-identical matching files are collapsed. Each top-level result contains:

- `path`: verified absolute file path.
- `lineNumber`: 1-based line number for the best snippet.
- `lineText`, `lineTextLength`, `lineTextStartColumn`, and `lineTextTruncated`: bounded preview details.
- `matchType`: `exact_phrase`, `all_terms_line`, or `all_terms_file`.
- `matchedTerms`: terms matched by the primary line.
- `grant`: configured provenance with `type` (`directory` or `file`) and canonical `name`.
- `sourceRoot` and `relativePath`: enumeration-root and relative-path details.
- `pathMatchedTerms` and `fileMatchedTerms`: path-level and whole-file coverage.
- `matchCount` and `returnedMatchCount`: total matching lines and snippets returned.
- `additionalMatches`: optional secondary snippets from the same file.
- `duplicateCount`: byte-identical copies omitted from top-level results.
- `score`: internal ranking score.

The response also includes `queryPlan`, `scope`, `warnings`, and `meta`. Search metadata reports `scopeMode`, selected directory/file counts, the enumeration backend, elapsed time, truncation, unique-file and snippet counts, and scan counters such as files considered, read, matched, ignored, linked, oversized, binary, duplicated, or affected by permission errors.

Warnings use `code`, `message`, and an optional `path`. A successful response can still be partial when `meta.truncated` is true because a result, file, or time limit was reached.

### `fetch`

Return the complete text and identity of one document selected from `search`.

Request:

```json
{
  "path": "C:\\full\\path\\returned-by-search\\README.md"
}
```

`path` is required and must be absolute. A successful response contains:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "path": "C:\\full\\path\\README.md",
  "encoding": "utf-8",
  "hasBom": false,
  "sizeBytes": 2048,
  "lineCount": 48,
  "sha256": "hexadecimal-content-identity",
  "content": "Complete document text"
}
```

`fetch` rejects relative paths, missing or non-regular files, disallowed links or junctions, ignored files, files outside the configured document grants, configured secret paths, binary content, and files larger than `limits.maxFetchBytes`.

### `find_tool`

Resolve a particular executable or script from enabled tool directories, enabled manually added exact tool-file grants, and enabled saved scanned tool selections.

Request:

```json
{
  "query": "stable audio 3",
  "maxResults": 10
}
```

`query` is required and limited to 500 characters. `maxResults` is optional, must be a positive integer no greater than 500, and is capped by `limits.maxResults`. Letter-number names such as `audio3` are normalized so they can match spaced queries such as `audio 3`.

Each result contains:

- `name`, `path`, `workingDirectory`, `relativePath`, and `extension`.
- `verified: true` after the path has been confirmed as a regular, non-link, allowlisted file.
- `type` and `invocation` metadata.
- `source` (`directory` or `exact-file`), `sourceName`, and configured `priority`.
- `documentationSearchEnabled`, indicating whether nearby documentation can be searched.
- `score`, `matchedTerms`, and `allTermsMatched`.

Invocation metadata has `kind`, `command`, `argumentsPrefix`, and `requiresEnvironment`:

| File type | `type` | `invocation.kind` | Typical command |
| --- | --- | --- | --- |
| `.exe` or `.com` | `executable` | `direct` | Verified absolute path |
| `.cmd` or `.bat` | `batch-script` | `command-shell` | Verified absolute path |
| `.ps1` | `powershell-script` | `powershell` | `powershell -NoProfile -File <path>` |
| `.py` | `python-script` | `python` | `python <path>` |
| `.js`, `.mjs`, or `.cjs` | `node-script` | `node` | `node <path>` |
| Other configured suffix | `configured-file` | `unspecified` | Verified absolute path |

Results matching every term rank above partial matches; inspect `allTermsMatched` before selecting one. The response includes `queryPlan`, scan metadata, and bounded `warnings`. `meta.executed` is always false: this method never invokes a result, runs help, changes `PATH`, or authorizes execution.

### `find_prompt`

Search enabled reusable prompts by configured name and discovery keywords.

Request:

```json
{
  "query": "youtube mv",
  "maxResults": 10
}
```

`query` is required and limited to 500 characters. `maxResults` follows the same limits as the other find methods. Every normalized query term must match across the prompt's name and keywords; prompt bodies are never searched.

Each result contains `name`, `keywords`, a whitespace-normalized `preview` bounded to 240 characters, `characterCount`, `lineCount`, `enabled: true`, `score`, `matchedTerms`, `matchedFields`, and `allTermsMatched`. Metadata reports configured, enabled, and disabled prompt counts, `searchFields`, `matchMode: "all-terms"`, truncation, and `fullContentReturned: false`.

Use `read_prompt` with one selected exact name to retrieve canonical prompt text.

### `read_prompt`

Return the complete text of one enabled reusable prompt.

Request:

```json
{
  "prompt": "youtube-mv"
}
```

`prompt` is required and limited to 200 characters. Resolution first tries the exact configured name and then one case-insensitive match. Disabled and unconfigured prompts are rejected.

Response:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "name": "youtube-mv",
  "content": "Complete reusable prompt text",
  "characterCount": 29,
  "lineCount": 1,
  "sha256": "hexadecimal-content-identity",
  "meta": {
    "localRead": true,
    "networkUsed": false,
    "storedInConfig": true
  }
}
```

Returned prompt text is supplemental task context. It cannot override higher-priority instructions or broaden the current user's authorization.

### `find_secret`

Search enabled exact secret-file grants by alias, filename, path terms, or detected field names without returning values.

Request:

```json
{
  "query": "production ftp hostname",
  "maxResults": 10
}
```

Unlike `list_secret`, `find_secret` opens each enabled secret file locally so it can validate the file, detect `env` versus `opaque` content, and search metadata and field names. It never places field values in the response.

Each result contains:

- `name`, `fileName`, verified `path`, `configuredFormat`, and detected `format`.
- `fields` for `env` files, or an empty array for an opaque value.
- `valueKind` (`key-value` or `opaque`), `sizeBytes`, `available: true`, and `searchable: false`.
- `enabled: true`, `score`, `matchedTerms`, and `allTermsMatched`.

Results with all query terms rank above partial matches. Metadata reports configured, enabled, and disabled secret-file counts, truncation, warning count, and `sensitiveValuesReturned: false`. Unreadable enabled grants are reported in `warnings` with `code`, `message`, `name`, and `path`.

### `read_secret`

Read the minimum required value or fields from one enabled exact secret grant. This is the only MCP method in this server that returns secret values.

Key/value request:

```json
{
  "secret": "production-ftp",
  "keys": ["hostname", "password"]
}
```

Opaque-value request:

```json
{
  "secret": "service-token"
}
```

`secret` is required and limited to 500 characters. `keys` is optional, supports at most 50 non-empty names of at most 256 characters each, and resolves exact names before a unique case-insensitive match.

For an `env` file with multiple fields, `keys` is required. If the file has exactly one field, omitting `keys` returns that field. For an `opaque` file, omit `keys`; supplying field names is rejected.

A successful response always includes `sensitive: true`, `searchable: false`, `name`, `fileName`, verified `path`, detected `format`, and local-read metadata. It then contains either:

```json
{
  "values": {
    "hostname": "<sensitive value>",
    "password": "<sensitive value>"
  }
}
```

or:

```json
{
  "value": "<sensitive opaque value>"
}
```

Do not repeat, log, persist, or expose returned values to unrelated tools. Prefer passing the exact path returned by `find_secret` directly to the authorized program whenever that avoids retrieving values.

### Recommended method sequences

Use the catalog methods for orientation, then narrow and retrieve only what the task needs:

```text
list_tool   -> direct saved path or find_tool -> search/fetch selected sibling documentation -> authorized help/preflight/execution
list_prompt -> find_prompt -> read_prompt for one selected prompt
list_secret -> find_secret -> read_secret only when individual values are required
list        -> search with optional directory/file names -> fetch one selected document
```

The catalog methods themselves do not authorize later execution or secret access. Normal user authorization and safety checks still apply to every subsequent operation.

## Configuration UI

Start the local UI:

```powershell
npm run ui
```

It binds only to `127.0.0.1`, opens the default browser, and edits the local `config/search.config.json`. The active file is ignored by Git because it can contain personal paths, prompt text, and secret-file locations. If it is missing, `npm run ui` creates it from the safe [config/search.config.example.json](config/search.config.example.json) without overwriting an existing configuration.

From the UI you can:

- Edit one collapsed **Catalog Instruction** in each of the **Prompts**, **Documents**, **Tools**, and **Secrets** tabs. Its compact status keeps the matching `list` method visible without echoing raw Instruction text in the working area; saving writes independent `instructions.documents`, `instructions.tools`, `instructions.prompts`, and `instructions.secrets` values. The matching catalog call returns only its own top-level `instruction`.
- Use the dense desktop workspace to keep catalogs in view: import controls remain beside compact Instruction controls on wide screens, and catalog lists and inspectors use independent surfaces so a short list does not inherit a long editor's height. A keyboard-accessible vertical splitter lets an operator tune each master/detail workspace without changing configuration. Prompts use a filterable name/keyword catalog plus one selected-item editor, including a Focus editor mode for long prompt bodies. Documents use one filterable grant catalog for folder roots and exact files, with a selected-grant inspector for paths, validation, priority, and scope; matching and read-only search remain compact utilities. The Tools tab uses the same operator model: choose a source from a compact catalog, then use one selected-source inspector for settings, Tool results, Document results, and Folder Instruction. Each resource result tab owns its matching scan action, so no type filter is needed to isolate the work. Secrets use a filterable exact-file catalog and selected-secret inspector that expose only aliases, configured paths, format metadata, detected field names, and validation state—never secret values. Workspace identity colors are green for Prompts, blue for Documents, teal for Tools, and violet for Secrets; validation, warnings, and destructive actions retain consistent colors across tabs.
- Switch between **Prompts**, **Documents**, **Tools**, and **Secrets** while saving everything to the same private local configuration. The **Guide** tab (the `?` utility) gives a compact configuration-to-test flow, shows each MCP discovery path, and opens the relevant workspace.
- Use the reference guide to understand the complete flow: reusable prompts use `list_prompt`, `find_prompt`, and `read_prompt`; documents use `list`, `search`, and `fetch`; tools use `list_tool` before any needed `find_tool` fallback; secrets use `list_secret`, `find_secret`, and the narrowly scoped `read_secret`. The guide keeps discovery, execution, and secret-access boundaries explicit.
- Enable or disable any document folder, exact document, tool folder, exact tool, reusable prompt, or secret file without deleting it. Disabled entries are excluded before discovery or filesystem scanning begins.
- Drop several files or folders at once. On Windows, click **Open drop box**, then drag from File Explorer into the separate window so complete local paths are preserved.
- Browse for or paste recursively searched folders and named exact files. Document directory names and exact-file names must be unique within their respective categories.
- Register tool folders recursively or exact tool files. Tool folders include matching documentation by default, so a project folder can expose both a script and its nearby `README.md`.
- Use **Scan tools** from the selected Tool source's **Tools** tab or **Scan documents** from its **Documents** tab to select matching files as full paths. Each tab owns an independent **Include subfolders** toggle: the Tools setting is `recursive` and controls both nested Tool scans and recursive tool discovery; the Documents setting is `documentRecursive` and controls only nested Document scans. Existing configurations without `documentRecursive` inherit their `recursive` value, preserving their current scope until edited. The scans use only the current Tool or Documents matching rules; they ignore the source's **Include documentation** setting and general ignore patterns, while built-in link and secret safety checks still apply. Each resource tab presents only its matching saved selections in a filterable compact table; select one to edit its alias, enabled state, and—for tools—individual priority. The **Instruction** tab owns the source's multiline Folder Instruction. New aliases start as `folder-name-file-name` and receive `-2`, `-3`, and so on if needed. Enabled scanned tools appear directly in `list_tool` and are exact grants for `find_tool`; enabled scanned documents appear in `list`, `search`, and `fetch` as exact document grants. Folder-disabled or row-disabled selections are omitted from MCP responses. Each folder source has a configurable **Result limit** from 1 to 5000 (default 500); reaching it produces an explicit warning, and the filter-aware **Remove matches** action clears matching selections in bulk. See [Tools Operator Workspace Design](docs/TOOLS_OPERATOR_WORKSPACE_DESIGN.md) for the interaction model and verification criteria.
- Create reusable prompts with a unique name or alias and optional semicolon-separated discovery keywords. Select a compact catalog row to edit its full multiline text, duplicate it, or delete it without expanding all saved prompts. The saved prompt can be discovered and read through MCP without creating a separate file.
- Register exact secret files only. Folders and links are rejected; select a compact catalog row to edit its alias, configured path, format policy, and enabled state. The UI detects field names but never displays or stores secret values. See [Secrets Operator Workspace Design](docs/SECRETS_OPERATOR_WORKSPACE_DESIGN.md) for the workspace and safety contract.
- Control executable and script suffixes such as `.exe;.cmd;.bat;.ps1;.py;.js;.mjs` and test the saved catalog with the same `find_tool` resolver used by the agent.
- Enter suffix patterns such as `.json;.ai.md;.md;.txt`. See [Documents Operator Workspace Design](docs/DOCUMENTS_OPERATOR_WORKSPACE_DESIGN.md) for the Documents-tab interaction model and verification criteria.
- Edit exact filenames, ignore rules, snippets per file, and safety limits. Additional ignore patterns accept semicolons or one pattern per line.
- Validate every current directory and file path without saving. The UI checks unsaved and disabled Document, Tool, and Secret rows plus the optional ignore file, reports expected-type, missing, link, and readability failures on each row, and rechecks an edited path when its field loses focus.
- Save only after full schema validation; the previous file is retained as `search.config.json.bak`.
- Run a local test search using the saved configuration.

Keep the terminal running while using the UI. Stop it with <kbd>Ctrl</kbd>+<kbd>C</kbd>. Configuration changes are picked up by the MCP server on its next call.

## Manual configuration

Edit the local `config/search.config.json` to define named sources, directories, allowed suffixes, exact filenames, or individual files. Run `npm run setup:config` once to create it when needed. Paths support `${ENV_NAME}`, `%ENV_NAME%`, `~`, absolute paths, and paths relative to the config file.

```json
{
  "version": 1,
  "instructions": {
    "documents": "Search the approved local documents before using an unfamiliar workflow.",
    "tools": "Read the selected tool documentation before using a local executable or script.",
    "prompts": "Confirm the selected reusable prompt before applying it.",
    "secrets": "Prefer the granted file path and request only the secret fields that are needed."
  },
  "defaultSource": "local",
  "sources": {
    "local": {
      "roots": [
        {
          "name": "my-documentation",
          "path": "C:\\path\\to\\documentation",
          "priority": 100,
          "enabled": true
        }
      ],
      "extensions": ".json;.ai.md;.md;.txt",
      "fileNames": ["README.md"],
      "files": [
        {
          "name": "one-exact-document",
          "path": "C:\\path\\to\\one\\exact-file.json",
          "enabled": true
        }
      ]
    }
  }
}
```

The top-level `instructions` object holds four independent Instructions: `documents` is returned by `list`, `tools` by `list_tool`, `prompts` by `list_prompt`, and `secrets` by `list_secret`. Each is optional, defaults to an empty string, is trimmed at its outer edges while preserving internal paragraphs, and is limited to 5,000 characters. It supplies human-authored context only and never changes the enabled-grant boundary. An older root `humanNote` is accepted as a compatibility fallback for any missing Instruction; the Configuration UI migrates it to `instructions` on its next save.

See [Catalog Instructions Design](docs/CATALOG_INSTRUCTIONS_DESIGN.md) for the complete UI, migration, response, and safety contract. The commercial workspace presentation and interaction contract are documented in [Commercial Operator UI Polish](docs/COMMERCIAL_OPERATOR_UI_POLISH.md). The Documents-tab master-detail workflow is specified in [Documents Operator Workspace Design](docs/DOCUMENTS_OPERATOR_WORKSPACE_DESIGN.md), the Tools-tab workflow is specified in [Tools Operator Workspace Design](docs/TOOLS_OPERATOR_WORKSPACE_DESIGN.md), and the Secrets-tab workflow is specified in [Secrets Operator Workspace Design](docs/SECRETS_OPERATOR_WORKSPACE_DESIGN.md).

`roots` are searched recursively. Root names must be unique case-insensitively within their source. Every `files` entry requires a human-readable `name` and exact `path`; exact-file names and paths must each be unique within their source, and exact grants do not need to match an extension or filename rule. `enabled` defaults to `true`, or set it to `false` to retain an entry without scanning or granting it. Path-only objects and string file entries are invalid. A disabled row deactivates that grant rather than creating a deny rule, so the same physical file can remain accessible when it is covered by another enabled parent folder. `extensions` accepts either an array of suffixes or a semicolon-separated string; `.json`, `*.json`, `**.json`, and `**/*.json` all normalize to the same `.json` suffix rule. `fileNames` contains exact names matched anywhere beneath a root.

Search scans every eligible line so all query terms may match on one line or across the file. It returns the highest-quality snippet for each ranked file, favoring useful headings and prose over badges, image markup, and URL-heavy lines. `limits.maxMatchesPerFile` controls how many snippets are retained inside each file result and defaults to `1`; values above one add entries under `additionalMatches` without repeating the file as another top-level result. `matchCount` reports all matching lines, `fileMatchedTerms` reports terms found across the file, and `duplicateCount` reports byte-identical copies omitted from that result. Hashing is performed only after a file matches.

Tool access is configured separately in the same file:

```json
{
  "tools": {
    "directories": [
      {
        "name": "media-tools",
        "path": "C:\\path\\to\\tool-folder",
        "priority": 100,
        "recursive": true,
        "documentRecursive": true,
        "scanLimit": 500,
        "includeDocs": true,
        "enabled": true,
        "instruction": "Custom video helpers and their reference documentation.",
        "scannedToolFiles": [
          {
            "name": "media-tools-generate-video",
            "path": "C:\\path\\to\\tool-folder\\generate_video.py",
            "priority": 150,
            "enabled": true
          }
        ],
        "scannedDocumentFiles": [
          {
            "name": "media-tools-readme",
            "path": "C:\\path\\to\\tool-folder\\docs\\README.md",
            "enabled": true
          }
        ]
      }
    ],
    "files": [
      {
        "name": "one-exact-script",
        "path": "C:\\path\\to\\one-tool.py",
        "priority": 100,
        "enabled": true
      }
    ],
    "extensions": ".exe;.cmd;.bat;.ps1;.py;.js;.mjs"
  }
}
```

Enabled `directories` use `recursive` for recursive tool discovery by default. `documentRecursive` controls only the UI's Document scan scope; when it is omitted, it inherits `recursive` for backward compatibility. `scanLimit` controls the maximum number of matching Tool or Document paths reviewed in one scan for that source. It defaults to `500`, accepts values from `1` through `5000`, and is not added to the public `list_tool` response. `includeDocs` makes matching documentation beneath that enabled folder available to `search` and `fetch`, and makes the Tool folder name an explicit directory selector in `list` and `search.directories`; document suffixes and exact filenames still come from the selected document source. If that Tool name collides with a Document-folder name, `list` returns a collision-safe `tool:<name>` selector for the Tool grant. Exact tool files do not need to match a suffix. An `instruction` nested inside a tool directory is optional and belongs only to that folder; it is separate from the always-returned Tools top-level `instruction`. `scannedToolFiles` and `scannedDocumentFiles` are optional explicit selections created by the UI scan controls; a scan result is not selected until it is saved. Tool names must be unique case-insensitively across `tools.files` and every `scannedToolFiles` entry. Document names must be unique case-insensitively across the default source's `files` and every `scannedDocumentFiles` entry. A disabled folder disables all of its saved child selections; disabled child selections are omitted from `list_tool`, `list`, `find_tool`, `search`, and `fetch`.

In the Configuration UI, **Scan tools** is available from the selected source's **Tools** tab and **Scan documents** from its **Documents** tab. Their independent **Include subfolders** controls map to `recursive` and `documentRecursive`, respectively: `true` scans the complete matching tree, while `false` scans only files directly inside the attached folder. The Tools value continues to govern recursive tool discovery; the Documents value does not broaden document discovery, search, or `fetch`. They do not apply global ignore patterns or the source's `includeDocs` catalog setting. Tool scans use only `tools.extensions`; document scans use only the selected Documents source's suffix and exact-filename rules. Each source owns its Folder Instruction and saved Tool/Document grants in the selected-source inspector. Separate Tool and Document tabs keep child grants out of the source catalog and remove type filtering while still allowing alias, enabled-state, and Tool-priority changes. The Overview, Tools, Documents, and Instruction sections share a stable minimum-height inspector without an inspector scrollbar. Scan settings collapse into an anchored **Scan options** overlay, and large result sets use compact pages while the selected grant editor remains visible beside them on desktop. Saving writes the source-owned Instruction, selected rows, independent scan scopes, and result limit to the folder configuration. Enabled Tool selections are returned nested under their folder in `list_tool` and directly resolve through `find_tool`; enabled Document selections are returned nested in `list_tool`, also appear as exact file entries in `list`, and are searchable/fetchable through `search` and `fetch`. Results are full absolute paths and use the selected source's **Result limit** rather than a fixed cap. When more matches exist, the scan summary identifies the reached limit so it can be increased before rescanning. **Enable**, **Disable**, and **Remove matches** apply to every row matching the current filters, not only the current page, allowing a large scan to be reviewed or cleared in one operation. Built-in link and secret safety exclusions continue to apply.

Reusable prompts are stored directly in the private local configuration:

```json
{
  "prompts": [
    {
      "name": "youtube-mv",
      "keywords": ["music video", "cinematic", "youtube"],
      "content": "Create a cinematic YouTube music video using the supplied assets...",
      "enabled": true
    }
  ]
}
```

Names and aliases must be unique without regard to letter case. `keywords` is optional and accepts an array or a semicolon/comma-separated string. `find_prompt` searches only enabled names and keywords—never prompt bodies—and requires every query term to match across those two fields. For example, `short mv` excludes a prompt matching only `mv`, while the broader one-word query `mv` can return both. When several prompts qualify, prefer a case-insensitive exact name or alias match; otherwise ask the user to disambiguate before reading any full prompt body. `read_prompt` retrieves the canonical full text and SHA-256 identity of the selected exact name. A disabled prompt remains editable in the UI but cannot be found or read. Stored prompt text supplements the current user request and does not authorize unrelated side effects or override higher-priority instructions.

Secret access is configured separately and accepts exact files only:

```json
{
  "secrets": {
    "files": [
      {
        "name": "production-ftp",
        "path": "C:\\private\\ftp-credentials.txt",
        "format": "auto",
        "enabled": true
      },
      {
        "name": "service-token",
        "path": "C:\\private\\service.token",
        "format": "opaque",
        "enabled": true
      }
    ],
    "maxFileBytes": 256000
  }
}
```

`format` can be `auto`, `env`, or `opaque`. Auto detection treats a strict file such as `hostname=ftp.example.com` and `password=...` as key/value data; other non-empty text is treated as one opaque token, password, or key. Values remain only in the source file and are read on demand. A disabled secret cannot be found or read, but its path remains protected from `search`, `fetch`, and `find_tool` so credentials cannot leak through another grant.

Use `find_secret` first. Prefer passing the returned path directly to a program through options such as `--env-file`, `--key-file`, or a tool-specific configuration argument. Call `read_secret` only when the program requires individual values, and request the minimum keys needed. MCP results can be retained by a client task log, so do not retrieve values unnecessarily or repeat them in chat, commands, files, or diagnostics.

Git tracks only the empty [configuration example](config/search.config.example.json), never the active configuration or its backup. Edit [config/.agent-searchignore](config/.agent-searchignore) using Git-ignore syntax to exclude generated or irrelevant directories. Negated `!patterns` are supported. In the UI, the separate **Additional ignore patterns** field accepts semicolons or newlines; the JSON form is an array with one Git-ignore pattern per item.

`fetch` is intentionally allowlisted: it only reads eligible files beneath configured roots or exact files listed by the human. It rejects relative paths, links, known credential locations and secret file types, binary files, ignored files, and oversized files.

## MCP registration

Run the server over STDIO:

```powershell
node .\src\server.mjs
```

Register it with a local Codex client:

```powershell
$agentDocRoot = (Get-Location).Path
codex mcp add local_doc_search --env "AGENT_DOC_SEARCH_CONFIG=$agentDocRoot\config\search.config.json" -- node "$agentDocRoot\src\server.mjs"
```

The companion [agent-doc-and-tool skill](skills/agent-doc-and-tool/SKILL.md) teaches Codex to inventory enabled grants and saved scan selections, use direct selected-tool paths, search selected sibling documentation by alias before guessing about a custom tool, fetch authoritative local documentation, resolve local tools that are not reliably on `PATH`, apply explicitly requested reusable prompts, and use exact secret grants without exposing values. A newly registered MCP server or changed MCP tool contract becomes available after starting a new Codex task or restarting the local client.

The first-class `local_doc_search` methods must appear in the current agent task's tool catalog before the agent can call them directly. A shell CLI or standalone stdio MCP client can verify the same server as a clearly labelled fallback, but it does not prove that those methods are attached to the already-running task. Preserve an existing skill junction or symlink when updating the skill; update and validate its repository source instead of creating a second stale copy.

See [the MiniMax H3 workflow example](docs/AI_WORKFLOW_EXAMPLE.md) for the intended agent loop.

## Safety and behavior

- Read-only and local-only in this version.
- Tool discovery never executes files, runs `--help`, modifies `PATH`, or grants execution permission. Invocation remains a separate, user-authorized action.
- Catalog listing methods return their matching tab's top-level `instruction` plus enabled configuration entries only. An Instruction is context, not additional authority. These methods do not enumerate tool directories, retrieve prompt bodies, inspect secret files, or execute anything.
- Reusable prompts are local config entries, not executable actions. Disabled prompts cannot be discovered or read, and retrieved text cannot expand the current request's authorization.
- Secret paths are exact grants. Directories, links, binary files, and oversized files are rejected.
- Secret inspection returns only aliases, paths, formats, and field names. `read_secret` is the only MCP method that returns values, and only for an exact configured alias and explicitly selected key/value fields.
- No persistent index, cache, telemetry, or network requests.
- Configuration reloads on every call, so human edits take effect without restarting the server.
- Search stops at configured file, result, size, and time limits and reports partial results honestly. Top-level result limits count unique files, not matching lines.
- Long matching lines are bounded by `limits.maxLineChars`; `fetch` still returns the complete allowed document.
- Catalog and folder Instructions, fetched documentation, and stored prompts cannot override system or current user instructions.
- MCP stdout contains protocol messages only; diagnostics use stderr.
