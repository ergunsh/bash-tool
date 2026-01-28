/**
 * Piping Shell Tools Evaluation
 *
 * Tests shell tools with jq piping for complex queries.
 * This scenario benefits from piping: calculating totals from filtered data.
 *
 * Run with: npx tsx examples/shell-tools/evals/piping.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
} from "../../../src/index.js";
import {
  descriptions,
  executeListCustomers,
  executeListOrders,
  executeListProducts,
  listCustomersInputSchema,
  listCustomersOutputSchema,
  listOrdersInputSchema,
  listOrdersOutputSchema,
  listProductsInputSchema,
  listProductsOutputSchema,
  prompt,
} from "../piping/shared.js";
import {
  createStepHandler,
  type RunResult,
  runComparison,
  type ToolCall,
} from "./utils.js";

// ============ Shell Tools Version ============

async function runShellToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const listOrders = createShellTool({
    description: descriptions.listOrders,
    inputSchema: listOrdersInputSchema,
    outputSchema: listOrdersOutputSchema,
    execute: executeListOrders,
  });

  const listCustomers = createShellTool({
    description: descriptions.listCustomers,
    inputSchema: listCustomersInputSchema,
    outputSchema: listCustomersOutputSchema,
    execute: executeListCustomers,
  });

  const listProducts = createShellTool({
    description: descriptions.listProducts,
    inputSchema: listProductsInputSchema,
    outputSchema: listProductsOutputSchema,
    execute: executeListProducts,
  });

  const { tools } = await createBashTool({
    shellTools: {
      listOrders,
      listCustomers,
      listProducts,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful analytics assistant. Use the bash tool to query data.",
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

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      listOrders,
      listCustomers,
      listProducts,
    },
    instructions:
      "You are a helpful analytics assistant. Use the available tools to query data and answer questions.",
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
    name: "Piping Shell Tools Example",
    prompt,
    runShellTools: runShellToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      // The prompt asks about revenue from premium CA customers
      requiredResponseTerms: ["revenue", "premium", "california"],
    },
    outputPath: "examples/shell-tools/evals/data/piping-output.json",
  });
}

main().catch(console.error);
