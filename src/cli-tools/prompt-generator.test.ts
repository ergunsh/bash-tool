import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateCliToolsPrompt } from "./prompt-generator.js";

describe("generateCliToolsPrompt", () => {
  it("returns empty string for empty tools", () => {
    const result = generateCliToolsPrompt({});
    expect(result).toBe("");
  });

  it("generates prompt with usage signature and file-based output", () => {
    const result = generateCliToolsPrompt({
      fetchUser: {
        description: "Fetches a user from the database",
        inputSchema: z.object({
          id: z.string().describe("The user ID"),
        }),
        execute: async () => ({ name: "Alice", email: "alice@example.com" }),
      },
    });

    expect(result).toContain("CLI TOOLS (outputs saved to files):");
    // Shows usage signature with flags upfront (no --help needed)
    expect(result).toContain("fetch-user --id <string>");
    // Shows file-based output instructions
    expect(result).toContain("Output files saved to: .cli-output/");
    expect(result).toContain("Read output: cat <path> | jq");
    expect(result).toContain("Search: grep 'pattern' <path>");
    // Should NOT require --help (new strategy)
    expect(result).not.toContain("MUST run <tool> --help");
  });

  it("generates prompt for multiple tools", () => {
    const result = generateCliToolsPrompt({
      fetchUser: {
        description: "Fetches a user",
        inputSchema: z.object({ id: z.string() }),
        execute: async () => ({ name: "Alice" }),
      },
      sendEmail: {
        description: "Sends an email",
        inputSchema: z.object({
          to: z.string(),
          subject: z.string(),
        }),
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
        execute: async () => ({ userName: "Alice" }),
      },
    });

    expect(result).toContain(
      "get-user-by-id --user-id <string> [--include-metadata]",
    );
  });
});
