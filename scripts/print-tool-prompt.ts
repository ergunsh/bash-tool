/**
 * Print the full tool descriptions sent to the AI agent.
 *
 * Shows the `description` field of each tool (bash, readFile, writeFile)
 * exactly as the AI model receives it.
 *
 * Usage:
 *   npx tsx scripts/print-tool-prompt.ts                 # without CLI tools
 *   npx tsx scripts/print-tool-prompt.ts --cli-tools    # with CLI tools
 */

import { z } from "zod";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
} from "../src/index.js";

// ============ Sample CLI Tools ============

const fetchUser = createCliTool({
  description: "Fetches a user by ID",
  inputSchema: z.object({
    id: z.string().describe("The user ID (e.g., usr_1)"),
    includeMetadata: z.boolean().optional().describe("Include creation date"),
  }),
  outputSchema: z.object({
    name: z.string(),
    email: z.string(),
    createdAt: z.string().optional(),
  }),
  execute: async ({ id, includeMetadata }) => ({
    name: "Alice",
    email: "alice@example.com",
    ...(includeMetadata && { createdAt: "2024-01-15" }),
  }),
});

const listUsers = createCliTool({
  description: "Lists all users in the database",
  inputSchema: z.object({
    limit: z.number().optional().default(10).describe("Maximum users to return"),
  }),
  outputSchema: z.object({
    users: z.array(z.object({ id: z.string(), name: z.string() })),
    total: z.number(),
  }),
  execute: async ({ limit }) => ({
    users: [
      { id: "usr_1", name: "Alice" },
      { id: "usr_2", name: "Bob" },
    ].slice(0, limit),
    total: 2,
  }),
});

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
  execute: async () => ({ sent: true, messageId: `msg_${Date.now()}` }),
});

// ============ Main ============

async function main() {
  const useCliTools = process.argv.includes("--cli-tools");

  const cliTools = useCliTools
    ? { fetchUser, listUsers, sendEmail }
    : undefined;

  console.log(
    useCliTools ? "Running WITH CLI tools\n" : "Running WITHOUT CLI tools\n",
  );

  const { tools } = await createBashTool({
    cliTools,
  });

  for (const [name, t] of Object.entries(tools)) {
    const description = (t as { description?: string }).description;
    console.log(`${"=".repeat(60)}`);
    console.log(`Tool: ${name}`);
    console.log(`${"=".repeat(60)}`);
    console.log(description ?? "(no description)");
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
