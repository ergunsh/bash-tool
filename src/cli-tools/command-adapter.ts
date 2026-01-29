import type { Command, ExecResult } from "just-bash";
import { parseCliArgs, toKebabCase } from "./cli-parser.js";
import { generateHelp } from "./help-generator.js";
import type { CliToolDefinition, CliToolsRecord } from "./types.js";

export { toKebabCase };

/**
 * Convert a CliToolDefinition to a just-bash Command.
 *
 * The command:
 * - Uses kebab-case naming (camelCase to kebab-case conversion)
 * - Handles `--help` flag to show documentation
 * - Parses and validates CLI args against the input schema
 * - Executes the tool and returns JSON output
 * - Returns error + help on validation failure
 *
 * @param name - The tool name (camelCase, from object key)
 * @param definition - The CLI tool definition
 */
export function toCommand<TInput, TOutput>(
  name: string,
  definition: CliToolDefinition<TInput, TOutput>,
): Command {
  const kebabName = toKebabCase(name);
  const { description, inputSchema, outputSchema, execute } = definition;

  return {
    name: kebabName,
    async execute(args, ctx): Promise<ExecResult> {
      // Handle --help flag
      if (args.includes("--help") || args.includes("-h")) {
        const helpText = generateHelp({
          name: kebabName,
          description,
          inputSchema,
          outputSchema,
        });
        return {
          stdout: `${helpText}\n`,
          stderr: "",
          exitCode: 0,
        };
      }

      // Parse and validate CLI args
      const parseResult = parseCliArgs(args, inputSchema);

      if (!parseResult.success) {
        const helpText = generateHelp({
          name: kebabName,
          description,
          inputSchema,
          outputSchema,
        });
        return {
          stdout: "",
          stderr: `Error: ${parseResult.error}\n\n${helpText}\n`,
          exitCode: 1,
        };
      }

      // Execute the tool
      try {
        // Cast is safe because parseCliArgs validates against inputSchema
        const result = await execute(parseResult.data as TInput, ctx);
        const jsonOutput = JSON.stringify(result, null, 2);
        return {
          stdout: `${jsonOutput}\n`,
          stderr: "",
          exitCode: 0,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          stdout: "",
          stderr: `Error: ${message}\n`,
          exitCode: 1,
        };
      }
    },
  };
}

/**
 * Convert a record of CliToolDefinitions to an array of just-bash Commands.
 *
 * @param cliTools - Record of CLI tool definitions keyed by camelCase name
 * @returns Array of just-bash Commands with kebab-case names
 */
export function toCommands(cliTools: CliToolsRecord): Command[] {
  return Object.entries(cliTools).map(([name, definition]) =>
    toCommand(name, definition),
  );
}
