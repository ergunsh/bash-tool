# Codemode Examples

This folder shows the codemode workflow with an actual `ToolLoopAgent` on the default `just-bash` path.

## Files

- `index.ts`
  Shows the happy path:
  define a runtime helper once in Node.js, then give an agent a normal docs lookup task so it explores the workspace, discovers the generated SDK, writes a short script, and runs it with `js-exec`.
- `validation.ts`
  Shows the error path:
  give the agent a debugging task so it explores the workspace, reproduces a failure through the generated helper, catches the thrown JavaScript error, and explains it.

## Run the examples

```bash
npx tsx examples/codemode/index.ts
npx tsx examples/codemode/validation.ts
```

## What to look for

1. The host app defines tools with `experimental_defineCodemodeTool(...)`.
2. `createBashTool({ codemode: { runtimeTools: ... } })` generates `./.codemode/`.
3. The agent is given a task, not a codemode tutorial.
4. The agent can inspect the workspace, notice the generated SDK, and use it from a short script.
5. Input and output validation errors come back as normal JavaScript errors inside the generated script.
