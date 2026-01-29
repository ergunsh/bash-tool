/**
 * Example: Using CLI Tools with AI SDK
 *
 * CLI tools are custom commands that run inside the bash environment.
 * They use Zod schemas for validation and output JSON for composability
 * with Unix tools like jq.
 *
 * Run with: npx tsx examples/cli-tools/index.ts
 */

import { ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
} from "../../src/index.js";

// Mock user database
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

// Define CLI tools with Zod schemas

/**
 * fetch-user: Fetches a user from the mock database
 *
 * CLI Usage:
 *   fetch-user --id usr_1 [--include-metadata]
 *
 * Output:
 *   { "name": "...", "email": "...", "createdAt"?: "..." }
 */
const fetchUser = createCliTool({
  description: "Fetches a user from the mock database",
  inputSchema: z.object({
    id: z.string().describe("The user ID (e.g., usr_1)"),
    includeMetadata: z.boolean().optional().describe("Include creation date"),
  }),
  outputSchema: z.object({
    name: z.string().describe("Full display name"),
    email: z.string().describe("Primary email address"),
    createdAt: z.string().optional().describe("ISO date string"),
  }),
  execute: async ({ id, includeMetadata }) => {
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

/**
 * list-users: Lists all users in the database
 *
 * CLI Usage:
 *   list-users [--limit 10]
 *
 * Output:
 *   { "users": [{ "id": "...", "name": "..." }, ...], "total": 3 }
 */
const listUsers = createCliTool({
  description: "Lists all users in the database",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum users to return"),
  }),
  outputSchema: z.object({
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
    total: z.number(),
  }),
  execute: async ({ limit }) => {
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

/**
 * send-email: Sends an email (mock implementation)
 *
 * CLI Usage:
 *   send-email --to bob@example.com --subject "Hello" [--body "..."]
 *
 * Output:
 *   { "sent": true, "messageId": "..." }
 */
const sendEmail = createCliTool({
  description: "Sends an email to a recipient",
  inputSchema: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().optional().describe("Email body content"),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.string(),
  }),
  execute: async ({ to, subject }) => {
    // Mock implementation - just return success
    const messageId = `msg_${Date.now()}`;
    console.log(`[Email] To: ${to}, Subject: ${subject}`);
    return { sent: true, messageId };
  },
});

async function main() {
  console.log("Creating bash tool with CLI tools...\n");

  // Create bash tool with CLI tools - they become available as CLI commands
  const { tools } = await createBashTool({
    cliTools: {
      fetchUser, // Available as: fetch-user
      listUsers, // Available as: list-users
      sendEmail, // Available as: send-email
    },
  });

  console.log(
    "CLI tools registered. Agent will discover them via bash tool description.\n",
  );

  // Create the agent with the bash tool
  // Note: The bash tool description already includes CLI tools documentation,
  // so the agent can discover them without explicit instructions
  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions:
      "You are a helpful assistant. Use the bash tool to help users with their requests.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if (call.toolName === "bash" && "input" in call) {
            const input = call.input as { command: string };
            console.log(`> ${input.command}`);
          }
        }
      }
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          if (result.toolName === "bash" && "output" in result) {
            const output = result.output as {
              stdout: string;
              stderr: string;
              exitCode: number;
            };
            if (output.stdout) {
              console.log(output.stdout.slice(0, 500));
            }
            if (output.stderr) {
              console.log(`Error: ${output.stderr}`);
            }
          }
        }
        console.log("");
      }
    },
  });

  // Example prompt - a natural user request
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
