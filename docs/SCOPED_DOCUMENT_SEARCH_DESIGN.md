# Scoped Document Search Design

Status: Implemented and verified  
Implemented: 2026-08-12  
Scope: MCP contract, service behavior, configuration validation, documentation, tests, and installed skill guidance

## Problem

Before this implementation, the document-search MCP exposed:

~~~json
{
  "query": "error",
  "maxResults": 50
}
~~~

This can search every enabled document grant, but it cannot express a request
such as:

> Search only the BTS application logs and the MyWebViewPlugin log for error.

The catalog method already returns stable names for enabled document
directories and enabled exact document files:

~~~json
{
  "directories": [
    {
      "name": "bts-app-logs",
      "path": "C:\\Users\\i7desktop\\Documents\\BetterTogetherSoftwareData\\BTS\\Logs",
      "priority": 100
    }
  ],
  "files": [
    {
      "name": "bts-app-mywebviewplugin-log",
      "path": "C:\\Users\\i7desktop\\Documents\\BetterTogetherSoftwareData\\BTS\\WebViewPluginData\\logs\\MyWebViewPlugin.log"
    }
  ]
}
~~~

However, those names cannot currently be passed back to search as filesystem
scope. Placing a grant name inside the query is not equivalent:

~~~json
{
  "query": "bts-app-logs error"
}
~~~

That request asks the search engine to find both terms in document content. It
does not constrain enumeration to the named grant.

The search contract needs to distinguish:

- What content should match.
- Which configured document grants should be searched.

## Decision

Extend the existing search method with optional directory and exact-file
selector arrays:

~~~ts
search({
  query: string,
  maxResults?: number,
  directories?: string[],
  files?: string[]
})
~~~

The selector values are configured names returned by the list method. They are
not filesystem paths, wildcards, substrings, or free-form search terms.

Do not add a separate search-selected method, and do not register multiple MCP
tools with the same name. MCP exposes a JSON Schema input contract rather than
traditional language-level overloads. One flat object with optional selectors
is simpler for MCP clients and agents to construct reliably.

## Request fields

| Field | Required | Meaning |
| --- | --- | --- |
| query | Yes | Document-content terms to find. Grant names should not be placed here merely to constrain the search. |
| maxResults | No | Positive result limit, capped by the human configuration. |
| directories | No | Configured document-directory names returned by list, including enabled Tool folders with includeDocs. Values are names, not paths. |
| files | No | Configured exact-document-file names returned by list. Values are names, not paths. |

The public MCP schema should remain a strict object. Unknown properties should
be rejected.

## Search modes

### All-enabled mode

When both selector properties are omitted, preserve the current broad-search
behavior:

~~~json
{
  "query": "error"
}
~~~

This searches all enabled grants currently included by the default document
search behavior.

### Selected mode

Supplying either directories or files activates selected mode:

~~~json
{
  "query": "error",
  "directories": [
    "bts-app-logs"
  ],
  "files": [
    "bts-app-mywebviewplugin-log"
  ]
}
~~~

Only the union of those resolved grants may be searched.

Selected-mode rules:

1. An omitted selector category means no grants from that category.
2. An empty selector array is valid when the other category contains at least
   one name.
3. If both selector arrays are present but empty, reject the request.
4. Validate every requested name before filesystem enumeration begins.
5. If any requested name is unknown, disabled, or ambiguous, fail the complete
   request.
6. Do not silently discard an invalid selector and continue with a partial
   search.
7. Do not silently broaden an invalid or empty selected search into an
   all-enabled search.
8. Unselected document directories and exact document files must not be
   scanned.
9. An enabled Tool folder with `includeDocs` is an explicit document-directory
   grant. It is searched only when its name from `list` is selected; it is
   never added implicitly to an unrelated selected search.
10. The query, result limit, ranking, safety rules, and scan limits apply to the
    combined selected set.

## Examples

### Directory only

~~~json
{
  "query": "runtime error",
  "directories": [
    "bts-app-logs"
  ]
}
~~~

This scans bts-app-logs and no exact document-file grants.

### Exact file only

~~~json
{
  "query": "runtime error",
  "files": [
    "bts-app-mywebviewplugin-log"
  ]
}
~~~

This scans only the configured exact file. It remains eligible even when it is
outside all configured directories or does not match a configured document
suffix.

### Directory and exact file

For the two grants explicitly discussed:

~~~json
{
  "query": "error",
  "directories": [
    "bts-app-logs"
  ],
  "files": [
    "bts-app-mywebviewplugin-log"
  ]
}
~~~

### All currently apparent BTS log grants

The current catalog also contains bts-app-automation-logs. If the user's phrase
"all BTS logs" is intended literally, the agent may select:

~~~json
{
  "query": "error",
  "directories": [
    "bts-app-automation-logs",
    "bts-app-logs"
  ],
  "files": [
    "bts-app-mywebviewplugin-log"
  ]
}
~~~

Interpreting which catalog entries satisfy a natural-language phrase belongs
to the agent. The MCP server should execute the explicit set it receives. It
should not infer groups through fuzzy matching or common name prefixes.

## Agent workflow

When a user limits a document search to named folders, files, products,
applications, or log sets, the agent should:

1. Call list with an empty object.
2. Review the enabled directory names and enabled exact-file names.
3. Map the user's requested scope to the exact returned names.
4. Put only document-content terms in query.
5. Pass every required directory name through directories.
6. Pass every required exact-file name through files.
7. Review the successful response's resolved scope before relying on the
   results.
8. Do not broaden the search if the intended scope is unavailable or
   ambiguous.

For example:

~~~json
{
  "query": "runtime error",
  "directories": [
    "bts-app-logs"
  ],
  "files": [
    "bts-app-mywebviewplugin-log"
  ]
}
~~~

## Name resolution

Selector names should resolve against the default configured document source
used by the agent-facing list method.

Recommended behavior:

- Resolve a configured exact name first.
- Permit a unique case-insensitive exact-name match for convenience.
- Return canonical configured spelling in the successful response.
- Do not perform substring, fuzzy, token, wildcard, filename, or path matching.
- Do not accept arbitrary paths.
- Only enabled grants can be selected.
- Deduplicate repeated request names case-insensitively.
- Keep directory and exact-file namespaces separate.

A directory and exact file may therefore share a name because the request
fields disambiguate their types:

~~~json
{
  "directories": [
    "runtime"
  ],
  "files": [
    "runtime"
  ]
}
~~~

## Configuration uniqueness

Once names are request identifiers, each category needs unambiguous keys.

Configuration parsing should enforce:

- Document-directory names are unique case-insensitively within a source.
- Exact document-file names are unique case-insensitively within a source.
- Exact document-file paths are unique according to the platform's path
  comparison rules.
- Duplicate configured exact-file paths produce an explicit configuration
  error instead of silently discarding a later alias.

Suggested configuration error codes:

~~~text
CONFIG_DOCUMENT_DIRECTORY_NAME_DUPLICATE
CONFIG_DOCUMENT_FILE_NAME_DUPLICATE
CONFIG_DOCUMENT_FILE_PATH_DUPLICATE
~~~

The UI should continue generating unique names, but parser-level validation is
required because configuration can also be edited manually.

## Validation and errors

### Empty selected scope

Request:

~~~json
{
  "query": "error",
  "directories": [],
  "files": []
}
~~~

Response:

~~~json
{
  "schemaVersion": "1.0",
  "ok": false,
  "error": {
    "code": "SEARCH_SCOPE_EMPTY",
    "message": "Scoped search requires at least one document directory or exact file."
  }
}
~~~

### Unknown names

Request:

~~~json
{
  "query": "error",
  "directories": [
    "missing-log-directory"
  ],
  "files": [
    "missing-log-file"
  ]
}
~~~

Response:

~~~json
{
  "schemaVersion": "1.0",
  "ok": false,
  "error": {
    "code": "SEARCH_SCOPE_NOT_FOUND",
    "message": "One or more requested document grants are not configured.",
    "details": {
      "unknownDirectories": [
        "missing-log-directory"
      ],
      "unknownFiles": [
        "missing-log-file"
      ],
      "availableDirectories": [
        "bts-app-automation-logs",
        "bts-app-logs",
        "bts-app-source",
        "motion-studio"
      ],
      "availableFiles": [
        "bts-app-mywebviewplugin-log",
        "bts-app-component-omnibox-history"
      ]
    }
  }
}
~~~

### Disabled names

Requesting a configured but disabled grant should not scan any of the other
requested grants:

~~~json
{
  "schemaVersion": "1.0",
  "ok": false,
  "error": {
    "code": "SEARCH_SCOPE_DISABLED",
    "message": "One or more requested document grants are disabled.",
    "details": {
      "disabledDirectories": [
        "some-disabled-directory"
      ],
      "disabledFiles": []
    }
  }
}
~~~

The service should collect all invalid selectors of the same category where
practical so the caller can repair the request in one retry.

## Successful response

A successful response should confirm the canonical grants that were resolved
and searched:

~~~json
{
  "schemaVersion": "1.0",
  "ok": true,
  "query": "error",
  "scope": {
    "mode": "selected",
    "directories": [
      {
        "name": "bts-app-logs",
        "path": "C:\\Users\\i7desktop\\Documents\\BetterTogetherSoftwareData\\BTS\\Logs",
        "priority": 100
      }
    ],
    "files": [
      {
        "name": "bts-app-mywebviewplugin-log",
        "path": "C:\\Users\\i7desktop\\Documents\\BetterTogetherSoftwareData\\BTS\\WebViewPluginData\\logs\\MyWebViewPlugin.log"
      }
    ]
  },
  "queryPlan": {
    "normalizedQuery": "error",
    "terms": [
      "error"
    ]
  },
  "results": [],
  "meta": {
    "backend": "direct-scan",
    "resultUnit": "file",
    "scopeMode": "selected",
    "directoriesSelected": 1,
    "filesSelected": 1,
    "indexed": false,
    "networkUsed": false
  },
  "warnings": []
}
~~~

For a broad request, scope.mode should be all-enabled. The response may include
the actual resolved grants so the caller can audit what was searched.

Returning resolved names and paths is not a new disclosure because list
already returns the same information.

## Result provenance

The current result model identifies directory candidates through sourceRoot,
but exact document files use the generic value specific-files.

For scoped search, each result should identify the configured grant that
produced it. A recommended result addition is:

~~~json
{
  "grant": {
    "type": "directory",
    "name": "bts-app-logs"
  }
}
~~~

or:

~~~json
{
  "grant": {
    "type": "file",
    "name": "bts-app-mywebviewplugin-log"
  }
}
~~~

If the same physical file is reachable through more than one selected grant,
it must still be read once. The implementation may report the first canonical
grant used for enumeration, while the top-level scope records the complete
requested set.

This provenance addition is recommended but is not required to enforce
filesystem scoping correctly.

## Safety invariants

Selected search only narrows the existing human allowlist. It must never expand
access.

All existing protections remain active:

- Configured secret paths remain excluded.
- Protected credential paths remain excluded.
- Symbolic links and junctions remain blocked according to current policy.
- Ignore rules remain active.
- Binary and oversized files remain skipped.
- Directory suffix and exact-filename filters remain active.
- Exact document-file grants remain eligible regardless of suffix.
- The configured maximum file count and timeout apply to the combined scope.
- maxResults applies globally across the combined selected results.
- Query normalization, all-term matching, ranking, line previews, and
  byte-identical result deduplication remain unchanged.

The complete selector set must be validated before any selected directory or
file is read.

## Proposed MCP description

Suggested search method description:

> Search all enabled human-allowlisted local documents, or search only
> configured directory and exact-file grants selected by names returned from
> list. Pass document-content terms in query. When directories or files is
> supplied, only those named grants are scanned; omitted grant categories are
> excluded. Selector values are names, not paths. Unknown, disabled, or empty
> selections are rejected without broadening the search.

Suggested field descriptions:

query:

> Document-content terms to find. Do not include grant names merely to
> constrain the search.

directories:

> Optional configured document-directory names returned by list, including
> enabled Tool folders with includeDocs. Supplying this or files activates
> selected mode. Values are names, not paths.

files:

> Optional configured exact-document-file names returned by list. Supplying
> this or directories activates selected mode. Values are names, not paths.

maxResults:

> Optional result limit, capped by the human configuration.

## Skill update

The installed agent-doc-and-tool skill should be updated after the MCP
contract is implemented and verified.

Suggested skill guidance:

> When the user limits a document search to named folders, files, products,
> applications, or log sets, call list first. Map the user's intended scope to
> the exact enabled directory and exact-file names returned by list, then pass
> those names through search.directories and search.files. Keep only content
> terms in query. Supplying either selector activates scoped mode, so include
> every grant needed for the request. Do not silently broaden the search when
> a requested scope is ambiguous or unavailable.

## Implementation plan (completed)

1. Extend the search MCP input schema with optional directories and files
   string arrays.
2. Keep the public input object strict and document that selector values are
   configured names rather than paths.
3. Enforce document directory-name, exact-file-name, and exact-file-path
   uniqueness during configuration normalization.
4. Add a document-grant resolver that:
   - Uses the same default document source exposed by list.
   - Resolves canonical enabled directory and exact-file entries.
   - Deduplicates requested names.
   - Reports unknown and disabled names.
   - Rejects an empty selected scope.
5. Resolve the complete scope before enumeration begins.
6. Build a temporary search source containing only the selected roots and
   exact files.
7. Preserve exact-file names through candidate generation rather than reducing
   them immediately to anonymous paths.
8. Scan exact files and roots with the existing safety, matching, ranking,
   timeout, and result-limit behavior.
9. Keep physical-path deduplication so overlapping grants do not cause repeated
   reads.
10. Return the canonical resolved scope and selected counts.
11. Add per-result grant provenance if included in the approved response
    contract.
12. Update README method documentation and examples.
13. Update the repository and installed agent-doc-and-tool skill.
14. Restart or reload the MCP attachment and verify the first-class method
    schema from a fresh task.

## Test plan

### Schema and compatibility

- Existing search calls containing only query continue to work.
- Existing search calls containing query and maxResults continue to work.
- The MCP schema exposes directories and files as optional string arrays.
- Unknown input properties remain rejected.
- Invalid element types and over-limit arrays are rejected.

### Selection behavior

- Directory-only selection finds matches in the selected directory.
- Directory-only selection does not scan unselected directories.
- Directory-only selection does not scan exact files.
- Exact-file-only selection finds an exact file outside all roots.
- Exact-file-only selection does not scan directories.
- Combined selection searches the union of selected directories and files.
- Multiple selected directories are all searched.
- Multiple selected exact files are all searched.
- maxResults applies across the combined result set.

### Validation

- Both selectors omitted activates all-enabled mode.
- Both selectors explicitly empty returns SEARCH_SCOPE_EMPTY.
- One empty selector and one non-empty selector is valid.
- Unknown directory names return SEARCH_SCOPE_NOT_FOUND.
- Unknown exact-file names return SEARCH_SCOPE_NOT_FOUND.
- Disabled directory names return SEARCH_SCOPE_DISABLED.
- Disabled exact-file names return SEARCH_SCOPE_DISABLED.
- A mixed valid and invalid request performs no partial scan.
- Case-insensitive exact resolution returns canonical configured spelling.
- Repeated request names are deduplicated.
- Duplicate configured aliases fail configuration validation.
- Duplicate configured exact-file paths fail configuration validation.

### Deduplication and provenance

- A file covered by both a selected root and selected exact-file grant is read
  once.
- Byte-identical files remain collapsed according to existing behavior.
- The response reports selected mode and the canonical resolved grants.
- Results identify their configured grant if per-result provenance is adopted.

### Safety

- Selected secret files remain excluded.
- Selected protected credential paths remain excluded.
- Links and junctions remain blocked.
- Ignore patterns remain active within selected directories.
- Binary and oversized files remain skipped.
- File-count and timeout limits remain active.
- A selector cannot be used as an arbitrary path escape.
- Scoped mode does not add an unselected documentation-enabled tool directory;
  a Tool directory is searched only when its listed name is explicitly selected.

### Agent workflow

- A fresh MCP client can call list and pass returned directory/file names to
  search.
- The skill directs the agent to keep location names out of query.
- The BTS example searches only the requested BTS grants.
- The successful response provides enough scope metadata to verify that the
  request was narrowed.

## Acceptance criteria

The change is complete when all of the following are true:

1. The first-class MCP search schema accepts optional directories and files.
2. An unscoped request preserves current broad-search behavior.
3. A scoped request scans only the explicitly selected enabled grants.
4. Directory and file selectors resolve only configured names returned by
   list.
5. Unknown, disabled, ambiguous, and empty scopes fail atomically.
6. No selector can expand the configured human allowlist.
7. The response confirms the canonical scope that was searched.
8. Existing safety, ranking, deduplication, and result-limit behavior remains
   intact.
9. Automated tests cover broad, directory-only, file-only, combined, invalid,
   overlapping, and safety cases.
10. README and skill guidance describe the list-to-scoped-search workflow.
11. A freshly attached MCP client successfully performs the BTS scoped-search
    example.

## Verification record

The completed implementation was verified with:

- 52 passing automated tests across configuration, search, fetch, tools,
  prompts, secrets, and the local configuration API.
- A fresh MCP smoke client that confirmed the public search schema contains
  query, maxResults, directories, and files.
- Fresh selected-search MCP calls covering a directory and exact file together.
- A live all-enabled MCP search and fetch against the active configuration.
- A live scoped BTS search for error using bts-app-logs and
  bts-app-mywebviewplugin-log.
- An assertion that every live BTS result stayed within the selected directory
  or exact file.
- Active configuration validation.
- JavaScript syntax checks for every source, test, and UI script.
- JSON parsing for every JSON example in README.md, this design document, and
  the skill.
- Byte-for-byte comparison of the repository and installed SKILL.md files.
- Manual equivalents of the official skill frontmatter checks because both
  available Python runtimes lacked the validator's PyYAML dependency.

## Non-goals

This design does not add:

- Arbitrary filesystem paths in search requests.
- Glob or regular-expression scope selectors.
- Fuzzy server-side grant-name matching.
- Automatic grouping by name prefix.
- Semantic interpretation of phrases such as "all BTS logs" inside the MCP
  server.
- Nested-subdirectory selectors below a configured root.
- Scope selection for prompts or secret files.
- A new index, database, or network search backend.

Those capabilities can be designed separately if a concrete need appears.
