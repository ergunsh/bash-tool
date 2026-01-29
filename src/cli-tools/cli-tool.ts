import type { CliToolDefinition } from "./types.js";

/**
 * Creates a CLI tool definition with type inference.
 *
 * CLI tools are registered as CLI commands in the bash environment.
 * They use Zod schemas for input validation and output typing.
 *
 * @example
 * ```typescript
 * const fetchUser = experimental_createCliTool({
 *   description: "Fetches a user from the database",
 *   inputSchema: z.object({
 *     id: z.string().describe("The user ID"),
 *     includeMetadata: z.boolean().optional(),
 *   }),
 *   outputSchema: z.object({
 *     name: z.string(),
 *     email: z.string(),
 *     createdAt: z.string().optional(),
 *   }),
 *   execute: async ({ id, includeMetadata }) => {
 *     // Implementation
 *     return { name: "Alice", email: "alice@example.com" };
 *   },
 * });
 *
 * // Register with createBashTool
 * const { tools } = await createBashTool({
 *   cliTools: { fetchUser },
 * });
 * ```
 */
export function experimental_createCliTool<TInput, TOutput>(
  definition: CliToolDefinition<TInput, TOutput>,
): CliToolDefinition<TInput, TOutput> {
  return definition;
}
