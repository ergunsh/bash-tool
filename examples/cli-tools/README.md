# CLI Tools Example

This example demonstrates how to create custom CLI tools that run as CLI commands inside the bash environment.

## Features

- **Zod Schemas**: Define input/output with Zod for validation and type safety
- **Auto-generated Help**: Each tool gets `--help` documentation
- **JSON Output**: Tools output JSON, composable with `jq` and Unix pipelines
- **Context Access**: Tools can access filesystem, environment, and execute subcommands

## Running the Example

```bash
npx tsx examples/cli-tools/index.ts
```

## Key Code

```typescript
import { z } from "zod";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
} from "bash-tool";

// Define a CLI tool
const fetchUser = createCliTool({
  description: "Fetches a user from the database",
  inputSchema: z.object({
    id: z.string().describe("The user ID"),
    includeMetadata: z.boolean().optional(),
  }),
  outputSchema: z.object({
    name: z.string(),
    email: z.string(),
    createdAt: z.string().optional(),
  }),
  execute: async ({ id, includeMetadata }) => {
    // Implementation
    return { name: "Alice", email: "alice@example.com" };
  },
});

// Register with createBashTool
const { tools } = await createBashTool({
  cliTools: { fetchUser }, // Available as: fetch-user
});
```

## How It Works

1. **Tool Definition**: Use `experimental_createCliTool` to define tools with Zod schemas
2. **Registration**: Pass tools to `createBashTool` via `cliTools` option
3. **CLI Conversion**: Tool names are converted from camelCase to kebab-case
4. **Execution**: The AI agent can call tools via bash commands
5. **Validation**: Input is validated against the Zod schema
6. **JSON Output**: Results are returned as formatted JSON

## More Examples

### Many Tools

The `many-tools/` subdirectory shows CLI tools with many related operations (15 CRM tools):

```bash
npx tsx examples/cli-tools/many-tools/index.ts
```

### Piping

The `piping/` subdirectory shows CLI tools with jq piping for complex queries:

```bash
npx tsx examples/cli-tools/piping/index.ts
```

### Composing

The `composing/` subdirectory tests whether bash scripting can save LLM round-trips by executing multiple tool calls in one script:

```bash
npx tsx examples/cli-tools/composing/index.ts
```

## Evaluations

The `evals/` subdirectory contains evaluation scripts that compare CLI tools against native AI SDK tools with automatic assertions.

### Running Evaluations

```bash
# Run individual evaluations
npx tsx examples/cli-tools/evals/basic.eval.ts       # Basic user/email example
npx tsx examples/cli-tools/evals/piping.eval.ts      # jq piping example
npx tsx examples/cli-tools/evals/many-tools.eval.ts  # 15 CRM tools example
npx tsx examples/cli-tools/evals/composing.eval.ts   # Multi-step scripting example
```

### Evaluation Output

Each evaluation:
- Runs both CLI tools and baseline versions
- Tracks metrics: tool calls, tokens, steps, duration
- Runs configurable assertions
- Prints PASS/FAIL results to console
- Saves detailed JSON output to `evals/data/*-output.json` (gitignored)
- Exits with code 1 if assertions fail

### Assertion Configuration

Evaluations automatically assert:
- **fewerToolCalls**: CLI tools must use fewer or equal tool calls than baseline
- **fewerTokens**: CLI tools must use fewer or equal tokens than baseline

Additional configurable assertions:
- `requiredResponseTerms`: Terms that must appear in both responses
- `custom`: Custom assertion functions

### Current Results

| Eval | Status | CLI Tools | Baseline | Delta |
|------|--------|-----------|----------|-------|
| **basic** | ❌ | 2 calls, 1279 tokens | 2 calls, 1205 tokens | +74 tokens |
| **composing** | ❌ | 2 calls, 1335 tokens | 2 calls, 1039 tokens | +296 tokens |
| **piping** | ❌ | 6 calls, 2242 tokens | 4 calls, 1325 tokens | +2 calls, +917 tokens |
| **many-tools** | ✅ | 5 calls, 2072 tokens | 5 calls, 2528 tokens | **-456 tokens** |
| **batch** | ❌ | 7 calls, 2014 tokens | 5 calls, 1380 tokens | +2 calls, +634 tokens |

**Key insight**: CLI tools excel when you have **many tools** (15+). The compact CLI tool descriptions are more token-efficient than many separate tool schemas. For fewer tools, the per-round-trip overhead of CLI tools doesn't pay off.

### Example Output

```
============================================================
Evaluation: Many Tools CLI Tools Example
============================================================

Prompt: "Give me a summary of Acme Corp - their contacts, open deals, and recent activities."

--- Running CLI Tools Version ---
CLI tools: 5 calls, 2072 tokens, 3 steps, 10870ms

--- Running Baseline Version ---
Baseline: 5 calls, 2528 tokens, 3 steps, 10250ms

--- Assertion Results ---
✓ PASS: fewerToolCalls
       CLI tools: 5 calls <= baseline: 5 calls
✓ PASS: fewerTokens
       CLI tools: 2072 tokens <= baseline: 2528 tokens

--- Summary ---
CLI Tools: 5 calls, 2072 tokens, 3 steps
Baseline:    5 calls, 2528 tokens, 3 steps

✓ All assertions passed

Results saved to examples/cli-tools/evals/data/many-tools-output.json
```

