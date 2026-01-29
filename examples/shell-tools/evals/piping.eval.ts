/**
 * Piping Shell Tools Evaluation
 *
 * Tests shell tools with multi-step pipeline chaining.
 * This scenario benefits from scripting: list IDs then fetch each.
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
  executeGetOrder,
  executeListOrderIds,
  getOrderInputSchema,
  getOrderOutputSchema,
  listOrderIdsInputSchema,
  listOrderIdsOutputSchema,
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

  const listOrderIds = createShellTool({
    description: descriptions.listOrderIds,
    inputSchema: listOrderIdsInputSchema,
    outputSchema: listOrderIdsOutputSchema,
    execute: executeListOrderIds,
  });

  const getOrder = createShellTool({
    description: descriptions.getOrder,
    inputSchema: getOrderInputSchema,
    outputSchema: getOrderOutputSchema,
    execute: executeGetOrder,
  });

  const { tools } = await createBashTool({
    shellTools: {
      listOrderIds,
      getOrder,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
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

  const listOrderIds = tool({
    description: descriptions.listOrderIds,
    inputSchema: listOrderIdsInputSchema,
    execute: executeListOrderIds,
  });

  const getOrder = tool({
    description: descriptions.getOrder,
    inputSchema: getOrderInputSchema,
    execute: executeGetOrder,
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      listOrderIds,
      getOrder,
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
      // The prompt asks about total amount spent by cust_1
      // cust_1 has orders: ord_1 (199.98), ord_3 (89.97), ord_5 (124.95) = 414.90
      requiredResponseTerms: ["total", "199", "89", "124"],
    },
    outputPath: "examples/shell-tools/evals/data/piping-output.json",
  });
}

main().catch(console.error);
