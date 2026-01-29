import { toKebabCase } from "./cli-parser.js";
import type { ShellToolDefinition } from "./types.js";

/**
 * Generate LLM prompt section for shell tools.
 *
 * Uses progressive disclosure: only tool names and descriptions are shown
 * in the main prompt. The agent runs `<tool> --help` to get full usage details.
 *
 * @example
 * ```
 * CUSTOM SHELL TOOLS (all require --flag args, no positional args):
 *   fetch-user - Fetches a user from the database
 *   list-users - Lists all users in the database
 *
 * IMPORTANT: You MUST run <tool> --help before first use to see required flags and output format.
 * ```
 */
export function generateShellToolsPrompt(
  shellTools: Record<string, ShellToolDefinition>,
): string {
  const toolNames = Object.keys(shellTools);

  if (toolNames.length === 0) {
    return "";
  }

  const lines: string[] = [
    "CUSTOM SHELL TOOLS (all require --flag args, no positional args):",
  ];

  for (const name of toolNames) {
    const kebabName = toKebabCase(name);
    const { description } = shellTools[name];
    lines.push(`  ${kebabName} - ${description}`);
  }

  lines.push("");
  lines.push(
    "IMPORTANT: You MUST run <tool> --help before first use to see required flags and output format.",
  );
  lines.push("");
  lines.push(
    "EFFICIENCY: Combine operations in ONE bash call to minimize round-trips:",
  );
  lines.push(
    "  Pipe: tool | jq '[.items[] | select(.field == \"x\") | .val] | add'",
  );
  lines.push("  Chain: a=$(tool-a); tool-b --id $(echo \"$a\" | jq -r '.ref')");
  lines.push(
    "  Batch: for id in x y z; do tool --id $id; done | jq -s '[.[].val] | add'",
  );

  return lines.join("\n");
}
