/**
 * Example: Customer support agent with codemode runtime tools
 *
 * The agent has no special instructions about codemode or scripting —
 * it discovers those capabilities automatically through the bash tool prompt.
 *
 * Run with:
 *   npx tsx examples/codemode/index.ts
 */

import { ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_defineCodemodeTool,
} from "../../src/index.js";

async function main() {
  const searchKnowledgeBase = experimental_defineCodemodeTool({
    description:
      "Search the internal knowledge base for support articles matching a query.",
    inputSchema: z.object({
      query: z.string().describe("Natural language search query"),
      limit: z.number().int().min(1).max(10).default(3),
    }),
    outputSchema: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    ),
    execute: async ({ query, limit }) => {
      return Array.from({ length: limit }, (_, i) => ({
        title: `${query} — Article ${i + 1}`,
        url: `https://support.example.com/articles/${1000 + i}`,
        snippet: `Step-by-step guide for resolving "${query}" issues.`,
      }));
    },
  });

  const getCustomerDetails = experimental_defineCodemodeTool({
    description: "Look up a customer's account details by email address.",
    inputSchema: z.object({
      email: z.string().email(),
    }),
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
      plan: z.enum(["free", "pro", "enterprise"]),
      createdAt: z.string(),
    }),
    execute: async ({ email }) => ({
      id: "cus_abc123",
      name: email.split("@")[0],
      plan: "pro" as const,
      createdAt: "2024-11-02T10:30:00Z",
    }),
  });

  const { tools } = await createBashTool({
    codemode: {
      runtimeTools: {
        searchKnowledgeBase,
        getCustomerDetails,
      },
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions:
      "You are a customer support agent for Acme Corp. " +
      "Help customers by looking up their account and finding relevant support articles. " +
      "Be concise and friendly.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      for (const call of toolCalls ?? []) {
        if (call.toolName === "bash" && "input" in call) {
          const input = call.input as { command: string };
          console.log(`bash> ${input.command}`);
        }
      }

      for (const result of toolResults ?? []) {
        if (result.toolName === "bash" && "output" in result) {
          const output = result.output as {
            stdout: string;
            stderr: string;
            exitCode: number;
          };

          console.log(`exitCode: ${output.exitCode}`);

          if (output.stdout.trim()) {
            console.log(output.stdout.trim());
          }

          if (output.stderr.trim()) {
            console.log(output.stderr.trim());
          }

          console.log("");
        }
      }
    },
  });

  const result = await agent.generate({
    prompt:
      "I'm alice@example.com and I can't figure out how to set up SSO. " +
      "Can you look up my account and find me the right docs?",
  });

  console.log("Final response:");
  console.log(result.text);
}

main().catch(console.error);
