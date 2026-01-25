import type { CommandContext } from "just-bash";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { toCommand, toCommands, toKebabCase } from "./command-adapter.js";
import type { ShellToolDefinition } from "./types.js";

// Minimal mock context for testing
const createMockContext = (): CommandContext =>
  ({
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn(),
      rm: vi.fn(),
      exists: vi.fn(),
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
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    expect(command.name).toBe("fetch-user");
  });

  it("executes with valid args and returns JSON", async () => {
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--id", "usr_123"], ctx);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({ name: "User usr_123" });
  });

  it("shows help on --help flag", async () => {
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user from the database",
      inputSchema: z.object({ id: z.string().describe("The user ID") }),
      outputSchema: z.object({ name: z.string() }),
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
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["-h"], ctx);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE:");
  });

  it("returns error with help on validation failure", async () => {
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
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
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const command = toCommand("fetchUser", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--unknown", "value"], ctx);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown flag: --unknown");
  });

  it("handles execute function errors", async () => {
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
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

    const definition: ShellToolDefinition<
      { id: string },
      { success: boolean }
    > = {
      description: "Test tool",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ success: z.boolean() }),
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
      outputSchema: z.object({ result: z.string() }),
      execute: async (input: ComplexInput) => ({
        result: `${input.id}-${input.count}-${input.verbose}-${input.tags.join(",")}`,
      }),
    };

    const command = toCommand("complexTool", definition);
    const ctx = createMockContext();

    // With all args
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
    expect(JSON.parse(result1.stdout)).toEqual({
      result: "test-5-true-a,b",
    });

    // With defaults
    const result2 = await command.execute(["--id", "test"], ctx);
    expect(result2.exitCode).toBe(0);
    expect(JSON.parse(result2.stdout)).toEqual({
      result: "test-10-false-",
    });
  });

  it("handles synchronous execute function", async () => {
    const definition: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Sync tool",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: ({ id }) => ({ name: `User ${id}` }), // Sync
    };

    const command = toCommand("syncTool", definition);
    const ctx = createMockContext();
    const result = await command.execute(["--id", "123"], ctx);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ name: "User 123" });
  });
});

describe("toCommands", () => {
  it("converts record of definitions to array of commands", () => {
    const fetchUser: ShellToolDefinition<{ id: string }, { name: string }> = {
      description: "Fetches a user",
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ name: z.string() }),
      execute: async ({ id }) => ({ name: `User ${id}` }),
    };

    const sendEmail: ShellToolDefinition<
      { to: string; subject: string },
      { sent: boolean }
    > = {
      description: "Sends an email",
      inputSchema: z.object({
        to: z.string(),
        subject: z.string(),
      }),
      outputSchema: z.object({ sent: z.boolean() }),
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
