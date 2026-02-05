# CLI Tools Example

This example demonstrates how to create custom CLI tools that run as CLI commands inside the bash environment.

## Features

- **Zod Schemas**: Define input with Zod for validation and type safety
- **Auto-generated Help**: Each tool gets `--help` documentation
- **Smart Output Handling**: Small outputs return inline, large outputs save to files with structure hints
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
6. **Output Handling**:
   - **Small outputs** (≤2000 chars): Return inline as JSON
   - **Large outputs** (>2000 chars): Save to `.cli-output/` with structure hint

### Output Examples

**Small output (inline):**
```
$ fetch-user --id usr_1
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Large output (file with structure hint):**
```
$ list-products --category electronics
Output saved to /workspace/.cli-output/list-products-1234567890.json
Structure: {products: array[55], total: number}
```

The structure hint tells the model the JSON shape, enabling efficient `jq` queries without exploring the file:
```bash
$ jq '.products | sort_by(-.rating) | first' /workspace/.cli-output/list-products-*.json
```

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
npx tsx examples/cli-tools/evals/composing.eval.ts   # Multi-step scripting example
npx tsx examples/cli-tools/evals/many-tools.eval.ts  # 15 CRM tools example
npx tsx examples/cli-tools/evals/large-data.eval.ts  # Large dataset example
npx tsx examples/cli-tools/evals/batch.eval.ts       # Batch operations example
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
- **fewerToolCalls**: CLI tools must use fewer or equal tool calls than baseline (can be skipped with `skipFewerToolCalls: true`)
- **fewerTokens**: CLI tools must use fewer or equal tokens than baseline

Additional configurable assertions:
- `requiredResponseTerms`: Terms that must appear in both responses
- `custom`: Custom assertion functions

### Current Results

| Eval | Status | CLI Tools | Baseline | Notes |
|------|--------|-----------|----------|-------|
| **large-data** | ✅ | 1278 tokens | 6036 tokens | **4.7x fewer tokens** - jq extracts only needed data |
| **many-tools** | ✅ | 2051 tokens | 2523 tokens | **19% fewer tokens** - compact CLI listing |
| basic | ❌ | 1289 tokens | 1223 tokens | 5% overhead |
| composing | ❌ | 1283 tokens | 1045 tokens | 23% overhead |
| piping | ❌ | 1640 tokens | 1331 tokens | 23% overhead |
| batch | ❌ | 1983 tokens | 1376 tokens | 44% overhead |

### When CLI Tools Excel

CLI tools are most beneficial when:

1. **Large datasets**: The model can use `jq` to extract only needed fields from large JSON files, avoiding massive token consumption. The structure hint enables correct queries on the first try.

2. **Many tools (15+)**: The compact CLI tool listing is more token-efficient than many separate tool schemas in the system prompt.

### When Baseline is Better

For simple scenarios with 2-3 tools and small data, native AI SDK tools have less overhead since they don't include bash tool instructions.

### Example Output

```
============================================================
Evaluation: Large Data CLI Tools Example
============================================================

Prompt: "Find the highest-rated electronics product that costs less than $350..."

--- Running CLI Tools Version ---
CLI tools: 2 calls, 1278 tokens, 3 steps, 5845ms

--- Running Baseline Version ---
Baseline: 1 calls, 6036 tokens, 2 steps, 5503ms

--- Assertion Results ---
✓ PASS: fewerTokens
       CLI tools: 1278 tokens <= baseline: 6036 tokens

--- Summary ---
CLI Tools: 2 calls, 1278 tokens, 3 steps
Baseline:    1 calls, 6036 tokens, 2 steps

✓ All assertions passed
```
