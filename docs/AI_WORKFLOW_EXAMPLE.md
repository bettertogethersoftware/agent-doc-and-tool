# AI workflow example: MiniMax H3

The user asks:

> Use MiniMax H3 to create a video.

If the agent does not already have verified machine-specific instructions, it calls the local MCP tool:

```json
{
  "query": "minimax h3",
  "source": "local"
}
```

The `search` result contains grounded lines rather than guessed instructions:

```json
{
  "ok": true,
  "results": [
    {
      "path": "C:\\Users\\jerry\\source\\repos\\...\\README.md",
      "lineNumber": 37,
      "lineText": "The local MiniMax H3 workflow uses ...",
      "matchType": "all_terms_line"
    }
  ]
}
```

The agent reviews the paths and line text, prefers the machine-specific workflow over generic model documentation, and fetches the selected file:

```json
{
  "path": "C:\\Users\\jerry\\source\\repos\\...\\README.md",
  "source": "local"
}
```

`fetch` returns the complete text plus its size, encoding, line count, and SHA-256 hash. The agent then follows the fetched preflight and verification instructions while retaining normal authorization and safety boundaries.

If search returns no useful result, the agent retries once with a shorter or differently spaced query such as `minimax h3 video`. If that also fails, it reports that local instructions were not found instead of inventing a workflow. The human can then add a root, suffix, exact filename, or specific file to `config/search.config.json`.
