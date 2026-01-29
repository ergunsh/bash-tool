import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateCliToolsPrompt } from "./prompt-generator.js";

describe("generateCliToolsPrompt", () => {
  it("returns empty string for empty tools", () => {
    const result = generateCliToolsPrompt({});
    expect(result).toBe("");
  });

  it("generates prompt with usage signature and description", () => {
    const result = generateCliToolsPrompt({
      fetchUser: {
        description: "Fetches a user from the database",
        inputSchema: z.object({
          id: z.string().describe("The user ID"),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
        }),
        execute: async () => ({ name: "Alice", email: "alice@example.com" }),
      },
    });

    expect(result).toContain("CLI TOOLS:");
    // Shows usage signature with flags upfront (no --help needed)
    expect(result).toContain("fetch-user --id <string>");
    // Should NOT require --help (new strategy)
    expect(result).not.toContain("MUST run <tool> --help");
  });

  it("generates prompt for multiple tools", () => {
    const result = generateCliToolsPrompt({
      fetchUser: {
        description: "Fetches a user",
        inputSchema: z.object({ id: z.string() }),
        outputSchema: z.object({ name: z.string() }),
        execute: async () => ({ name: "Alice" }),
      },
      sendEmail: {
        description: "Sends an email",
        inputSchema: z.object({
          to: z.string(),
          subject: z.string(),
        }),
        outputSchema: z.object({ sent: z.boolean() }),
        execute: async () => ({ sent: true }),
      },
    });

    // Shows usage signatures upfront (compact - no descriptions)
    expect(result).toContain("fetch-user --id <string>");
    expect(result).toContain("send-email --to <string> --subject <string>");
  });

  it("converts camelCase to kebab-case", () => {
    const result = generateCliToolsPrompt({
      getUserById: {
        description: "Gets user by ID",
        inputSchema: z.object({
          userId: z.string(),
          includeMetadata: z.boolean().optional(),
        }),
        outputSchema: z.object({ userName: z.string() }),
        execute: async () => ({ userName: "Alice" }),
      },
    });

    expect(result).toContain(
      "get-user-by-id --user-id <string> [--include-metadata]",
    );
  });
});
