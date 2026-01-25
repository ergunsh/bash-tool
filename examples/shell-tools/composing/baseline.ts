/**
 * Baseline: Regular AI SDK tools for data joining
 *
 * Without bash scripting, the agent must:
 * 1. Call getUser → LLM sees result
 * 2. Extract teamId, call getTeam → LLM sees result
 * 3. Combine and respond
 *
 * This requires 2 LLM round-trips with intermediate data in context.
 *
 * Run with: npx tsx examples/shell-tools/composing/baseline.ts
 */

import { ToolLoopAgent, tool } from "ai";
import {
  descriptions,
  executeGetTeam,
  executeGetUser,
  getTeamInputSchema,
  getUserInputSchema,
  prompt,
} from "./shared.js";

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

async function main() {
  console.log("Creating agent with regular AI SDK tools (baseline)...\n");
  console.log("Expected: 2 round-trips (getUser, then getTeam)\n");

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-opus-4.5",
    tools: {
      getUser,
      getTeam,
    },
    instructions:
      "You are a helpful assistant with access to user and team data.",
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
            console.log(JSON.stringify(result.result, null, 2));
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
  console.log(`Steps: ${result.steps?.length ?? 0}`);
  console.log(`Total tokens: ${result.usage.totalTokens}`);
}

main().catch(console.error);
