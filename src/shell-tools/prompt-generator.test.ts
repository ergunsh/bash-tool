import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateShellToolsPrompt } from "./prompt-generator.js";

describe("generateShellToolsPrompt", () => {
  it("returns empty string for empty tools", () => {
    const result = generateShellToolsPrompt({});
    expect(result).toBe("");
  });

  it("generates prompt for single tool", () => {
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

    expect(result).toContain("CUSTOM SHELL TOOLS:");
    expect(result).toContain("fetch-user --id <string>");
    expect(result).toContain("Fetches a user from the database");
    expect(result).toContain("Output: JSON { name, email }");
    expect(result).toContain(
      "Run any tool with --help for detailed documentation.",
    );
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

    expect(result).toContain("fetch-user --id <string>");
    expect(result).toContain("Fetches a user");
    expect(result).toContain("send-email --to <string> --subject <string>");
    expect(result).toContain("Sends an email");
  });

  it("shows optional fields in brackets", () => {
    const result = generateShellToolsPrompt({
      search: {
        description: "Searches items",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().optional(),
          verbose: z.boolean().default(false),
        }),
        outputSchema: z.object({ results: z.array(z.string()) }),
        execute: async () => ({ results: [] }),
      },
    });

    expect(result).toContain(
      "search --query <string> [--limit <number>] [--verbose]",
    );
  });

  it("shows enum values in type", () => {
    const result = generateShellToolsPrompt({
      setLevel: {
        description: "Sets log level",
        inputSchema: z.object({
          level: z.enum(["debug", "info", "error"]),
        }),
        outputSchema: z.object({ success: z.boolean() }),
        execute: async () => ({ success: true }),
      },
    });

    expect(result).toContain("set-level --level <debug|info|error>");
  });

  it("shows optional fields in output description", () => {
    const result = generateShellToolsPrompt({
      getUser: {
        description: "Gets a user",
        inputSchema: z.object({ id: z.string() }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
          age: z.number().optional(),
        }),
        execute: async () => ({ name: "Alice", email: "alice@example.com" }),
      },
    });

    expect(result).toContain("Output: JSON { name, email, age? }");
  });

  it("handles array output type", () => {
    const result = generateShellToolsPrompt({
      listUsers: {
        description: "Lists all users",
        inputSchema: z.object({}),
        outputSchema: z.array(z.object({ name: z.string() })),
        execute: async () => [{ name: "Alice" }],
      },
    });

    expect(result).toContain("Output: JSON object[]");
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

    expect(result).toContain(
      "get-user-by-id --user-id <string> [--include-metadata]",
    );
  });
});
