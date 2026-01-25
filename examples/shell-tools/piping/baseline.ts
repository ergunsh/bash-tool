/**
 * Baseline: Regular AI SDK tools (no piping)
 *
 * This example uses regular AI SDK tools for the same e-commerce use case.
 * Used for testing alongside the shell tools version in index.ts.
 *
 * Run with: npx tsx examples/shell-tools/piping/baseline.ts
 */

import { ToolLoopAgent, tool } from "ai";
import {
  descriptions,
  executeListCustomers,
  executeListOrders,
  executeListProducts,
  listCustomersInputSchema,
  listOrdersInputSchema,
  listProductsInputSchema,
  prompt,
} from "./shared.js";

// Create AI SDK tools using shared definitions
const listOrders = tool({
  description: descriptions.listOrders,
  inputSchema: listOrdersInputSchema,
  execute: executeListOrders,
});

const listCustomers = tool({
  description: descriptions.listCustomers,
  inputSchema: listCustomersInputSchema,
  execute: executeListCustomers,
});

const listProducts = tool({
  description: descriptions.listProducts,
  inputSchema: listProductsInputSchema,
  execute: executeListProducts,
});

async function main() {
  console.log("Creating agent with regular AI SDK tools (baseline)...\n");

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      listOrders,
      listCustomers,
      listProducts,
    },
    instructions:
      "You are a helpful analytics assistant. Use the available tools to query data and answer questions.",
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
            const json = JSON.stringify(result.result, null, 2);
            console.log(json.slice(0, 800));
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
