# One-Call Tool Catalog Design

Status: Proposed for review  
Created: 2026-08-13  
Compatibility: None required; replace the current Tool model

## Decision

Make `list_tool({})` the only tool-discovery MCP call. It returns every
currently available executable or script, grouped by a human-named tool
package, together with the named documentation grants for that package.

Remove the current `find_tool` MCP method, CLI command, UI query form, tests,
README workflow, and skill guidance. There is no registered `search_tool`
method today; this design interprets the proposed deprecation as removal of
the existing `find_tool` method.

Tool documentation becomes explicit. Remove `includeDocs` and the implicit
rule that exposes documentation anywhere below a tool directory. A human can
instead add:

- A named manual file, such as `ffmpeg-readme`.
- A named documentation directory, such as `ffmpeg-reference`.

`list_tool` reports those names. The existing document `search` and `fetch`
methods search and retrieve their contents.

## Why the current design fails

The active tool configuration grants this directory:

~~~text
C:\Users\i7desktop\Source\repos\motion-studio\ffmpeg-8.1.2-full_build
~~~

The directory contains:

~~~text
bin\ffmpeg.exe
bin\ffplay.exe
bin\ffprobe.exe
doc\...
README.txt
~~~

Current `list_tool` returns only the configured directory. It does not return
the three executables, so the agent must guess a `find_tool` query.

The existing scanner also incorrectly applies the document
`.agent-searchignore`, which contains `bin/`. That hides the complete FFmpeg
binary directory. A scan-backed catalog must therefore have separate tool
ignore configuration rather than reusing document ignore rules.

## New configuration model

Replace the existing `tools.directories`, `tools.files`, and `includeDocs`
schema with named tool packages:

~~~json
{
  "tools": {
    "extensions": ".exe;.com;.cmd;.bat;.ps1;.py;.js;.mjs;.cjs",
    "ignoreFile": ".agent-tool-searchignore",
    "ignore": [],
    "maxEntries": 500,
    "packages": [
      {
        "name": "ffmpeg-8-1",
        "priority": 100,
        "enabled": true,
        "directories": [
          {
            "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build",
            "recursive": true,
            "enabled": true
          }
        ],
        "files": [],
        "documentation": {
          "files": [
            {
              "name": "ffmpeg-readme",
              "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\README.txt",
              "enabled": true
            }
          ],
          "directories": [
            {
              "name": "ffmpeg-reference",
              "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\doc",
              "extensions": ".html;.txt;.md",
              "fileNames": [],
              "enabled": true
            }
          ]
        }
      }
    ]
  }
}
~~~

Rules:

- Package names are unique case-insensitively.
- Package priority orders the returned catalog; higher values come first.
- A disabled package exposes neither tools nor documentation.
- `directories` discover matching tools; `recursive` controls subfolders.
- Exact `files` have a human name and do not need to match a suffix.
- Manual file and manual directory names are human-defined search selectors.
- Manual directory extensions are configured per directory, allowing large
  HTML collections such as FFmpeg documentation without broadening every
  document root.
- Manual names are unique within the corresponding global document directory
  or file namespace so scoped `search` requests are unambiguous.
- Equal-priority packages retain deterministic name order; concrete tools are
  sorted by portable relative path within each package.
- No legacy schema adapter or migration layer is required. The active config,
  example config, UI, tests, and documentation are rewritten together.

## Separate ignore files

Use independent physical files and settings:

~~~text
config/.agent-searchignore       -> document search and fetch
config/.agent-tool-searchignore  -> executable and script discovery
~~~

The tool ignore file should exclude dependency and cache trees but not common
binary locations:

~~~gitignore
.git/
node_modules/
__pycache__/
.venv/
venv/
~~~

Do not ignore `bin`, `build`, `dist`, or `out` by default. Tool-specific
additional patterns come from `tools.ignore`. Document ignore patterns never
affect executable discovery, and tool ignore patterns never expand document
access.

Hard exclusions remain independent of both files: configured secrets,
protected credential paths, links and junction escapes, non-regular files,
and paths outside the verified grant root never appear.

## `list_tool` contract

Request:

~~~json
{}
~~~

No query and no result-limit argument are needed. The human config defines a
bounded complete catalog through `tools.maxEntries`. A valid saved Tool setup
must fit within that bound.

Proposed response:

~~~json
{
  "schemaVersion": "2.0",
  "ok": true,
  "complete": true,
  "packages": [
    {
      "name": "ffmpeg-8-1",
      "priority": 100,
      "tools": [
        {
          "name": "ffmpeg.exe",
          "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe",
          "relativePath": "bin/ffmpeg.exe",
          "verified": true,
          "type": "executable"
        },
        {
          "name": "ffplay.exe",
          "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\bin\\ffplay.exe",
          "relativePath": "bin/ffplay.exe",
          "verified": true,
          "type": "executable"
        },
        {
          "name": "ffprobe.exe",
          "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\bin\\ffprobe.exe",
          "relativePath": "bin/ffprobe.exe",
          "verified": true,
          "type": "executable"
        }
      ],
      "documentation": {
        "files": [
          {
            "name": "ffmpeg-readme",
            "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\README.txt"
          }
        ],
        "directories": [
          {
            "name": "ffmpeg-reference",
            "path": "C:\\Users\\i7desktop\\Source\\repos\\motion-studio\\ffmpeg-8.1.2-full_build\\doc",
            "extensions": [
              ".html",
              ".txt",
              ".md"
            ],
            "fileNames": []
          }
        ]
      }
    }
  ],
  "meta": {
    "backend": "direct-scan",
    "indexed": false,
    "networkUsed": false,
    "executed": false,
    "packagesReturned": 1,
    "toolsReturned": 3,
    "documentationDirectoriesReturned": 1,
    "documentationFilesReturned": 1,
    "configPath": "C:\\path\\to\\search.config.json"
  },
  "warnings": []
}
~~~

Each concrete tool also carries its parent `workingDirectory` and the existing
type-appropriate `invocation` metadata. Those repetitive fields are omitted
from the compact example above.

`verified: true` means the path was checked as an allowed regular non-link
file. It does not mean the tool was executed, trusted, or tested.

The call scans file metadata only. It does not read or hash large executables,
run help, invoke a tool, modify `PATH`, or access the network.

The catalog must not silently truncate. Saving and **Validate all paths**
should reject a Tool setup that exceeds `maxEntries`. If the filesystem later
changes or enumeration hits a timeout, `list_tool` returns an explicit
`TOOL_CATALOG_INCOMPLETE` error instead of presenting a partial inventory as
complete.

## Documentation search integration

Named package manuals are owned and edited by the Tool tab but participate in
the existing document allowlist:

- `list` includes enabled tool manual files and directories, with their owning
  package identified in metadata.
- `search.directories` accepts a named tool documentation directory.
- `search.files` accepts a named tool manual file.
- `fetch` accepts paths returned by searches inside those grants.
- Disabled packages or disabled manual rows are absent from all three methods.

After one `list_tool` call, the agent can search the reported manuals without
another discovery call:

~~~json
{
  "query": "filter_complex audio mapping",
  "directories": [
    "ffmpeg-reference"
  ],
  "files": [
    "ffmpeg-readme"
  ]
}
~~~

Manual directories are not enumerated by `list_tool`; only their grant names,
paths, and filters are returned. The document `search` method performs the
bounded content scan when needed.

## Tool tab rewrite

Replace the current Tool tab rather than adapting its existing rows:

~~~text
Tool packages
`-- Package: ffmpeg-8-1        Priority: 100        [Enabled]
    |-- Tool folders
    |   `-- Path | Include subfolders
    |-- Exact tool files
    |   `-- Name | File path
    `-- Manuals
        |-- Manual files
        |   `-- Name | File path
        `-- Documentation directories
            `-- Name | Folder path | Suffixes | Exact filenames

Discovery settings
|-- Tool suffix patterns
|-- Tool ignore file
|-- Additional tool ignore patterns
`-- Maximum catalog entries

Available tools preview
`-- Refresh complete list_tool preview
~~~

Behavior:

- Add, remove, enable, and disable complete packages.
- Browse or manually add every tool and manual path.
- Validate tool folders, exact tools, manual files, manual directories, and
  the tool ignore file independently.
- Show the concrete executables/scripts that `list_tool` will return.
- Show incomplete-catalog errors before saving.
- Keep tool-owned manuals out of the editable Documents tab to avoid duplicate
  ownership, while still exposing them through the document MCP methods.
- Remove the current natural-language **Find tool** test form.

## Agent workflow

The new workflow is:

~~~text
list_tool
  -> choose an exact returned tool
  -> search/fetch its named manual grants when needed
  -> inspect documented help or preflight only when execution is authorized
  -> execute with the returned invocation metadata
  -> verify the result
~~~

The agent filters the returned JSON locally by package, filename, relative
path, or type. It does not need a second MCP query merely to resolve a path.
If multiple entries remain plausible, the agent asks the human to choose.

## Implementation plan

1. Replace the Tools schema in `src/config.mjs` with packages, explicit
   manuals, separate tool-ignore settings, and `maxEntries`.
2. Add the tracked `config/.agent-tool-searchignore` and rewrite the example
   and active local configuration; do not add a legacy parser.
3. Refactor `src/tool-service.mjs` into one complete package enumerator used by
   `list_tool`, configuration validation, and the UI preview.
4. Merge enabled package manuals into document catalog, scoped search, and
   fetch authorization without using `includeDocs`.
5. Remove `find_tool` from `src/server.mjs`, `src/cli.mjs`, the UI, tests,
   README, and the installed skill.
6. Rewrite the Tool tab around package cards, explicit manuals, discovery
   settings, validation, and complete catalog preview.
7. Update MCP descriptions and skill guidance for the one-call workflow.
8. Reinstall/reload the MCP and skill, then verify the first-class tool list
   from a fresh task.

## Required tests

- One FFmpeg package returns `ffmpeg.exe`, `ffplay.exe`, and `ffprobe.exe` in
  one `list_tool({})` call.
- A document ignore containing `bin/` does not affect tool enumeration.
- A tool ignore containing `bin/` does affect tool enumeration.
- Recursive false excludes the nested FFmpeg binaries; recursive true includes
  them.
- Exact tools, scripts, duplicate physical paths, disabled rows, unavailable
  paths, links, protected paths, and secrets behave safely.
- Catalog overflow and timeout fail explicitly rather than truncate silently.
- Manual file and manual directory names appear in `list_tool` and `list`.
- Scoped document `search` accepts those names and never scans unrelated docs.
- Manual directories honor their own suffix and exact-filename filters.
- Disabling a package removes both its tools and manuals.
- Tool-tab load, edit, validate, save, reload, and preview behavior round-trips
  the new schema.
- The MCP tool catalog no longer exposes `find_tool`.
- README, repository skill, installed skill, CLI usage, and MCP descriptions
  contain no stale `find_tool` or `includeDocs` workflow.

## Acceptance criteria

The redesign is complete when:

1. A fresh `list_tool({})` call provides the complete executable/script
   inventory and named manual grants.
2. The active FFmpeg package returns all three binaries from `bin`.
3. `find_tool` and implicit `includeDocs` no longer exist.
4. Tool and document ignore files and UI controls are fully independent.
5. Exact manual files and large named manual directories are searchable through
   the existing document `search` and `fetch` methods.
6. The Tool tab owns the package, tool, and manual configuration in one place.
7. Incomplete catalogs fail visibly instead of misleading the agent.
8. All safety, MCP, service, configuration, UI, and skill tests pass.
