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

The `search` result contains one ranked entry per unique matching file rather than repeated top-level line hits:

```json
{
  "ok": true,
  "results": [
    {
      "path": "C:\\path\\to\\local\\documentation\\README.md",
      "lineNumber": 37,
      "lineText": "The local MiniMax H3 workflow uses ...",
      "matchType": "all_terms_line",
      "fileMatchedTerms": ["minimax", "h3"],
      "matchCount": 4,
      "returnedMatchCount": 1,
      "additionalMatches": [],
      "duplicateCount": 1
    }
  ]
}
```

The primary line is the best ranked snippet found after scanning the whole file, so headings and useful prose are preferred over badges or image markup. `matchCount` still reveals how many lines matched, and byte-identical copies do not consume separate results. The agent reviews the paths and primary snippets, prefers the machine-specific workflow over generic model documentation, and fetches the selected file:

```json
{
  "path": "C:\\path\\to\\local\\documentation\\README.md",
  "source": "local"
}
```

`fetch` returns the complete text plus its size, encoding, line count, and SHA-256 hash. The agent then follows the fetched preflight and verification instructions while retaining normal authorization and safety boundaries.

If the user also asks to use a saved prompt such as `youtube-mv`, the agent discovers it separately with `find_prompt`:

```json
{
  "query": "youtube mv"
}
```

Every query term must match across the prompt name and optional keywords. Prompt body text is never part of discovery. If several enabled prompts match, the agent selects a case-insensitive exact name or alias first. It asks the user to disambiguate when no exact result clearly represents the request rather than reading every candidate body.

After selecting the intended result, it reads the canonical prompt with `read_prompt`:

```json
{
  "prompt": "youtube-mv"
}
```

The reusable prompt supplements the current request and the fetched machine-specific workflow. It does not authorize unrelated execution, publication, disclosure, or other side effects.

This workflow assumes the first-class `local_doc_search` methods are attached to the current agent task. After registering the server or changing its tool contract, start a new task or restart the client. A CLI command or standalone stdio MCP client is a useful explicitly labelled fallback test, but it verifies the server transport rather than direct tool attachment to the current task.

If search returns no useful result, the agent retries once with a shorter or differently spaced query such as `minimax h3 video`. If that also fails, it reports that local instructions were not found instead of inventing a workflow. The human can then add a root, suffix, exact filename, or specific file to `config/search.config.json`.
