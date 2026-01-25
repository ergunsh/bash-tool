/**
 * Baseline: Using regular AI SDK tools (no shell tools)
 *
 * This example uses the same use case as index.ts but with regular AI SDK tools
 * instead of shell tools. Compare the context usage between the two approaches.
 *
 * Run with: npx tsx examples/shell-tools/baseline.ts
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";

// Mock user database (same as shell tools example)
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

// Define regular AI SDK tools

const fetchUserSchema = z.object({
  id: z.string().describe("The user ID (e.g., usr_1)"),
  includeMetadata: z.boolean().optional().describe("Include creation date"),
});

const fetchUser = tool({
  description: "Fetches a user from the mock database",
  inputSchema: fetchUserSchema,
  execute: async ({ id, includeMetadata }: z.infer<typeof fetchUserSchema>) => {
    const user = users[id];
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }
    return {
      name: user.name,
      email: user.email,
      ...(includeMetadata && { createdAt: user.createdAt }),
    };
  },
});

const listUsersSchema = z.object({
  limit: z.number().optional().default(10).describe("Maximum users to return"),
});

const listUsers = tool({
  description: "Lists all users in the database",
  inputSchema: listUsersSchema,
  execute: async ({ limit }: z.infer<typeof listUsersSchema>) => {
    const allUsers = Object.entries(users).map(([id, user]) => ({
      id,
      name: user.name,
    }));
    return {
      users: allUsers.slice(0, limit),
      total: allUsers.length,
    };
  },
});

const sendEmailSchema = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().optional().describe("Email body content"),
});

const sendEmail = tool({
  description: "Sends an email to a recipient",
  inputSchema: sendEmailSchema,
  execute: async ({ to, subject }: z.infer<typeof sendEmailSchema>) => {
    // Mock implementation - just return success
    const messageId = `msg_${Date.now()}`;
    console.log(`[Email] To: ${to}, Subject: ${subject}`);
    return { sent: true, messageId };
  },
});

async function main() {
  console.log("Creating agent with regular AI SDK tools (baseline)...\n");

  // Create the agent with regular tools
  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      fetchUser,
      listUsers,
      sendEmail,
    },
    instructions:
      "You are a helpful assistant. Use the available tools to help users with their requests.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if ("input" in call) {
            console.log(`> ${call.toolName}(${JSON.stringify(call.input)})`);
          }
        }
      }
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          if ("result" in result) {
            console.log(JSON.stringify(result.result, null, 2));
          }
        }
        console.log("");
      }
    },
  });

  // Same prompt as shell tools example
  const prompt =
    "Can you send a welcome email to usr_1? Use their actual email address from the database.";

  console.log("Sending prompt to agent...\n");
  console.log("---");

  const result = await agent.generate({ prompt });

  console.log("---\n");
  console.log("=== Final Response ===\n");
  console.log(result.text);

  console.log("\n=== Agent Stats ===");
  console.log(`Steps: ${result.steps.length}`);
  console.log(`Total tokens: ${result.usage.totalTokens}`);
}

main().catch(console.error);
