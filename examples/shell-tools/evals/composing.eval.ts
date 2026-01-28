/**
 * Composing Shell Tools Evaluation
 *
 * Tests whether bash scripting can save LLM round-trips by executing
 * multiple tool calls in one script and combining results.
 *
 * Scenario: Get user details including their team's name and department.
 * - Baseline: 2 LLM round-trips (get user, then get team)
 * - Shell tools: Could be 1 round-trip with bash script
 *
 * Run with: npx tsx examples/shell-tools/evals/composing.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
} from "../../../src/index.js";
import {
  descriptions,
  executeGetTeam,
  executeGetUser,
  getTeamInputSchema,
  getTeamOutputSchema,
  getUserInputSchema,
  getUserOutputSchema,
  prompt,
} from "../composing/shared.js";
import {
  createStepHandler,
  type RunResult,
  runComparison,
  type ToolCall,
} from "./utils.js";

// ============ Shell Tools Version ============

async function runShellToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const getUser = createShellTool({
    description: descriptions.getUser,
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: executeGetUser,
  });

  const getTeam = createShellTool({
    description: descriptions.getTeam,
    inputSchema: getTeamInputSchema,
    outputSchema: getTeamOutputSchema,
    execute: executeGetTeam,
  });

  const { tools } = await createBashTool({
    shellTools: {
      getUser,
      getTeam,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions:
      "You are a helpful assistant with access to user and team data.",
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

  const getUser = tool({
    description: descriptions.getUser,
    inputSchema: getUserInputSchema,
    execute: executeGetUser,
  });

  const getTeam = tool({
    description: descriptions.getTeam,
    inputSchema: getTeamInputSchema,
    execute: executeGetTeam,
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      getUser,
      getTeam,
    },
    instructions:
      "You are a helpful assistant with access to user and team data.",
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
    name: "Composing Shell Tools Example",
    prompt,
    runShellTools: runShellToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      // The prompt asks about alice and her team
      requiredResponseTerms: ["alice", "engineering", "product"],
    },
    outputPath: "examples/shell-tools/evals/data/composing-output.json",
  });
}

main().catch(console.error);
