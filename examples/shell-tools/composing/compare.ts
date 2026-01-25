/**
 * Comparison script: User + Team join scenario
 *
 * Tests whether bash scripting can save LLM round-trips by:
 * - Executing multiple tool calls in one script
 * - Combining results before returning to LLM
 *
 * Run with: npx tsx examples/shell-tools/composing/compare.ts
 */

import { writeFileSync } from "node:fs";
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
} from "./shared.js";

interface ToolCall {
  tool: string;
  input: unknown;
  output: unknown;
}

async function runShellToolsVersion(): Promise<{
  calls: ToolCall[];
  response: string;
  tokens: number;
  steps: number;
}> {
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
    model: "anthropic/claude-opus-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions:
      "You are a helpful assistant with access to user and team data.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolResults) {
        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i];
          const result = toolResults[i];
          if ("input" in call && "output" in result) {
            calls.push({
              tool: call.toolName,
              input: call.input,
              output: result.output,
            });
          }
        }
      }
    },
  });

  const result = await agent.generate({ prompt });

  return {
    calls,
    response: result.text,
    tokens: result.usage.totalTokens ?? 0,
    steps: result.steps?.length ?? 0,
  };
}

async function runBaselineVersion(): Promise<{
  calls: ToolCall[];
  response: string;
  tokens: number;
  steps: number;
}> {
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
    model: "anthropic/claude-opus-4.5",
    tools: {
      getUser,
      getTeam,
    },
    instructions:
      "You are a helpful assistant with access to user and team data.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolResults) {
        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i];
          const result = toolResults[i];
          if (call && result) {
            calls.push({
              tool: call.toolName,
              input: "input" in call ? call.input : null,
              output: "result" in result ? result.result : result,
            });
          }
        }
      }
    },
  });

  const result = await agent.generate({ prompt });

  return {
    calls,
    response: result.text,
    tokens: result.usage.totalTokens ?? 0,
    steps: result.steps?.length ?? 0,
  };
}

async function main() {
  console.log("Running comparison: User + Team join scenario\n");
  console.log("Expected:");
  console.log(
    "  - Shell tools: 1 bash call with script that does both lookups",
  );
  console.log("  - Baseline: 2 separate tool calls (getUser, then getTeam)");
  console.log("");

  console.log("=== Running Shell Tools Version ===\n");
  const shellResult = await runShellToolsVersion();
  console.log(
    `Shell tools: ${shellResult.calls.length} tool calls, ${shellResult.tokens} tokens, ${shellResult.steps} steps\n`,
  );

  console.log("=== Running Baseline Version ===\n");
  const baselineResult = await runBaselineVersion();
  console.log(
    `Baseline: ${baselineResult.calls.length} tool calls, ${baselineResult.tokens} tokens, ${baselineResult.steps} steps\n`,
  );

  // Save results
  const output = {
    prompt,
    shellTools: {
      toolCalls: shellResult.calls.length,
      tokens: shellResult.tokens,
      steps: shellResult.steps,
      calls: shellResult.calls,
      response: shellResult.response,
    },
    baseline: {
      toolCalls: baselineResult.calls.length,
      tokens: baselineResult.tokens,
      steps: baselineResult.steps,
      calls: baselineResult.calls,
      response: baselineResult.response,
    },
  };

  const outputPath = "examples/shell-tools/composing/comparison-output.json";
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${outputPath}`);

  // Summary
  console.log("\n=== Summary ===");
  console.log(
    `Shell Tools: ${shellResult.calls.length} calls, ${shellResult.tokens} tokens, ${shellResult.steps} steps`,
  );
  console.log(
    `Baseline:    ${baselineResult.calls.length} calls, ${baselineResult.tokens} tokens, ${baselineResult.steps} steps`,
  );
  const diff = shellResult.tokens - baselineResult.tokens;
  console.log(
    `Difference:  ${Math.abs(diff)} tokens (${diff > 0 ? "shell tools used more" : "shell tools used fewer"})`,
  );
}

main().catch(console.error);
