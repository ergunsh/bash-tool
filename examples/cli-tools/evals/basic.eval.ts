/**
 * Basic CLI Tools Evaluation
 *
 * Tests the basic CLI tools example (fetch user, send email).
 * Compares CLI tools version against native AI SDK tools baseline.
 *
 * Run with: npx tsx examples/cli-tools/evals/basic.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
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

const listUsersInputSchema = z.object({
  limit: z.number().optional().default(10).describe("Maximum users to return"),
});

const sendEmailInputSchema = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().optional().describe("Email body content"),
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

// ============ CLI Tools Version ============

async function runCliToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const fetchUser = createCliTool({
    description: descriptions.fetchUser,
    inputSchema: fetchUserInputSchema,
    execute: executeFetchUser,
  });

  const listUsers = createCliTool({
    description: descriptions.listUsers,
    inputSchema: listUsersInputSchema,
    execute: executeListUsers,
  });

  const sendEmail = createCliTool({
    description: descriptions.sendEmail,
    inputSchema: sendEmailInputSchema,
    execute: executeSendEmail,
  });

  const { tools } = await createBashTool({
    cliTools: {
      fetchUser,
      listUsers,
      sendEmail,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
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
    model: "anthropic/claude-sonnet-4.5",
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
    name: "Basic CLI Tools Example",
    prompt,
    runCliTools: runCliToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      requiredResponseTerms: ["alice", "email", "sent"],
    },
    outputPath: "examples/cli-tools/evals/data/basic-output.json",
  });
}

main().catch(console.error);
