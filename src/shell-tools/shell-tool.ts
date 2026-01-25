import type { ShellToolDefinition } from "./types.js";

/**
 * Creates a shell tool definition with type inference.
 *
 * Shell tools are registered as CLI commands in the bash environment.
 * They use Zod schemas for input validation and output typing.
 *
 * @example
 * ```typescript
 * const fetchUser = experimental_createShellTool({
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
 *   shellTools: { fetchUser },
 * });
 * ```
 */
export function experimental_createShellTool<TInput, TOutput>(
  definition: ShellToolDefinition<TInput, TOutput>,
): ShellToolDefinition<TInput, TOutput> {
  return definition;
}
