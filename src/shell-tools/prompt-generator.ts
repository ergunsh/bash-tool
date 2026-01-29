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
 * Available shell tools:
 *   fetch-user # Fetches a user from the database
 *   list-users # Lists all users in the database
 *
 * Run <tool> --help before first use to see usage, flags, and output format.
 * ```
 */
export function generateShellToolsPrompt(
  shellTools: Record<string, ShellToolDefinition>,
): string {
  const toolNames = Object.keys(shellTools);

  if (toolNames.length === 0) {
    return "";
  }

  const lines: string[] = ["Available shell tools:"];

  for (const name of toolNames) {
    const kebabName = toKebabCase(name);
    const { description } = shellTools[name];
    lines.push(`  ${kebabName} # ${description}`);
  }

  lines.push("");
  lines.push(
    "Run <tool> --help before first use to see usage, flags, and output format.",
  );
  lines.push("");

  return lines.join("\n");
}
