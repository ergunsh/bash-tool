import type { ToolExecutionOptions } from "ai";
import { assert, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBashTool } from "../tool.js";
import type { CommandResult } from "../types.js";
import { experimental_createCliTool } from "./cli-tool.js";

// AI SDK tool execute requires (args, options) - we provide test options
const opts: ToolExecutionOptions = { toolCallId: "test", messages: [] };

// Helper to execute bash command with assertion
async function execBash(
  tools: { bash: { execute?: unknown } },
  command: string,
): Promise<CommandResult> {
  assert(tools.bash.execute, "bash.execute should be defined");
  const execute = tools.bash.execute as (
    args: { command: string },
    options: ToolExecutionOptions,
  ) => Promise<CommandResult>;
  return execute({ command }, opts);
}

/**
 * Integration tests that verify CLI tools work correctly
 * with the real just-bash sandbox environment.
 */
describe("CLI tools integration", () => {
  describe("basic CLI tool", () => {
    it("executes CLI tool with args and returns JSON", async () => {
      const fetchUser = experimental_createCliTool({
        description: "Fetches a user from the database",
        inputSchema: z.object({
          id: z.string().describe("The user ID"),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
        }),
        execute: async ({ id }) => ({
          name: `User ${id}`,
          email: `${id}@example.com`,
        }),
      });

      const { tools } = await createBashTool({
        cliTools: { fetchUser },
      });

      const result = await execBash(tools, "fetch-user --id usr_123");

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");

      const output = JSON.parse(result.stdout);
      expect(output).toEqual({
        name: "User usr_123",
        email: "usr_123@example.com",
      });
    });

    it("shows help documentation on --help flag", async () => {
      const greet = experimental_createCliTool({
        description: "Greets a person",
        inputSchema: z.object({
          name: z.string().describe("Person to greet"),
          formal: z.boolean().optional().describe("Use formal greeting"),
        }),
        outputSchema: z.object({
          message: z.string(),
        }),
        execute: async ({ name, formal }) => ({
          message: formal ? `Good day, ${name}` : `Hello, ${name}!`,
        }),
      });

      const { tools } = await createBashTool({
        cliTools: { greet },
      });

      const result = await execBash(tools, "greet --help");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("greet - Greets a person");
      expect(result.stdout).toContain("USAGE:");
      expect(result.stdout).toContain("--name <string>");
      expect(result.stdout).toContain("[--formal]");
      expect(result.stdout).toContain("ARGUMENTS:");
      expect(result.stdout).toContain("Person to greet");
      expect(result.stdout).toContain("OUTPUT (JSON):");
    });

    it("returns error with help on validation failure", async () => {
      const fetchUser = experimental_createCliTool({
        description: "Fetches a user",
        inputSchema: z.object({
          id: z.string(),
        }),
        outputSchema: z.object({
          name: z.string(),
        }),
        execute: async ({ id }) => ({ name: `User ${id}` }),
      });

      const { tools } = await createBashTool({
        cliTools: { fetchUser },
      });

      const result = await execBash(tools, "fetch-user");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error:");
      expect(result.stderr).toContain("Missing required flag: --id");
      expect(result.stderr).toContain("USAGE:");
    });
  });

  describe("CLI tool with context", () => {
    it("can access filesystem via context", async () => {
      const readConfig = experimental_createCliTool({
        description: "Reads a config file",
        inputSchema: z.object({
          path: z.string().describe("Path to config file"),
        }),
        outputSchema: z.object({
          content: z.string(),
        }),
        execute: async ({ path }, ctx) => {
          const content = await ctx.fs.readFile(path);
          return { content };
        },
      });

      const { tools } = await createBashTool({
        files: { "config.json": '{"key": "value"}' },
        cliTools: { readConfig },
      });

      const result = await execBash(
        tools,
        "read-config --path /workspace/config.json",
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.content).toBe('{"key": "value"}');
    });

    it("can access environment variables via context", async () => {
      const getEnv = experimental_createCliTool({
        description: "Gets an environment variable",
        inputSchema: z.object({
          name: z.string().describe("Environment variable name"),
        }),
        outputSchema: z.object({
          value: z.string().optional(),
        }),
        execute: async ({ name }, ctx) => ({
          value: ctx.env[name],
        }),
      });

      const { tools } = await createBashTool({
        cliTools: { getEnv },
      });

      // Set env var and call tool in same command to ensure env persists
      const result = await execBash(
        tools,
        "MY_VAR=hello get-env --name MY_VAR",
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.value).toBe("hello");
    });

    it("can access current working directory via context", async () => {
      const getCwd = experimental_createCliTool({
        description: "Gets current working directory",
        inputSchema: z.object({}),
        outputSchema: z.object({
          cwd: z.string(),
        }),
        execute: async (_input, ctx) => ({
          cwd: ctx.cwd,
        }),
      });

      const { tools } = await createBashTool({
        destination: "/custom/path",
        cliTools: { getCwd },
      });

      const result = await execBash(tools, "get-cwd");

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.cwd).toBe("/custom/path");
    });
  });

  describe("piping with jq", () => {
    it("can pipe CLI tool output to jq", async () => {
      const listUsers = experimental_createCliTool({
        description: "Lists all users",
        inputSchema: z.object({}),
        outputSchema: z.object({
          users: z.array(
            z.object({
              name: z.string(),
              email: z.string(),
            }),
          ),
        }),
        execute: async () => ({
          users: [
            { name: "Alice", email: "alice@example.com" },
            { name: "Bob", email: "bob@example.com" },
          ],
        }),
      });

      const { tools } = await createBashTool({
        cliTools: { listUsers },
      });

      const result = await execBash(tools, "list-users | jq '.users[0].name'");

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('"Alice"');
    });

    it("can filter array with jq", async () => {
      const getData = experimental_createCliTool({
        description: "Gets data",
        inputSchema: z.object({}),
        outputSchema: z.object({
          items: z.array(
            z.object({
              id: z.number(),
              active: z.boolean(),
            }),
          ),
        }),
        execute: async () => ({
          items: [
            { id: 1, active: true },
            { id: 2, active: false },
            { id: 3, active: true },
          ],
        }),
      });

      const { tools } = await createBashTool({
        cliTools: { getData },
      });

      const result = await execBash(
        tools,
        "get-data | jq '[.items[] | select(.active)]'",
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toEqual([
        { id: 1, active: true },
        { id: 3, active: true },
      ]);
    });
  });

  describe("multiple CLI tools", () => {
    it("registers multiple CLI tools", async () => {
      const fetchUser = experimental_createCliTool({
        description: "Fetches a user",
        inputSchema: z.object({ id: z.string() }),
        outputSchema: z.object({ name: z.string() }),
        execute: async ({ id }) => ({ name: `User ${id}` }),
      });

      const sendEmail = experimental_createCliTool({
        description: "Sends an email",
        inputSchema: z.object({
          to: z.string(),
          subject: z.string(),
        }),
        outputSchema: z.object({ sent: z.boolean() }),
        execute: async () => ({ sent: true }),
      });

      const { tools } = await createBashTool({
        cliTools: { fetchUser, sendEmail },
      });

      // Test fetchUser
      const result1 = await execBash(tools, "fetch-user --id usr_1");
      expect(result1.exitCode).toBe(0);
      expect(JSON.parse(result1.stdout)).toEqual({ name: "User usr_1" });

      // Test sendEmail
      const result2 = await execBash(
        tools,
        'send-email --to bob@example.com --subject "Hello"',
      );
      expect(result2.exitCode).toBe(0);
      expect(JSON.parse(result2.stdout)).toEqual({ sent: true });
    });
  });

  describe("CLI tools prompt", () => {
    it("includes CLI tools in bash tool description", async () => {
      const fetchUser = experimental_createCliTool({
        description: "Fetches a user from the database",
        inputSchema: z.object({
          id: z.string().describe("The user ID"),
        }),
        outputSchema: z.object({
          name: z.string(),
          email: z.string(),
        }),
        execute: async ({ id }) => ({
          name: `User ${id}`,
          email: `${id}@example.com`,
        }),
      });

      const { tools } = await createBashTool({
        cliTools: { fetchUser },
      });

      expect(tools.bash.description).toContain("CLI TOOLS:");
      // Shows usage signature upfront (no --help needed)
      expect(tools.bash.description).toContain("fetch-user --id <string>");
      // Should NOT require --help (new strategy)
      expect(tools.bash.description).not.toContain("MUST run <tool> --help");
    });
  });

  describe("error handling", () => {
    it("returns error when execute throws", async () => {
      const failingTool = experimental_createCliTool({
        description: "A tool that always fails",
        inputSchema: z.object({}),
        outputSchema: z.object({ result: z.string() }),
        execute: async () => {
          throw new Error("Something went wrong");
        },
      });

      const { tools } = await createBashTool({
        cliTools: { failingTool },
      });

      const result = await execBash(tools, "failing-tool");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error: Something went wrong");
    });

    it("handles unknown flags gracefully", async () => {
      const simpleTool = experimental_createCliTool({
        description: "A simple tool",
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({ result: z.string() }),
        execute: async ({ name }) => ({ result: name }),
      });

      const { tools } = await createBashTool({
        cliTools: { simpleTool },
      });

      const result = await execBash(tools, "simple-tool --unknown value");

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown flag: --unknown");
    });
  });
});
