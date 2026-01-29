# CLI Tools for bash-tool

> Extending bash-tool with custom MCP-like tools that run as shell commands inside the bash environment.

## Overview

This design describes an extension to `bash-tool` that allows developers to define custom tools using an AI SDK-compatible interface. These tools are exposed as shell commands inside the bash environment, enabling agents to compose them using standard bash pipelines and Unix utilities like `jq`, `grep`, and `awk`.

**Key idea:** A single agent-facing bash tool where custom tools are available as CLI commands that can be piped and composed together.

## Goals

- **AI SDK Compatibility**: Tool definitions should be maximally compatible with the AI SDK's `tool()` interface
- **Output Schema**: Extend the interface with `outputSchema` to describe tool outputs
- **Composability**: Tools output structured JSON that can be piped through `jq` and other Unix tools
- **Discoverability**: Auto-generate help pages and inline signatures for agent comprehension
- **Full Context Access**: Tools have access to the full just-bash context (fs, env, cwd, stdin)

## Tool Definition Interface

### Schema

```typescript
import { z } from 'zod';

interface CliToolDefinition<TInput, TOutput> {
  /**
   * Human-readable description of what the tool does.
   * Used by the LLM to decide when to use the tool.
   * (AI SDK compatible)
   */
  description: string;

  /**
   * Zod schema or JSON Schema defining the input parameters.
   * Consumed by the LLM and used to validate tool calls.
   * Use .describe() on fields to provide LLM guidance.
   * (AI SDK compatible)
   */
  inputSchema: z.ZodType<TInput> | JSONSchema;

  /**
   * Zod schema or JSON Schema defining the output structure.
   * Used to generate help documentation and type the output.
   * Use .describe() on fields to document the output.
   * (Extension to AI SDK)
   */
  outputSchema: z.ZodType<TOutput> | JSONSchema;

  /**
   * Async function called with validated input and shell context.
   * Returns the output object which is serialized as JSON.
   * (AI SDK compatible, extended context)
   */
  execute: (
    input: TInput,
    context: CliToolContext
  ) => Promise<TOutput> | TOutput;
}

interface CliToolContext {
  /** Content piped to this command via stdin */
  stdin: string;
  
  /** Current working directory */
  cwd: string;
  
  /** Environment variables */
  env: Record<string, string>;
  
  /** Virtual filesystem access */
  fs: FileSystem;
  
  /** Execute a subcommand */
  exec: (command: string) => Promise<ExecResult>;
}
```

### Helper Function

```typescript
import { cliTool } from 'bash-tool';
import { z } from 'zod';

export const fetchUser = cliTool({
  description: 'Fetches a user from the database by their unique identifier',
  
  inputSchema: z.object({
    id: z.string().describe('The user UUID'),
    includeMetadata: z.boolean().optional().describe('Include audit timestamps'),
  }),
  
  outputSchema: z.object({
    name: z.string().describe('Full display name'),
    email: z.string().describe('Primary email address'),
    createdAt: z.string().optional().describe('ISO timestamp, present if includeMetadata=true'),
  }),
  
  execute: async ({ id, includeMetadata }, ctx) => {
    // Implementation using ctx.fs, ctx.exec, etc.
    const user = await fetchFromDatabase(id);
    return {
      name: user.name,
      email: user.email,
      ...(includeMetadata && { createdAt: user.createdAt }),
    };
  },
});
```

## CLI Argument Mapping

Tool names are converted from `camelCase` to `kebab-case` for CLI usage.

### Type Mapping

| JSON Schema Type | CLI Syntax | Example |
|------------------|------------|---------|
| `string` | `--flag <string>` | `--id "usr_123"` |
| `number` | `--flag <number>` | `--limit 10` |
| `boolean` | `--flag` / `--no-flag` | `--verbose` |
| `enum` | `--flag <value>` | `--status active` |
| `array<primitive>` | `--flag <val> --flag <val>` | `--tag foo --tag bar` |
| `object` | `--flag <json>` | `--config '{"key":"value"}'` |
| `array<object>` | `--flag <json>` | `--items '[{"a":1}]'` |

### Conventions

- **Required arguments**: No brackets in USAGE line
- **Optional arguments**: Wrapped in `[...]` in USAGE line
- **Value placeholders**: Use `<type>` to indicate expected type
- **Boolean flags**: Presence means `true`, `--no-` prefix means `false`
- **Help flag**: All tools support `--help`

## Help Page Generation

### Format

```
<tool-name> - <description>

USAGE:
  <tool-name> <required-args> [optional-args]

ARGUMENTS:
  --arg <type>            Description (required)
  [--optional <type>]     Description (optional)
  [--flag]                Boolean description (optional)

OUTPUT (JSON):
  {
    "field": type,         // Field description
    "optional"?: type      // Optional field description
  }
```

### Example

For the `fetchUser` tool defined above:

```
fetch-user - Fetches a user from the database by their unique identifier

USAGE:
  fetch-user --id <string> [--includeMetadata]

ARGUMENTS:
  --id <string>           The user UUID (required)
  --includeMetadata       Include audit timestamps (optional)

OUTPUT (JSON):
  {
    "name": string,        // Full display name
    "email": string,       // Primary email address
    "createdAt"?: string   // ISO timestamp, present if includeMetadata=true
  }
```

## Bash Tool Description Generation

When CLI tools are registered with `createBashTool`, the bash tool's system prompt includes inline signatures for all available tools.

### Format

```
You have access to a bash environment with the following custom tools:

<tool-name> <required-args> [optional-args]
  <description>
  Output: JSON { field1, field2, optionalField? }

<tool-name-2> ...
  ...

Run any tool with --help for detailed argument and output documentation.

Tools output pretty-printed JSON. Use jq for filtering and transformation:
  fetch-user --id abc123 | jq '.email'
```

### Example

```
You have access to a bash environment with the following custom tools:

fetch-user --id <string> [--includeMetadata]
  Fetches a user from the database by their unique identifier.
  Output: JSON { name, email, createdAt? }

send-email --to <string> --subject <string> --body <string>
  Sends an email to the specified recipient.
  Output: JSON { messageId, status }

query-db --query <string> [--params <json>]
  Executes a SQL query against the database.
  Output: JSON { rows, rowCount }

Run any tool with --help for detailed argument and output documentation.

Tools output pretty-printed JSON. Use jq for filtering and transformation:
  fetch-user --id abc123 | jq '.email'
```

## Output Format

- **Pretty-printed JSON by default**: Human-readable, 2-space indentation
- **Newline terminated**: Enables clean piping
- **Composable with jq**: Use `jq -c` for compact output when needed

### Example Output

```json
{
  "name": "Alice Chen",
  "email": "alice@example.com",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Error Handling

Errors are returned via stderr with a non-zero exit code, followed by the full help text.

### Format

```
Error: <error message>

<full help output>
```

### Example

```
$ fetch-user --id

Error: --id requires a value of type <string>

fetch-user - Fetches a user from the database by their unique identifier

USAGE:
  fetch-user --id <string> [--includeMetadata]

ARGUMENTS:
  --id <string>           The user UUID (required)
  --includeMetadata       Include audit timestamps (optional)

OUTPUT (JSON):
  {
    "name": string,        // Full display name
    "email": string,       // Primary email address
    "createdAt"?: string   // ISO timestamp, present if includeMetadata=true
  }
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Validation error (invalid arguments) |
| `1` | Execution error (tool threw an exception) |

## Usage with bash-tool

### Registration

```typescript
import { createBashTool } from 'bash-tool';
import { fetchUser, sendEmail, queryDb } from './tools';

const { tools } = await createBashTool({
  cliTools: [fetchUser, sendEmail, queryDb],
  files: {
    'data/config.json': '{"database": "prod"}',
  },
});

const agent = new ToolLoopAgent({
  model: yourModel,
  tools,
  stopWhen: stepCountIs(20),
});
```

### Agent Workflows

**Simple call:**
```bash
fetch-user --id "usr_abc123"
```

**Piping with jq:**
```bash
fetch-user --id "usr_abc123" | jq -r '.email'
```

**Chaining tools:**
```bash
fetch-user --id "usr_abc123" | jq -r '.email' | xargs -I {} send-email --to {} --subject "Hello" --body "Welcome!"
```

**Filtering query results:**
```bash
query-db --query "SELECT * FROM users WHERE active = true" | jq '.rows[] | select(.role == "admin")'
```

**Complex input via JSON:**
```bash
query-db --query "SELECT * FROM users WHERE id = ANY($1)" --params '["usr_1", "usr_2", "usr_3"]'
```

**Combining with filesystem:**
```bash
cat data/user-ids.txt | while read id; do
  fetch-user --id "$id" | jq '.email'
done > emails.txt
```

## Implementation Notes

### Tool Registration Flow

```
cliTool() definition
        ↓
createBashTool({ cliTools: [...] })
        ↓
    ┌───┴───┐
    ↓       ↓
Generate    Register as
bash tool   just-bash
description custom commands
```

### Command Execution Flow

```
Agent writes: fetch-user --id "123"
        ↓
just-bash parses command
        ↓
Custom command handler invoked
        ↓
    ┌───┴───┐
    ↓       ↓
--help?    Parse CLI args
    ↓           ↓
Return     Validate against
help text  inputSchema
                ↓
           Execute handler
                ↓
           JSON.stringify(result, null, 2)
                ↓
           Return { stdout, stderr, exitCode }
```

### Key Implementation Functions

```typescript
// Convert tool definition to just-bash custom command
function toCommand(definition: CliToolDefinition): CustomCommand {
  return defineCommand(toKebabCase(definition.name), async (args, ctx) => {
    if (args.includes('--help')) {
      return { stdout: generateHelp(definition), stderr: '', exitCode: 0 };
    }
    
    const input = parseCliArgs(args, definition.inputSchema);
    const parsed = definition.inputSchema.safeParse(input);
    
    if (!parsed.success) {
      const error = formatValidationError(parsed.error);
      const help = generateHelp(definition);
      return { stdout: '', stderr: `${error}\n\n${help}`, exitCode: 1 };
    }
    
    try {
      const result = await definition.execute(parsed.data, ctx);
      return { stdout: JSON.stringify(result, null, 2) + '\n', stderr: '', exitCode: 0 };
    } catch (err) {
      const help = generateHelp(definition);
      return { stdout: '', stderr: `Error: ${err.message}\n\n${help}`, exitCode: 1 };
    }
  });
}

// Generate inline signature for bash tool description
function toInlineSignature(definition: CliToolDefinition): string {
  const name = toKebabCase(definition.name);
  const args = generateArgSignature(definition.inputSchema);
  const output = generateOutputSummary(definition.outputSchema);
  return `${name} ${args}\n  ${definition.description}\n  Output: JSON ${output}`;
}

// Generate full help text
function generateHelp(definition: CliToolDefinition): string {
  // ... generates the full help format shown above
}
```

## Future Considerations

### Out of Scope

- Stdin as primary input (tools use CLI flags)
- Non-JSON output formats (tools always output JSON)
- Interactive prompts (tools are non-interactive)