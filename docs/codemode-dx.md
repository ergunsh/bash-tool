# Codemode DX Proposal

## Goal

Make `bash-tool` feel like it can host a small typed SDK inside the sandbox.

The user declares a set of structured runtime tools once in Node.js. `bash-tool` then:

- generates a tiny TypeScript SDK for those tools
- writes that SDK into the sandbox filesystem
- makes the tools callable from `js-exec`
- tells the agent exactly where that SDK lives and how to use it

The important part is the feeling:

- host app authors should have one obvious place to declare runtime tools
- agents should have one obvious import path to use them
- the generated files should be readable enough that the model can learn by inspecting them

## Product Decisions

This proposal assumes these product decisions:

- upgrade the default `just-bash` story first so codemode works on the default path
- keep codemode sandbox-only
- derive the SDK location from the existing top-level `destination`
- make file imports the real v1 contract

What that means in practice:

- codemode tools do not appear in the returned top-level AI SDK `tools`
- the canonical import path inside the sandbox is always `./.codemode/index.ts`
- v1 should not rely on a default global like `globalThis.codemode`

If we add a global convenience alias later, it should be opt-in and clearly secondary.

## What Good DX Looks Like

### For the host app

This should feel like one opt-in block on `createBashTool`:

```ts
import { createBashTool, experimental_defineCodemodeTool } from "bash-tool";
import { z } from "zod";

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

const toolkit = await createBashTool({
  files: projectFiles,
  codemode: {
    runtimeTools: {
      searchDocs,
    },
  },
});

const { tools } = toolkit;
```

There should not be a second assembly step just to make the runtime usable.

### For the agent

This should feel like a generated SDK it can import from the workspace:

```ts
import { searchDocs } from "./.codemode/index.ts";

const hits = await searchDocs({
  query: "caching",
  limit: 3,
});

for (const hit of hits) {
  console.log(hit.title);
}
```

The agent should not need to know about bridge commands, temp files, or transport details.

## Proposed Public API

### 1. Add a `codemode` option to `createBashTool`

```ts
interface CreateBashToolOptions {
  destination?: string;
  codemode?: {
    runtimeTools: Record<string, CodemodeTool<any, any>>;
  };
}
```

Why this shape:

- `createBashTool` stays the one obvious entry point
- `runtimeTools` is clearer than another overloaded `tools` field
- `destination` stays the only path knob
- the happy path stays small

### 2. Add `experimental_defineCodemodeTool`

```ts
const tool = experimental_defineCodemodeTool({
  description: "Look up a user by id.",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
  }),
  execute: async ({ id }) => getUser(id),
});
```

This should be the first-class authoring API for codemode tools.

Why not only accept AI SDK tools directly:

- codemode needs an explicit `outputSchema`
- the execution context is sandbox runtime code, not a top-level model tool call
- a small dedicated helper makes the contract easy to explain

Later, `bash-tool` can add a compatibility helper for AI SDK tools if that turns out to be useful.

## Sandbox-Only Surface

Codemode should be explicit about where it exists:

- codemode tools are callable only from JavaScript or TypeScript running inside the sandbox
- codemode tools do not appear in the returned AI SDK `tools`
- the top-level tool surface stays `bash`, `readFile`, and `writeFile`

That keeps the product mental model clean:

- top-level tools are for the model
- codemode tools are for code running inside the sandbox

If a host app wants to expose the same backend capability as both a top-level AI SDK tool and a codemode tool, that should be an explicit choice by the host app, not something `bash-tool` does automatically.

## Canonical SDK Location

The SDK location should follow one simple rule:

- `destination` remains the only location control
- codemode always writes to `${destination}/.codemode/`
- the canonical import path from inside the sandbox is always `./.codemode/index.ts`

V1 should not add `codemode.destination`.

This matters because `destination` already means:

- where files are written
- what the working directory is for commands

Codemode should align with that instead of creating a second path system.

Even if the implementation uses overlay mounts or different physical paths under the hood, the sandbox contract should stay the same:

- write runtime files under `${destination}/.codemode/`
- import them from `./.codemode/index.ts`

## Generated Sandbox Files

By default, `bash-tool` should write these files under `${destination}/.codemode/`:

- `index.ts`
  A readable runtime SDK with one exported function per tool.
- `manifest.json`
  Machine-readable metadata for debugging, drift inspection, and versioning.
- `README.md`
  Short usage notes for the agent.

The generated files should optimize for model readability, not just correctness.

Example `index.ts` shape:

```ts
export interface SearchDocsInput {
  query: string;
  limit?: number;
}

export interface SearchDocsOutputItem {
  title: string;
  url: string;
  snippet: string;
}

export type SearchDocsOutput = SearchDocsOutputItem[];

export async function searchDocs(
  input: SearchDocsInput,
): Promise<SearchDocsOutput> {
  return callTool("searchDocs", input);
}
```

That file should be simple enough that an agent can skim it and immediately start using it.

## Runtime Experience Inside `js-exec`

Codemode should only turn on when the sandbox can actually host JavaScript execution.

The product direction for v1 is:

- make the default `just-bash` path support codemode first
- only advertise codemode once that path can run `js-exec`
- keep the agent-facing contract stable across supported sandboxes

When codemode is enabled:

- `js-exec` should be available
- the generated SDK should be importable from `./.codemode/index.ts`
- docs and prompts should always lead with the file import path

V1 should not make a global bootstrap the primary story.

If we add a global alias later, it should be:

- opt-in
- clearly documented as convenience only
- never the only way to call runtime tools

## Naming Rules

Tool naming should be strict and boring in the best way.

V1 should require each runtime tool name to be:

- unique
- a valid JavaScript identifier
- safe to export from the generated module

That means names like these should fail early:

- `search-docs`
- `default`
- `codemode`

Why this matters:

- named exports stay predictable
- generated code stays readable
- agents do not need special casing for odd names

If a name is invalid, `createBashTool()` should throw before writing generated files.

## Tool Contract

Codemode should be strict about the runtime contract:

- input is validated before execution
- output is validated before it is returned to sandbox code
- the runtime surface is JSON-in and JSON-out
- generated functions always return `Promise<Output>`

Why this matters:

- the generated TypeScript stays honest
- runtime failures are easier to explain
- agents can trust the SDK more than a loose shell bridge

If a tool needs to move large or binary data, the preferred pattern should be:

- return a file path
- or write to the filesystem and return metadata

That keeps v1 simple and readable.

## Error DX

Errors should be explicit and tool-shaped.

Good examples:

- `codemode.searchDocs input validation failed: limit must be <= 20`
- `codemode.searchDocs output validation failed: result[0].url is required`
- `codemode.searchDocs failed: upstream API returned 500`
- `codemode tool name "search-docs" is invalid: use a valid JavaScript identifier`
- `codemode requires a sandbox that can run js-exec and import ./.codemode/index.ts`

Inside `js-exec`, tool failures should throw normal JavaScript errors so user code can handle them with `try` / `catch`.

## Agent Instructions

When codemode is enabled, `bash-tool` should append a short block to the `bash` tool description.

Something like:

```text
CODEMODE:
You can write TypeScript or JavaScript and run it with js-exec.
Typed runtime helpers live at ./.codemode/index.ts.
Import from that path inside the sandbox.
Available helpers:
  - searchDocs(input) -> Promise<SearchDocsOutput>
Read ./.codemode/README.md for examples.
```

This is important. Without it, the runtime exists but the agent does not know the happy path.

## Why This DX Fits `bash-tool`

This design keeps the top-level tool surface small.

Instead of giving the model ten more direct tools, we give it:

- `bash`
- `readFile`
- `writeFile`
- a typed runtime SDK inside `js-exec`

That creates a much better workflow for code-heavy tasks:

- the model can fetch structured data
- transform it in normal TypeScript
- compose multiple runtime calls
- save scripts for repeatability

It also matches how engineers already think: write a script, import a helper, run it.

## Compatibility And Persistence Story

### Default path

V1 should optimize for the upgraded default `just-bash` experience first.

That means codemode should only be documented as supported once the default path can:

- run `js-exec`
- import local files from `./.codemode/index.ts`
- keep the SDK readable and stable from the agent point of view

### Caller-supplied sandboxes

Caller-supplied sandboxes should only be supported when they can honor the same contract.

That means they must be able to:

- run `js-exec`
- write files under `${destination}/.codemode/`
- resolve `./.codemode/index.ts` from the working directory

If a sandbox cannot do that, `bash-tool` should fail early with a clear error.

### Persistent sandboxes

Persistent sandboxes need a clear refresh rule.

V1 should keep it simple:

- every `createBashTool()` call with codemode enabled rewrites `.codemode/index.ts`
- every `createBashTool()` call with codemode enabled rewrites `.codemode/README.md`
- every `createBashTool()` call with codemode enabled rewrites `.codemode/manifest.json`

`manifest.json` should include enough information to debug drift, such as:

- codemode format version
- tool names
- generation time or generation hash

V1 should prefer predictable overwrite behavior over clever reuse.

## Recommended V1 Scope

Keep the first version small:

- flat `runtimeTools` registry
- `zod` input and output schemas
- generated `./.codemode/index.ts`, `README.md`, and `manifest.json`
- sandbox-only surface
- canonical file import path
- strict runtime tool name validation
- rewrite generated files on every setup
- JSON-in and JSON-out only

Avoid in v1:

- nested namespaces
- default global bootstrap
- streaming results
- binary payload transport
- automatic AI SDK tool adaptation
- custom module resolution magic

## First Follow-Up Questions For Implementation

Once we move from DX to implementation, these are the important remaining decisions:

1. Should the runtime bridge use stdout JSON only, or stdout JSON plus temp-file fallback for larger payloads?
2. What is the minimum `just-bash` work needed to make `js-exec` and `./.codemode/index.ts` imports reliable on the default path?
3. What should `manifest.json` contain to make stale-runtime debugging easy without making the format noisy?
