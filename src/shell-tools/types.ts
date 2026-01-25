import type { CommandContext } from "just-bash";
import type { z } from "zod";

/**
 * Context provided to shell tool execute functions.
 * Alias for just-bash's CommandContext - provides fs, cwd, env, stdin, exec.
 */
export type ShellToolContext = CommandContext;

/**
 * Shell tool definition (AI SDK compatible).
 * Name is provided via the object key in shellTools record.
 *
 * @template TInput - The input type (inferred from inputSchema output)
 * @template TOutput - The output type (inferred from outputSchema)
 */
export interface ShellToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Human-readable description shown in help and LLM prompts */
  description: string;
  /** Zod schema for input parameters (AI SDK compatible). Uses z.output type. */
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  /** Zod schema for output structure (extension to AI SDK) */
  outputSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  /** Execute function called with validated input and shell context */
  execute: (
    input: TInput,
    context: ShellToolContext,
  ) => Promise<TOutput> | TOutput;
}

/**
 * Record of shell tool definitions keyed by name.
 * Names are camelCase in code, converted to kebab-case for CLI.
 * Uses `any` to avoid TypeScript variance issues with generic types.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance
export type ShellToolsRecord = Record<string, ShellToolDefinition<any, any>>;
