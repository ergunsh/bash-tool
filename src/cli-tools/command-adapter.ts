import type { Command, ExecResult } from "just-bash";
import { parseCliArgs, toKebabCase } from "./cli-parser.js";
import { generateHelp } from "./help-generator.js";
import {
  CLI_OUTPUT_DIR,
  type CliToolDefinition,
  type CliToolsRecord,
  INLINE_OUTPUT_THRESHOLD,
} from "./types.js";

export { toKebabCase };

/**
 * Generate a brief structure hint for JSON output.
 * Shows top-level keys and array item fields to help with jq queries.
 */
function generateStructureHint(data: unknown, depth = 0): string {
  if (data === null) return "null";

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    // Show first item's structure for arrays
    const itemHint =
      depth < 1 ? generateStructureHint(data[0], depth + 1) : "...";
    return `[${data.length}]${itemHint}`;
  }

  if (typeof data === "object") {
    const keys = Object.keys(data);
    const maxKeys = depth === 0 ? 4 : 6;
    const hints = keys.slice(0, maxKeys).map((key) => {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        if (depth < 1 && value.length > 0) {
          const itemHint = generateStructureHint(value[0], depth + 1);
          return `${key}[${value.length}]${itemHint}`;
        }
        return `${key}[${value.length}]`;
      }
      if (typeof value === "object" && value !== null) {
        return depth < 1
          ? `${key}: ${generateStructureHint(value, depth + 1)}`
          : `${key}: {...}`;
      }
      return key;
    });
    if (keys.length > maxKeys) {
      hints.push("...");
    }
    return `{${hints.join(", ")}}`;
  }

  return typeof data;
}

/**
 * Convert a CliToolDefinition to a just-bash Command.
 *
 * The command:
 * - Uses kebab-case naming (camelCase to kebab-case conversion)
 * - Handles `--help` flag to show documentation
 * - Parses and validates CLI args against the input schema
 * - Executes the tool and saves output to file
 * - Returns error + help on validation failure
 *
 * @param name - The tool name (camelCase, from object key)
 * @param definition - The CLI tool definition
 */
export function toCommand<TInput>(
  name: string,
  definition: CliToolDefinition<TInput>,
): Command {
  const kebabName = toKebabCase(name);
  const { description, inputSchema, execute } = definition;

  return {
    name: kebabName,
    async execute(args, ctx): Promise<ExecResult> {
      // Handle --help flag
      if (args.includes("--help") || args.includes("-h")) {
        const helpText = generateHelp({
          name: kebabName,
          description,
          inputSchema,
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

        // Return small outputs inline, save large outputs to file
        if (jsonOutput.length <= INLINE_OUTPUT_THRESHOLD) {
          return {
            stdout: `${jsonOutput}\n`,
            stderr: "",
            exitCode: 0,
          };
        }

        // Save large output to file
        const outputDir = `${ctx.cwd}/${CLI_OUTPUT_DIR}`;
        if (!(await ctx.fs.exists(outputDir))) {
          await ctx.fs.mkdir(outputDir, { recursive: true });
        }
        const outputPath = `${outputDir}/${kebabName}-${Date.now()}.json`;
        await ctx.fs.writeFile(outputPath, jsonOutput);

        // Include structure hint to help with jq queries
        const structureHint = generateStructureHint(result);

        return {
          stdout: `Output saved to ${outputPath}\nStructure: ${structureHint}\n`,
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
