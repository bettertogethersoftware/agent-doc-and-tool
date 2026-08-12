# Agent Docs & Tools

Read-only local documentation, tool, reusable-prompt, and exact secret-file access for AI agents. The package exposes eleven MCP tools:

- `list(source)` returns only the enabled document folders and enabled exact files configured for a source. Folder entries include their configured name, resolved path, and priority. It reports grants rather than recursively enumerating directory contents, and disabled entries are omitted.
- `search(query, source)` scans human-configured directories for allowed suffix patterns and exact filenames, plus explicitly listed files. It returns one ranked result per distinct matching file, led by the best matching line rather than the first line encountered. Byte-identical copies are collapsed. Each result includes the full path, 1-based line number, bounded line text, file-level match counts, and optional nested secondary snippets.
- `fetch(path, source)` returns the complete text and SHA-256 identity of a file selected from search results.
- `list_tool()` returns only enabled tool directories and exact tool files. Directory entries include name, resolved path, priority, recursion, and documentation-search settings; exact-file entries include name, resolved path, and priority. It does not enumerate, verify, invoke, or execute tools.
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

The four catalog methods provide a broad view of the grants that are currently enabled in the human configuration. They reload `config/search.config.json` on every call, resolve configured paths to absolute paths, and omit disabled entries entirely. They do not return disabled names, paths, or counts.

| MCP method | Input | Enabled entries returned | Deliberately not performed |
| --- | --- | --- | --- |
| `list` | `{"source":"local"}` | Document directories with `name`, `path`, and `priority`; exact document files with `path` | Recursive file enumeration or document-content search |
| `list_tool` | `{}` | Tool directories with `name`, `path`, `priority`, `recursive`, and `includeDocs`; exact tool files with `name`, `path`, and `priority` | Directory enumeration, file verification, help calls, invocation, or execution |
| `list_prompt` | `{}` | Reusable prompts with `name` and discovery `keywords` | Prompt-body retrieval or preview generation |
| `list_secret` | `{}` | Exact secret-file grants with `name`, `path`, and configured `format` | Opening secret files, detecting fields, or returning values |

Only document directories, tool directories, and exact tool files have a configured `priority`. Exact document files, prompts, and secret files do not have priority fields in the current configuration schema, so the server does not invent synthetic values for them.

#### `list`

Use `list` to inspect enabled document grants for one configured source.

Request:

```json
{
  "source": "local"
}
```

`source` is optional and defaults to `local`. A successful response has this shape:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "source": "local",
  "directories": [
    {
      "name": "project-docs",
      "path": "C:\\path\\to\\project",
      "priority": 100
    }
  ],
  "files": [
    {
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
  "directories": [
    {
      "name": "media-tools",
      "path": "C:\\path\\to\\media-tools",
      "priority": 100,
      "recursive": true,
      "includeDocs": true
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
    "configPath": "C:\\path\\to\\search.config.json"
  }
}
```

#### `list_prompt`

Use `list_prompt` with an empty object. An enabled prompt catalog contains discovery metadata but no prompt text:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
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

Search enabled document roots and enabled exact document files. When the selected source is the configured default source, the search also includes enabled tool directories whose `includeDocs` setting allows documentation search.

Request:

```json
{
  "query": "minimax h3",
  "source": "local",
  "maxResults": 10
}
```

| Input field | Required | Rules |
| --- | --- | --- |
| `query` | Yes | Non-empty text, at most 500 characters. Punctuation, symbols, case, and letter-number boundaries are normalized into search terms. |
| `source` | No | Configured source name; defaults to `local`. |
| `maxResults` | No | Positive integer from 1 to 500, additionally capped by `limits.maxResults`. |

All normalized query terms must occur somewhere in a file for that file to qualify. Results are ranked per unique file, and byte-identical matching files are collapsed. Each top-level result contains:

- `path`: verified absolute file path.
- `lineNumber`: 1-based line number for the best snippet.
- `lineText`, `lineTextLength`, `lineTextStartColumn`, and `lineTextTruncated`: bounded preview details.
- `matchType`: `exact_phrase`, `all_terms_line`, or `all_terms_file`.
- `matchedTerms`: terms matched by the primary line.
- `sourceRoot` and `relativePath`: grant provenance.
- `pathMatchedTerms` and `fileMatchedTerms`: path-level and whole-file coverage.
- `matchCount` and `returnedMatchCount`: total matching lines and snippets returned.
- `additionalMatches`: optional secondary snippets from the same file.
- `duplicateCount`: byte-identical copies omitted from top-level results.
- `score`: internal ranking score.

The response also includes `queryPlan`, `warnings`, and `meta`. Search metadata reports the enumeration backend, elapsed time, truncation, unique-file and snippet counts, and scan counters such as files considered, read, matched, ignored, linked, oversized, binary, duplicated, or affected by permission errors.

Warnings use `code`, `message`, and an optional `path`. A successful response can still be partial when `meta.truncated` is true because a result, file, or time limit was reached.

### `fetch`

Return the complete text and identity of one document selected from `search`.

Request:

```json
{
  "path": "C:\\full\\path\\returned-by-search\\README.md",
  "source": "local"
}
```

`path` is required and must be absolute. `source` is optional and defaults to `local`. A successful response contains:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "source": "local",
  "path": "C:\\full\\path\\README.md",
  "encoding": "utf-8",
  "hasBom": false,
  "sizeBytes": 2048,
  "lineCount": 48,
  "sha256": "hexadecimal-content-identity",
  "content": "Complete document text"
}
```

`fetch` rejects relative paths, missing or non-regular files, disallowed links or junctions, ignored files, files outside the selected grant, configured secret paths, binary content, and files larger than `limits.maxFetchBytes`.

### `find_tool`

Resolve a particular executable or script from enabled tool directories and enabled exact tool-file grants.

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
list_tool   -> find_tool   -> search/fetch nearby documentation -> authorized help/preflight/execution
list_prompt -> find_prompt -> read_prompt for one selected prompt
list_secret -> find_secret -> read_secret only when individual values are required
list        -> search      -> fetch one selected document
```

The catalog methods themselves do not authorize later execution or secret access. Normal user authorization and safety checks still apply to every subsequent operation.

## Configuration UI

Start the local UI:

```powershell
npm run ui
```

It binds only to `127.0.0.1`, opens the default browser, and edits the local `config/search.config.json`. The active file is ignored by Git because it can contain personal paths, prompt text, and secret-file locations. If it is missing, `npm run ui` creates it from the safe [config/search.config.example.json](config/search.config.example.json) without overwriting an existing configuration.

From the UI you can:

- Switch between **Prompts**, **Documents**, **Tools**, and **Secrets** tabs while saving everything to the same private local configuration.
- Enable or disable any document folder, exact document, tool folder, exact tool, reusable prompt, or secret file without deleting it. Disabled entries are excluded before discovery or filesystem scanning begins.
- Drop several files or folders at once. On Windows, click **Open Windows drop box**, then drag from File Explorer into the separate window so complete local paths are preserved.
- Browse for or paste recursively searched folders and exact files.
- Register tool folders recursively or exact tool files. Tool folders include matching documentation by default, so a project folder can expose both a script and its nearby `README.md`.
- Create reusable prompts with a unique name or alias, optional semicolon-separated discovery keywords, and an editable multiline text area. The saved prompt can be discovered and read through MCP without creating a separate file.
- Register exact secret files only. Folders and links are rejected; the UI detects key names but never displays or stores secret values.
- Control executable and script suffixes such as `.exe;.cmd;.bat;.ps1;.py;.js;.mjs` and test the saved catalog with the same `find_tool` resolver used by the agent.
- Enter suffix patterns such as `.json;.ai.md;.md;.txt`.
- Edit exact filenames, ignore rules, snippets per file, and safety limits. Additional ignore patterns accept semicolons or one pattern per line.
- Save only after full schema validation; the previous file is retained as `search.config.json.bak`.
- Run a local test search using the saved configuration.

Keep the terminal running while using the UI. Stop it with <kbd>Ctrl</kbd>+<kbd>C</kbd>. Configuration changes are picked up by the MCP server on its next call.

## Manual configuration

Edit the local `config/search.config.json` to define named sources, directories, allowed suffixes, exact filenames, or individual files. Run `npm run setup:config` once to create it when needed. Paths support `${ENV_NAME}`, `%ENV_NAME%`, `~`, absolute paths, and paths relative to the config file.

```json
{
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
          "path": "C:\\path\\to\\one\\exact-file.json",
          "enabled": true
        }
      ]
    }
  }
}
```

`roots` are searched recursively. `files` are exact grants and do not need to match an extension or filename rule. Set `enabled` to `false` to retain an entry without scanning or granting it; existing string entries and objects without `enabled` remain enabled for backward compatibility. A disabled row deactivates that grant rather than creating a deny rule, so the same path can remain accessible when it is also covered by another enabled parent folder or duplicate grant. `extensions` accepts either an array of suffixes or a semicolon-separated string; `.json`, `*.json`, `**.json`, and `**/*.json` all normalize to the same `.json` suffix rule. `fileNames` contains exact names matched anywhere beneath a root.

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
        "includeDocs": true,
        "enabled": true
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

Enabled `directories` are scanned recursively by default. `includeDocs` also makes matching documentation beneath that enabled folder available to `search` and `fetch`; document suffixes and exact filenames still come from the selected document source. Global ignore rules apply to both scans. Exact tool files do not need to match a suffix.

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

The companion [agent-doc-and-tool skill](skills/agent-doc-and-tool/SKILL.md) teaches Codex to inventory enabled grants, search before guessing, fetch authoritative local documentation, resolve local tools that are not reliably on `PATH`, apply explicitly requested reusable prompts, and use exact secret grants without exposing values. A newly registered MCP server or changed MCP tool contract becomes available after starting a new Codex task or restarting the local client.

The first-class `local_doc_search` methods must appear in the current agent task's tool catalog before the agent can call them directly. A shell CLI or standalone stdio MCP client can verify the same server as a clearly labelled fallback, but it does not prove that those methods are attached to the already-running task. Preserve an existing skill junction or symlink when updating the skill; update and validate its repository source instead of creating a second stale copy.

See [the MiniMax H3 workflow example](docs/AI_WORKFLOW_EXAMPLE.md) for the intended agent loop.

## Safety and behavior

- Read-only and local-only in this version.
- Tool discovery never executes files, runs `--help`, modifies `PATH`, or grants execution permission. Invocation remains a separate, user-authorized action.
- Catalog listing methods return enabled configuration entries only. They do not enumerate tool directories, retrieve prompt bodies, inspect secret files, or execute anything.
- Reusable prompts are local config entries, not executable actions. Disabled prompts cannot be discovered or read, and retrieved text cannot expand the current request's authorization.
- Secret paths are exact grants. Directories, links, binary files, and oversized files are rejected.
- Secret inspection returns only aliases, paths, formats, and field names. `read_secret` is the only MCP method that returns values, and only for an exact configured alias and explicitly selected key/value fields.
- No persistent index, cache, telemetry, or network requests.
- Configuration reloads on every call, so human edits take effect without restarting the server.
- Search stops at configured file, result, size, and time limits and reports partial results honestly. Top-level result limits count unique files, not matching lines.
- Long matching lines are bounded by `limits.maxLineChars`; `fetch` still returns the complete allowed document.
- Fetched documentation and stored prompts cannot override system or current user instructions.
- MCP stdout contains protocol messages only; diagnostics use stderr.
