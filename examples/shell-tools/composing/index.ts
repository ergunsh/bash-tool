/**
 * Example: Shell Tools with Bash Scripting for Data Joining
 *
 * This example tests whether bash scripting can save LLM round-trips
 * by executing multiple tool calls and combining results in one script.
 *
 * Expected behavior:
 * - Agent writes a bash script that: gets user → extracts teamId → gets team → combines
 * - All in one bash tool call, returning only the final combined result
 *
 * Run with: npx tsx examples/shell-tools/composing/index.ts
 */

import { ToolLoopAgent } from "ai";
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

async function main() {
  console.log("Creating bash tool with user/team shell tools...\n");

  const { tools } = await createBashTool({
    shellTools: {
      getUser,
      getTeam,
    },
  });

  console.log("Shell tools registered.\n");
  console.log(
    "Expected: Agent writes a bash script to join user + team data.\n",
  );

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-opus-4.5",
    tools: {
      bash: tools.bash,
    },
    instructions:
      "You are a helpful assistant with access to user and team data.",
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
            if (output.stdout) {
              console.log(output.stdout.slice(0, 800));
            }
            if (output.stderr) {
              console.log(`Error: ${output.stderr}`);
            }
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
