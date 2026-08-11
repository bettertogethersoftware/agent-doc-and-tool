# Agent Document Search

Read-only local documentation search for AI agents. The package exposes an MCP server with two tools:

- `search(query, source)` scans human-configured directories for allowed suffix patterns and exact filenames, plus explicitly listed files. It returns JSON containing the full path, 1-based line number, and matching line text. Exceptionally long one-line documents return a bounded excerpt with truncation metadata.
- `fetch(path, source)` returns the complete text and SHA-256 identity of a file selected from search results.

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
```

## Configuration UI

Start the local UI:

```powershell
npm run ui
```

It binds only to `127.0.0.1`, opens the default browser, and edits the local `config/search.config.json`. The active file is ignored by Git because it can contain personal paths. If it is missing, `npm run ui` creates it from the safe [config/search.config.example.json](config/search.config.example.json) without overwriting an existing configuration.

From the UI you can:

- Drop several files or folders at once. On Windows, use the native drop box when the browser hides full local paths.
- Browse for or paste recursively searched folders and exact files.
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
          "priority": 100
        }
      ],
      "extensions": ".json;.ai.md;.md;.txt",
      "fileNames": ["README.md"],
      "files": [
        "C:\\path\\to\\one\\exact-file.json"
      ]
    }
  }
}
```

`roots` are searched recursively. `files` are exact grants and do not need to match an extension or filename rule. `extensions` accepts either an array of suffixes or a semicolon-separated string; `.json`, `*.json`, `**.json`, and `**/*.json` all normalize to the same `.json` suffix rule. `fileNames` contains exact names matched anywhere beneath a root.

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

The companion [local-doc-search skill](skills/local-doc-search/SKILL.md) teaches Codex to search before guessing, select the authoritative result, and fetch the exact document. A newly registered MCP server becomes available after starting a new Codex task or restarting the local client.

See [the MiniMax H3 workflow example](docs/AI_WORKFLOW_EXAMPLE.md) for the intended agent loop.

## Safety and behavior

- Read-only and local-only in this version.
- No persistent index, cache, telemetry, or network requests.
- Configuration reloads on every call, so human edits take effect without restarting the server.
- Search stops at configured file, result, size, and time limits and reports partial results honestly.
- Long matching lines are bounded by `limits.maxLineChars`; `fetch` still returns the complete allowed document.
- Fetched documentation is contextual evidence, not permission to override system or user instructions.
- MCP stdout contains protocol messages only; diagnostics use stderr.
