# Agent Docs & Tools

Read-only local documentation, tool, reusable-prompt, and exact secret-file access for AI agents. The package exposes seven MCP tools:

- `search(query, source)` scans human-configured directories for allowed suffix patterns and exact filenames, plus explicitly listed files. It returns JSON containing the full path, 1-based line number, and matching line text. Exceptionally long one-line documents return a bounded excerpt with truncation metadata.
- `fetch(path, source)` returns the complete text and SHA-256 identity of a file selected from search results.
- `find_tool(query)` resolves human-allowlisted executables and scripts by name or capability. It returns a verified full path, type, and invocation metadata without running anything or changing `PATH`.
- `find_prompt(query)` finds enabled reusable prompts by name, alias, or optional keywords and returns names with bounded previews. Every query term must match across the name and keywords; prompt body text is never searched.
- `read_prompt(prompt)` returns the complete text and SHA-256 identity of one enabled prompt selected by its exact configured name or alias.
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
node .\src\cli.mjs search --query "minimax h3" --source local
node .\src\cli.mjs fetch --path "C:\full\path\returned-by-search\README.md" --source local
node .\src\cli.mjs find-tool --query "ffprobe"
node .\src\cli.mjs find-prompt --query "youtube mv"
node .\src\cli.mjs read-prompt --prompt "youtube-mv"
```

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
- Edit exact filenames, ignore rules, and safety limits.
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

Git tracks only the empty [configuration example](config/search.config.example.json), never the active configuration or its backup. Edit [config/.agent-searchignore](config/.agent-searchignore) using Git-ignore syntax to exclude generated or irrelevant directories. Negated `!patterns` are supported.

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

The companion [agent-doc-and-tool skill](skills/agent-doc-and-tool/SKILL.md) teaches Codex to search before guessing, fetch authoritative local documentation, resolve local tools that are not reliably on `PATH`, apply explicitly requested reusable prompts, and use exact secret grants without exposing values. A newly registered MCP server or changed MCP tool contract becomes available after starting a new Codex task or restarting the local client.

The first-class `local_doc_search` methods must appear in the current agent task's tool catalog before the agent can call them directly. A shell CLI or standalone stdio MCP client can verify the same server as a clearly labelled fallback, but it does not prove that those methods are attached to the already-running task. Preserve an existing skill junction or symlink when updating the skill; update and validate its repository source instead of creating a second stale copy.

See [the MiniMax H3 workflow example](docs/AI_WORKFLOW_EXAMPLE.md) for the intended agent loop.

## Safety and behavior

- Read-only and local-only in this version.
- Tool discovery never executes files, runs `--help`, modifies `PATH`, or grants execution permission. Invocation remains a separate, user-authorized action.
- Reusable prompts are local config entries, not executable actions. Disabled prompts cannot be discovered or read, and retrieved text cannot expand the current request's authorization.
- Secret paths are exact grants. Directories, links, binary files, and oversized files are rejected.
- Secret inspection returns only aliases, paths, formats, and field names. `read_secret` is the only MCP method that returns values, and only for an exact configured alias and explicitly selected key/value fields.
- No persistent index, cache, telemetry, or network requests.
- Configuration reloads on every call, so human edits take effect without restarting the server.
- Search stops at configured file, result, size, and time limits and reports partial results honestly.
- Long matching lines are bounded by `limits.maxLineChars`; `fetch` still returns the complete allowed document.
- Fetched documentation and stored prompts cannot override system or current user instructions.
- MCP stdout contains protocol messages only; diagnostics use stderr.
