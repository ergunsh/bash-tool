/**
 * Example: Agent investigates a runtime failure
 *
 * Run with:
 *   npx tsx examples/codemode/validation.ts
 */

import { ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_defineCodemodeTool,
} from "../../src/index.js";

async function main() {
  const listMatches = experimental_defineCodemodeTool({
    description: "Return a repeated list of matches.",
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().int().min(1).max(5),
    }),
    outputSchema: z.array(z.string()),
    execute: async ({ query, limit }) =>
      Array.from({ length: limit }, () => query),
  });

  const { tools } = await createBashTool({
    codemode: {
      runtimeTools: {
        listMatches,
      },
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions: `You are a coding agent inside a sandbox.
Inspect the workspace before choosing an approach.
Write short scripts when they help you complete the task.
When you reproduce an error, capture the exact message and explain it clearly.`,
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
    prompt: `Investigate why asking for zero matches fails, reproduce the error, and explain the fix.`,
  });

  console.log("Final response:");
  console.log(result.text);
}

main().catch(console.error);
