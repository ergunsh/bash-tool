/**
 * Example: CLI Tools with Piping
 *
 * This example demonstrates where piping provides the most benefit.
 * With CLI tools, the agent can chain operations in a single command
 * using jq, avoiding multiple LLM round-trips.
 *
 * Run with: npx tsx examples/cli-tools/piping/index.ts
 */

import { ToolLoopAgent } from "ai";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
} from "../../../src/index.js";
import {
  descriptions,
  executeGetOrder,
  executeListOrderIds,
  getOrderInputSchema,
  listOrderIdsInputSchema,
  prompt,
} from "./shared.js";

// Create CLI tools using shared definitions
const listOrderIds = createCliTool({
  description: descriptions.listOrderIds,
  inputSchema: listOrderIdsInputSchema,
  execute: executeListOrderIds,
});

const getOrder = createCliTool({
  description: descriptions.getOrder,
  inputSchema: getOrderInputSchema,
  execute: executeGetOrder,
});

async function main() {
  console.log("Creating bash tool with order CLI tools...\n");

  const { tools } = await createBashTool({
    cliTools: {
      listOrderIds,
      getOrder,
    },
  });

  console.log("CLI tools registered. Agent can use jq to chain operations.\n");

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful analytics assistant. Use the bash tool to query data.",
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
            const output = result.output as { stdout: string; stderr: string };
            if (output.stdout) console.log(output.stdout.slice(0, 800));
            if (output.stderr) console.log(`Error: ${output.stderr}`);
          }
        }
        console.log("");
      }
    },
  });

  console.log(`Prompt: "${prompt}"\n`);
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
