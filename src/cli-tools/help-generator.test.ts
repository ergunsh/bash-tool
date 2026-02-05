import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateHelp } from "./help-generator.js";

describe("generateHelp", () => {
  it("generates basic help with required string field", () => {
    const help = generateHelp({
      name: "fetch-user",
      description: "Fetches a user from the database",
      inputSchema: z.object({
        id: z.string().describe("The user ID"),
      }),
    });

    expect(help).toContain("fetch-user - Fetches a user from the database");
    expect(help).toContain("USAGE:");
    expect(help).toContain("fetch-user --id <string>");
    expect(help).toContain("ARGUMENTS:");
    expect(help).toContain("--id <string>");
    expect(help).toContain("The user ID");
    expect(help).toContain("(required)");
    expect(help).toContain("OUTPUT:");
    expect(help).toContain(".cli-output/");
  });

  it("generates help with optional boolean field", () => {
    const help = generateHelp({
      name: "fetch-user",
      description: "Fetches a user",
      inputSchema: z.object({
        id: z.string().describe("The user ID"),
        includeMetadata: z.boolean().optional().describe("Include timestamps"),
      }),
    });

    expect(help).toContain("[--include-metadata]");
    expect(help).toContain("--include-metadata");
    expect(help).toContain("Include timestamps");
    expect(help).toContain("(optional)");
  });

  it("generates help with default values", () => {
    const help = generateHelp({
      name: "list-users",
      description: "Lists users",
      inputSchema: z.object({
        limit: z.number().default(10).describe("Max results"),
        verbose: z.boolean().default(false).describe("Show details"),
      }),
    });

    expect(help).toContain("[--limit <number>]");
    expect(help).toContain("Max results");
    expect(help).toContain("(default: 10)");
    expect(help).toContain("[--verbose]");
    expect(help).toContain("(default: false)");
  });

  it("generates help with enum field", () => {
    const help = generateHelp({
      name: "set-level",
      description: "Sets the log level",
      inputSchema: z.object({
        level: z.enum(["debug", "info", "error"]).describe("Log level"),
      }),
    });

    expect(help).toContain("--level <debug|info|error>");
    expect(help).toContain("Log level");
  });

  it("generates help with array field", () => {
    const help = generateHelp({
      name: "add-tags",
      description: "Adds tags",
      inputSchema: z.object({
        tags: z.array(z.string()).describe("Tags to add"),
      }),
    });

    expect(help).toContain("--tags <value>...");
    expect(help).toContain("Tags to add");
  });

  it("generates help with object/json field", () => {
    const help = generateHelp({
      name: "update-config",
      description: "Updates configuration",
      inputSchema: z.object({
        config: z.object({ key: z.string() }).describe("Config object"),
      }),
    });

    expect(help).toContain("--config <json>");
    expect(help).toContain("Config object");
  });

  it("includes file-based output instructions", () => {
    const help = generateHelp({
      name: "get-user",
      description: "Gets a user",
      inputSchema: z.object({
        id: z.string(),
      }),
    });

    expect(help).toContain("OUTPUT:");
    expect(help).toContain(".cli-output/");
    expect(help).toContain("cat <path> | jq");
  });

  it("converts camelCase to kebab-case in usage", () => {
    const help = generateHelp({
      name: "fetch-user",
      description: "Fetches a user",
      inputSchema: z.object({
        userId: z.string().describe("The user ID"),
        includeMetadata: z.boolean().optional(),
        maxRetries: z.number().default(3),
      }),
    });

    expect(help).toContain("--user-id <string>");
    expect(help).toContain("[--include-metadata]");
    expect(help).toContain("[--max-retries <number>]");
  });
});
