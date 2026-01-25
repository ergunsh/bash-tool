# Shell Tools Example

This example demonstrates how to create custom shell tools that run as CLI commands inside the bash environment.

## Features

- **Zod Schemas**: Define input/output with Zod for validation and type safety
- **Auto-generated Help**: Each tool gets `--help` documentation
- **JSON Output**: Tools output JSON, composable with `jq` and Unix pipelines
- **Context Access**: Tools can access filesystem, environment, and execute subcommands

## Running the Example

```bash
npx tsx examples/shell-tools/index.ts
```

## Shell Tools Defined

### fetch-user

Fetches a user from the mock database.

```bash
fetch-user --id usr_1 [--include-metadata]
```

Output:
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "createdAt": "2024-01-15"
}
```

### list-users

Lists all users in the database.

```bash
list-users [--limit 10]
```

Output:
```json
{
  "users": [
    { "id": "usr_1", "name": "Alice Johnson" },
    { "id": "usr_2", "name": "Bob Smith" }
  ],
  "total": 3
}
```

### send-email

Sends an email to a recipient (mock).

```bash
send-email --to bob@example.com --subject "Hello" [--body "..."]
```

Output:
```json
{
  "sent": true,
  "messageId": "msg_1234567890"
}
```

## Composability with jq

Shell tools output JSON, so you can pipe to `jq`:

```bash
# Get just the email
fetch-user --id usr_1 | jq '.email'

# Get first user's name
list-users | jq '.users[0].name'

# Filter active users
list-users | jq '[.users[] | select(.name | contains("Alice"))]'
```

## Key Code

```typescript
import { z } from "zod";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
} from "bash-tool";

// Define a shell tool
const fetchUser = createShellTool({
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
  shellTools: { fetchUser }, // Available as: fetch-user
});
```

## How It Works

1. **Tool Definition**: Use `experimental_createShellTool` to define tools with Zod schemas
2. **Registration**: Pass tools to `createBashTool` via `shellTools` option
3. **CLI Conversion**: Tool names are converted from camelCase to kebab-case
4. **Execution**: The AI agent can call tools via bash commands
5. **Validation**: Input is validated against the Zod schema
6. **JSON Output**: Results are returned as formatted JSON

## More Examples

### Many Tools

The `many-tools/` subdirectory shows shell tools with many related operations (15 CRM tools). Includes a baseline for testing:

```bash
npx tsx examples/shell-tools/many-tools/index.ts      # Shell tools
npx tsx examples/shell-tools/many-tools/baseline.ts   # Baseline (for testing)
```

### Piping

The `piping/` subdirectory shows shell tools with jq piping for complex queries. Includes a baseline for testing:

```bash
npx tsx examples/shell-tools/piping/index.ts      # Shell tools + jq
npx tsx examples/shell-tools/piping/baseline.ts   # Baseline (for testing)
```

### Composing

The `composing/` subdirectory tests whether bash scripting can save LLM round-trips by executing multiple tool calls in one script.

```bash
npx tsx examples/shell-tools/composing/index.ts      # Shell tools version
npx tsx examples/shell-tools/composing/baseline.ts   # Baseline (for comparison)
npx tsx examples/shell-tools/composing/compare.ts    # Run both and compare
```

**Scenario: User + Team Join**

The prompt asks: "Get the full details for user 'alice', including their team's name and department."

This requires:
1. Get user → extract teamId
2. Get team using that teamId
3. Combine results

**Expected behavior (not yet achieved):**

Shell tools version COULD do this in one bash call:
```bash
user=$(get-user --id alice)
team_id=$(echo "$user" | jq -r '.teamId')
get-team --id "$team_id"
```

But currently the agent makes 2 separate calls, same as baseline.

**Current status:** This example serves as a test case for improving the bash tool prompt. See `CONTEXT.md` for investigation notes and next steps.

