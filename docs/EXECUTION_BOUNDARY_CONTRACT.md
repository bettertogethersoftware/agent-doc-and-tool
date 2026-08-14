# Discovery and execution boundary

Version: `1.0`

The `agent-doc-and-tool` MCP is a local discovery and planning service. It is
not an execution service. Its public methods may read the configured catalog,
approved documentation, selected prompts, and explicitly granted secret
metadata or values according to their individual contracts, but they must not
run a configured Tool or perform its side effects.

## MCP responsibilities

The MCP may provide:

- enabled prompt, Tool, document, and secret-grant selection;
- direct local documentation search and fetch;
- exact saved Tool paths and deterministic invocation metadata;
- bounded filesystem verification for the explicit `find_tool` fallback;
- reusable prompt text after selection;
- explicitly requested secret metadata or values through the secret workflow;
- an agent-level dry-run plan as structured task context.

Every successful MCP response is marked with `meta.executed: false`. This
means that the MCP did not start a configured Tool process or perform the
selected Tool's operation. It does not mean that a bounded read-only search
helper was not used or that a document or secret file was not read by the
method whose contract permits reading it.

## MCP prohibitions

The MCP must not:

- spawn a configured Tool, invoke a shell, run `--help`, or modify `PATH`;
- create, modify, rename, delete, publish, upload, send, or otherwise mutate
  user artifacts as part of discovery or planning;
- treat a prompt, Catalog Instruction, folder Instruction, Tool note, or
  fetched document as execution authorization;
- treat a configured Tool path or invocation metadata as proof that execution
  is authorized or that the file is currently verified;
- claim a dry-run result was created, rendered, published, uploaded, or
  verified;
- provide credentials to an arbitrary process.

The search implementation may use its bounded direct `ripgrep` file-listing
helper for read-only document enumeration. That helper receives generated
matching arguments, uses pipes rather than a shell, is subject to the search
timeout and output limits, and is not a configured Tool operation. Its use
does not change the execution boundary described here.

The MCP method annotations reinforce this boundary: every registered method is
read-only, non-destructive, idempotent, and closed-world. The server response
layer rejects any successful payload that tries to report `executed: true` and
sets the discovery marker to `false` for successful responses that do not
already provide it.

## Separate execution channel

A separate authorized execution channel is a separate component. Before it runs
anything, it must independently confirm:

1. the current user explicitly requested the operation;
2. prompt confirmation has been completed when required;
3. the selected Tool, interface, working directory, arguments, environment,
   credentials, and side effects are understood;
4. the target paths and outputs are authorized;
5. the operation is not relying solely on a discovery response as permission.

After execution, that separate channel must verify the actual process result
and artifact. A successful discovery response, a dry-run plan, or a configured
invocation prefix is never an execution result.
