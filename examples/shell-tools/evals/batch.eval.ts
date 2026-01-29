/**
 * Batch Operations Shell Tools Evaluation
 *
 * Tests shell tools with batch/loop operations where shell tools can
 * execute a for-each loop in one bash call vs baseline needing multiple
 * sequential API calls.
 *
 * Scenario: Get details for multiple users and calculate total account balance.
 *
 * Run with: npx tsx examples/shell-tools/evals/batch.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
} from "../../../src/index.js";
import {
  createStepHandler,
  type RunResult,
  runComparison,
  type ToolCall,
} from "./utils.js";

// ============ Mock Database ============

const users: Record<
  string,
  {
    name: string;
    email: string;
    balance: number;
    status: "active" | "inactive";
  }
> = {
  usr_1: {
    name: "Alice Johnson",
    email: "alice@example.com",
    balance: 1250.5,
    status: "active",
  },
  usr_2: {
    name: "Bob Smith",
    email: "bob@example.com",
    balance: 890.25,
    status: "active",
  },
  usr_3: {
    name: "Charlie Brown",
    email: "charlie@example.com",
    balance: 2100.0,
    status: "inactive",
  },
  usr_4: {
    name: "Diana Ross",
    email: "diana@example.com",
    balance: 450.75,
    status: "active",
  },
  usr_5: {
    name: "Eve Wilson",
    email: "eve@example.com",
    balance: 3200.0,
    status: "active",
  },
};

// ============ Schema Definitions ============

const userIdEnum = z.enum(["usr_1", "usr_2", "usr_3", "usr_4", "usr_5"]);
const statusEnum = z.enum(["active", "inactive"]);

const listUserIdsInputSchema = z.object({
  status: statusEnum.optional().describe("Filter by user status"),
});

const listUserIdsOutputSchema = z.object({
  userIds: z.array(userIdEnum),
  total: z.number(),
});

const getUserInputSchema = z.object({
  id: userIdEnum.describe("The user ID"),
});

const getUserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  balance: z.number(),
  status: statusEnum,
});

// ============ Execute Functions ============

async function executeListUserIds({
  status,
}: z.infer<typeof listUserIdsInputSchema>) {
  const filteredIds = Object.entries(users)
    .filter(([_, user]) => !status || user.status === status)
    .map(([id]) => id);
  return {
    userIds: filteredIds,
    total: filteredIds.length,
  };
}

async function executeGetUser({
  id,
}: z.infer<typeof getUserInputSchema>): Promise<
  z.infer<typeof getUserOutputSchema>
> {
  const user = users[id];
  if (!user) {
    throw new Error(`User not found: ${id}`);
  }
  return {
    id,
    name: user.name,
    email: user.email,
    balance: user.balance,
    status: user.status as "active" | "inactive",
  };
}

// ============ Tool Descriptions ============

const descriptions = {
  listUserIds: "List all user IDs, optionally filtered by status",
  getUser: "Get detailed information for a specific user by ID",
};

// ============ Prompt ============

const prompt =
  "Get the total account balance for all active users. List each user's name and balance, then provide the total.";

// ============ Shell Tools Version ============

async function runShellToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const listUserIds = createShellTool({
    description: descriptions.listUserIds,
    inputSchema: listUserIdsInputSchema,
    outputSchema: listUserIdsOutputSchema,
    execute: executeListUserIds,
  });

  const getUser = createShellTool({
    description: descriptions.getUser,
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: executeGetUser,
  });

  const { tools } = await createBashTool({
    shellTools: {
      listUserIds,
      getUser,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful assistant. Use the bash tool to help users with their requests. Prefer combining operations in a single bash call when possible.",
    onStepFinish: createStepHandler(calls),
  });

  const start = Date.now();
  const result = await agent.generate({ prompt });
  const duration = Date.now() - start;

  return {
    calls,
    response: result.text,
    tokens: result.usage.totalTokens ?? 0,
    steps: result.steps?.length ?? 0,
    duration,
  };
}

// ============ Baseline Version ============

async function runBaselineVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const listUserIds = tool({
    description: descriptions.listUserIds,
    inputSchema: listUserIdsInputSchema,
    execute: executeListUserIds,
  });

  const getUser = tool({
    description: descriptions.getUser,
    inputSchema: getUserInputSchema,
    execute: executeGetUser,
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      listUserIds,
      getUser,
    },
    instructions:
      "You are a helpful assistant. Use the available tools to help users with their requests.",
    onStepFinish: createStepHandler(calls),
  });

  const start = Date.now();
  const result = await agent.generate({ prompt });
  const duration = Date.now() - start;

  return {
    calls,
    response: result.text,
    tokens: result.usage.totalTokens ?? 0,
    steps: result.steps?.length ?? 0,
    duration,
  };
}

// ============ Main ============

async function main() {
  await runComparison({
    name: "Batch Operations Shell Tools Example",
    prompt,
    runShellTools: runShellToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      // The prompt asks about active users and total balance
      requiredResponseTerms: [
        "alice",
        "bob",
        "diana",
        "eve",
        "total",
        "balance",
      ],
    },
    outputPath: "examples/shell-tools/evals/data/batch-output.json",
  });
}

main().catch(console.error);
