import type { CommandContext } from "just-bash";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toCommand, toCommands, toKebabCase } from "./command-adapter.js";
import type { CliToolDefinition } from "./types.js";

// Minimal mock context for testing
const createMockContext = (): CommandContext =>
  ({
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
    },
    cwd: "/workspace",
    env: {},
    stdin: "",
  }) as unknown as CommandContext;

describe("toKebabCase", () => {
  it("converts camelCase to kebab-case", () => {
    expect(toKebabCase("fetchUser")).toBe("fetch-user");
    expect(toKebabCase("includeMetadata")).toBe("include-metadata");
    expect(toKebabCase("id")).toBe("id");
  });
});

describe("toCommand", () => {
  it("creates a command with kebab-case name", () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    expect(command.name).toBe("fetch-user");
  });

  it("returns small output inline", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--id", "usr_123"], ctx);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    // Small output returns inline as JSON
    const output = JSON.parse(result.stdout);
    expect(output).toEqual({ name: "User usr_123" });
    // File should not be written for small output
    expect(ctx.fs.writeFile).not.toHaveBeenCalled();
  });

  it("saves large output to file with structure hint", async () => {
    const definition: CliToolDefinition<Record<string, never>> = {
      description: "Lists users",
      inputSchema: z.object({}),
      execute: async () => ({
        // Generate large output that exceeds inline threshold
        users: Array.from({ length: 100 }, (_, i) => ({
          id: `usr_${i}`,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          bio: `A longer bio text for user ${i} to make this output exceed the threshold.`,
        })),
        total: 100,
      }),
    };

    const command = toCommand("listUsers", definition);
    const ctx = createMockContext();
    (ctx.fs.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const result = await command.execute([], ctx);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Output saved to");
    expect(result.stdout).toContain(".cli-output/list-users-");
    expect(result.stdout).toContain(".json");
    // Structure hint included
    expect(result.stdout).toContain("Structure:");
    expect(result.stdout).toContain("users[100]");
    expect(ctx.fs.writeFile).toHaveBeenCalled();
  });

  it("creates output directory for large output if it does not exist", async () => {
    const definition: CliToolDefinition<Record<string, never>> = {
      description: "Lists users",
      inputSchema: z.object({}),
      execute: async () => ({
        users: Array.from({ length: 100 }, (_, i) => ({
          id: `usr_${i}`,
          name: `User ${i}`,
          bio: `Longer bio text for user ${i} to exceed threshold.`,
        })),
      }),
    };

    const command = toCommand("listUsers", definition);
    const ctx = createMockContext();
    (ctx.fs.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await command.execute([], ctx);

    expect(ctx.fs.mkdir).toHaveBeenCalledWith("/workspace/.cli-output", {
      recursive: true,
    });
  });

  it("does not create output directory for small output", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    (ctx.fs.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await command.execute(["--id", "usr_123"], ctx);

    // Small output returns inline, no directory needed
    expect(ctx.fs.mkdir).not.toHaveBeenCalled();
    expect(ctx.fs.writeFile).not.toHaveBeenCalled();
  });

  it("shows help on --help flag", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user from the database",
      inputSchema: z.object({ id: z.string().describe("The user ID") }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--help"], ctx);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("fetch-user - Fetches a user");
    expect(result.stdout).toContain("USAGE:");
    expect(result.stdout).toContain("ARGUMENTS:");
    expect(result.stdout).toContain("--id");
  });

  it("shows help on -h flag", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["-h"], ctx);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
  });

  it("returns error with help on validation failure", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute([], ctx);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error:");
    expect(result.stderr).toContain("Missing required flag: --id");
    expect(result.stderr).toContain("USAGE:");
  });

  it("returns error on unknown flag", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--unknown", "value"], ctx);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown flag: --unknown");
  });

  it("handles execute function errors", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async () => {
        throw new Error("User not found");
      },
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--id", "usr_123"], ctx);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error: User not found");
  });

  it("passes context to execute function", async () => {
    const executeFn = vi.fn().mockResolvedValue({ success: true });

    const definition: CliToolDefinition<{ id: string }> = {
      description: "Test tool",
      inputSchema: z.object({ id: z.string() }),
      execute: executeFn,
    };

    const command = toCommand("testTool", definition);
    const ctx = createMockContext();
    ctx.cwd = "/custom/path";
    ctx.env = { FOO: "bar" };

    await command.execute(["--id", "123"], ctx);

    expect(executeFn).toHaveBeenCalledWith({ id: "123" }, ctx);
    expect(executeFn.mock.calls[0][1].cwd).toBe("/custom/path");
    expect(executeFn.mock.calls[0][1].env).toEqual({ FOO: "bar" });
  });

  it("handles complex input types with defaults", async () => {
    // Test with complex input types including defaults
    interface ComplexInput {
      id: string;
      count: number;
      verbose: boolean;
      tags: string[];
    }

    const inputSchema = z.object({
      id: z.string(),
      count: z.number().default(10),
      verbose: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
    });

    const definition = {
      description: "Complex tool",
      inputSchema,
      execute: async (input: ComplexInput) => ({
        result: `${input.id}-${input.count}-${input.verbose}-${input.tags.join(",")}`,
      }),
    };

    const command = toCommand("complexTool", definition);
    const ctx = createMockContext();

    // With all args - small output returns inline
    const result1 = await command.execute(
      [
        "--id",
        "test",
        "--count",
        "5",
        "--verbose",
        "--tags",
        "a",
        "--tags",
        "b",
      ],
      ctx,
    );
    expect(result1.exitCode).toBe(0);
    // Small output returns inline as JSON
    const output = JSON.parse(result1.stdout);
    expect(output).toEqual({
      result: "test-5-true-a,b",
    });
  });

  it("handles synchronous execute function", async () => {
    const definition: CliToolDefinition<{ id: string }> = {
      description: "Sync tool",
      inputSchema: z.object({ id: z.string() }),
      execute: ({ id }) => ({ name: `User ${id}` }), // Sync
    };

    const command = toCommand("syncTool", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--id", "123"], ctx);

    expect(result.exitCode).toBe(0);
    // Small output returns inline
    expect(JSON.parse(result.stdout)).toEqual({ name: "User 123" });
  });
});

describe("toCommands", () => {
  it("converts record of definitions to array of commands", () => {
    const fetchUser: CliToolDefinition<{ id: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const sendEmail: CliToolDefinition<{ to: string; subject: string }> = {
      description: "Sends an email",
      inputSchema: z.object({
        to: z.string(),
        subject: z.string(),
      }),
      execute: async () => ({ sent: true }),
    };

    const commands = toCommands({ fetchUser, sendEmail });

    expect(commands).toHaveLength(2);
    expect(commands.map((c) => c.name).sort()).toEqual([
      "fetch-user",
      "send-email",
    ]);
  });
});
