import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateShellToolsPrompt } from "./prompt-generator.js";

describe("generateShellToolsPrompt", () => {
  it("returns empty string for empty tools", () => {
    const result = generateShellToolsPrompt({});
    expect(result).toBe("");
  });

  it("generates prompt with tool name and description", () => {
    const result = generateShellToolsPrompt({
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

    expect(result).toContain("CUSTOM SHELL TOOLS");
    expect(result).toContain("no positional args");
    expect(result).toContain("fetch-user - Fetches a user from the database");
    expect(result).toContain("MUST run <tool> --help before first use");
    // Should NOT contain usage details (progressive disclosure)
    expect(result).not.toContain("--id <string>");
    expect(result).not.toContain("Output:");
  });

  it("generates prompt for multiple tools", () => {
    const result = generateShellToolsPrompt({
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

    expect(result).toContain("fetch-user - Fetches a user");
    expect(result).toContain("send-email - Sends an email");
    // Should NOT contain usage details
    expect(result).not.toContain("--id <string>");
    expect(result).not.toContain("--to <string>");
    expect(result).not.toContain("Output:");
  });

  it("converts camelCase to kebab-case", () => {
    const result = generateShellToolsPrompt({
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

    expect(result).toContain("get-user-by-id - Gets user by ID");
  });
});
