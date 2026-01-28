/**
 * Basic Shell Tools Evaluation
 *
 * Tests the basic shell tools example (fetch user, send email).
 * Compares shell tools version against native AI SDK tools baseline.
 *
 * Run with: npx tsx examples/shell-tools/evals/basic.eval.ts
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
  { name: string; email: string; createdAt: string }
> = {
  usr_1: {
    name: "Alice Johnson",
    email: "alice@example.com",
    createdAt: "2024-01-15",
  },
  usr_2: {
    name: "Bob Smith",
    email: "bob@example.com",
    createdAt: "2024-02-20",
  },
  usr_3: {
    name: "Charlie Brown",
    email: "charlie@example.com",
    createdAt: "2024-03-10",
  },
};

// ============ Schema Definitions ============

const fetchUserInputSchema = z.object({
  id: z.string().describe("The user ID (e.g., usr_1)"),
  includeMetadata: z.boolean().optional().describe("Include creation date"),
});

const fetchUserOutputSchema = z.object({
  name: z.string().describe("Full display name"),
  email: z.string().describe("Primary email address"),
  createdAt: z.string().optional().describe("ISO date string"),
});

const listUsersInputSchema = z.object({
  limit: z.number().optional().default(10).describe("Maximum users to return"),
});

const listUsersOutputSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  total: z.number(),
});

const sendEmailInputSchema = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().optional().describe("Email body content"),
});

const sendEmailOutputSchema = z.object({
  sent: z.boolean(),
  messageId: z.string(),
});

// ============ Execute Functions ============

async function executeFetchUser({
  id,
  includeMetadata,
}: z.infer<typeof fetchUserInputSchema>) {
  const user = users[id];
  if (!user) {
    throw new Error(`User not found: ${id}`);
  }
  return {
    name: user.name,
    email: user.email,
    ...(includeMetadata && { createdAt: user.createdAt }),
  };
}

async function executeListUsers({
  limit,
}: z.infer<typeof listUsersInputSchema>) {
  const allUsers = Object.entries(users).map(([id, user]) => ({
    id,
    name: user.name,
  }));
  return {
    users: allUsers.slice(0, limit),
    total: allUsers.length,
  };
}

async function executeSendEmail({
  to,
  subject,
}: z.infer<typeof sendEmailInputSchema>) {
  const messageId = `msg_${Date.now()}`;
  console.log(`  [Email] To: ${to}, Subject: ${subject}`);
  return { sent: true, messageId };
}

// ============ Tool Descriptions ============

const descriptions = {
  fetchUser: "Fetches a user from the mock database",
  listUsers: "Lists all users in the database",
  sendEmail: "Sends an email to a recipient",
};

// ============ Prompt ============

const prompt =
  "Send a welcome email to usr_1 using their actual email from the database.";

// ============ Shell Tools Version ============

async function runShellToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const fetchUser = createShellTool({
    description: descriptions.fetchUser,
    inputSchema: fetchUserInputSchema,
    outputSchema: fetchUserOutputSchema,
    execute: executeFetchUser,
  });

  const listUsers = createShellTool({
    description: descriptions.listUsers,
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: executeListUsers,
  });

  const sendEmail = createShellTool({
    description: descriptions.sendEmail,
    inputSchema: sendEmailInputSchema,
    outputSchema: sendEmailOutputSchema,
    execute: executeSendEmail,
  });

  const { tools } = await createBashTool({
    shellTools: {
      fetchUser,
      listUsers,
      sendEmail,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions:
      "You are a helpful assistant. Use the bash tool to help users with their requests.",
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

  const fetchUser = tool({
    description: descriptions.fetchUser,
    inputSchema: fetchUserInputSchema,
    execute: executeFetchUser,
  });

  const listUsers = tool({
    description: descriptions.listUsers,
    inputSchema: listUsersInputSchema,
    execute: executeListUsers,
  });

  const sendEmail = tool({
    description: descriptions.sendEmail,
    inputSchema: sendEmailInputSchema,
    execute: executeSendEmail,
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      fetchUser,
      listUsers,
      sendEmail,
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
    name: "Basic Shell Tools Example",
    prompt,
    runShellTools: runShellToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      requiredResponseTerms: ["alice", "email", "sent"],
    },
    outputPath: "examples/shell-tools/evals/data/basic-output.json",
  });
}

main().catch(console.error);
