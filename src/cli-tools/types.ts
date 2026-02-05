import type { CommandContext } from "just-bash";
import type { z } from "zod";

/**
 * Directory where CLI tool outputs are saved.
 */
export const CLI_OUTPUT_DIR = ".cli-output";

/**
 * Maximum output size (in characters) to return inline.
 * Outputs larger than this are saved to files.
 * Default: 2000 characters (~50 lines of JSON)
 */
export const INLINE_OUTPUT_THRESHOLD = 2000;

/**
 * Context provided to CLI tool execute functions.
 * Alias for just-bash's CommandContext - provides fs, cwd, env, stdin, exec.
 */
export type CliToolContext = CommandContext;

/**
 * CLI tool definition (AI SDK compatible).
 * Name is provided via the object key in cliTools record.
 *
 * @template TInput - The input type (inferred from inputSchema output)
 */
export interface CliToolDefinition<TInput = unknown> {
  /** Human-readable description shown in help and LLM prompts */
  description: string;
  /** Zod schema for input parameters (AI SDK compatible). Uses z.output type. */
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  /** Execute function called with validated input and CLI context */
  execute: (
    input: TInput,
    context: CliToolContext,
  ) => Promise<unknown> | unknown;
}

/**
 * Record of CLI tool definitions keyed by name.
 * Names are camelCase in code, converted to kebab-case for CLI.
 * Uses `any` to avoid TypeScript variance issues with generic types.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance
export type CliToolsRecord = Record<string, CliToolDefinition<any>>;
