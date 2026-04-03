# Codemode Implementation Plan

## Scope

- Ship v1 only on the default internally-created `just-bash` sandbox.
- Reject `codemode` when `createBashTool()` receives a caller-supplied `sandbox`.
- Keep codemode sandbox-only.
- Keep `./.codemode/index.ts` as the only canonical import path.
- Use `zod` for runtime validation.
- Use `zod-to-json-schema` plus `json-schema-to-typescript` to generate readable SDK types.
- Use JSON over `stdin` and `stdout` for the runtime bridge.

## Public API

Add a `codemode` option to `createBashTool()`:

```ts
interface CreateBashToolOptions {
  codemode?: {
    runtimeTools: Record<string, CodemodeTool<any, any>>;
  };
}
```

Add `experimental_defineCodemodeTool()` as the first-class authoring helper:

```ts
const searchDocs = experimental_defineCodemodeTool({
  description: "Search the product docs.",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  outputSchema: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    }),
  ),
  execute: async ({ query, limit }) => {
    return searchDocsApi(query, limit);
  },
});
```

## Runtime Bridge

- Create the default `just-bash` sandbox with `javascript: true` when codemode is enabled.
- Register one private custom command in `just-bash`.
- The generated SDK calls that command from `js-exec`.
- Tool name is passed as argv.
- JSON input is passed through `stdin`.
- JSON output is returned through `stdout`.

## Generated Files

Write these files to `${destination}/.codemode/` on every codemode-enabled setup:

- `index.ts`
- `README.md`
- `manifest.json`

`index.ts` should stay intentionally readable:

- shared `callTool()` helper
- one exported function per runtime tool
- generated input and output types

## Validation Rules

- Reject empty `runtimeTools`.
- Reject duplicate names.
- Reject names that are not valid JavaScript identifiers.
- Reject reserved names like `default` and `codemode`.
- Validate input before `execute`.
- Validate output before returning to sandbox code.

## Agent Instructions

Append a `CODEMODE:` block to the bash tool description when codemode is enabled:

```text
CODEMODE:
You can write TypeScript or JavaScript and run it with js-exec.
Typed runtime helpers live at ./.codemode/index.ts.
Import from that path inside the sandbox.
Available helpers:
  - searchDocs(input) -> Promise<SearchDocsOutput>
Read ./.codemode/README.md for examples.
```

## Capability Probe

Before returning the toolkit, verify that codemode works on the created sandbox:

- `js-exec` is available
- `./.codemode/index.ts` can be imported from the working directory

If the probe fails, throw a clear codemode-specific error.

## Tests

Add coverage for:

- public API typing
- name validation
- generated SDK files
- prompt injection
- codemode runtime success path
- codemode runtime validation failures
- early failure for unsupported sandboxes

## Docs

Update `README.md` with:

- host-side tool definition
- `createBashTool({ codemode: ... })`
- sandbox-side `import { tool } from "./.codemode/index.ts"`
- the v1 limitation to the default `just-bash` path
