import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCodemodeCommand } from "./bridge.js";

interface CommandLike {
  name: string;
  execute: (
    args: string[],
    ctx: {
      stdin: string;
    },
  ) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}

describe("createCodemodeCommand", () => {
  it("returns JSON for successful tool calls", async () => {
    const command = (await createCodemodeCommand([
      {
        name: "searchDocs",
        description: "Search docs",
        tool: {
          description: "Search docs",
          inputSchema: z.object({
            query: z.string(),
          }),
          outputSchema: z.array(z.string()),
          execute: async ({ query }) => [query.toUpperCase()],
        },
      },
    ])) as CommandLike;

    const result = await command.execute(["searchDocs"], {
      stdin: JSON.stringify({ query: "cache" }),
    });

    expect(result).toEqual({
      stdout: '["CACHE"]',
      stderr: "",
      exitCode: 0,
    });
  });

  it("formats input validation failures", async () => {
    const command = (await createCodemodeCommand([
      {
        name: "searchDocs",
        description: "Search docs",
        tool: {
          description: "Search docs",
          inputSchema: z.object({
            query: z.string(),
            limit: z.number().int().min(1),
          }),
          outputSchema: z.array(z.string()),
          execute: async () => ["ok"],
        },
      },
    ])) as CommandLike;

    const result = await command.execute(["searchDocs"], {
      stdin: JSON.stringify({ query: "cache", limit: 0 }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "codemode.searchDocs input validation failed:",
    );
    expect(result.stderr).toContain("input.limit");
  });

  it("formats output validation failures", async () => {
    const command = (await createCodemodeCommand([
      {
        name: "searchDocs",
        description: "Search docs",
        tool: {
          description: "Search docs",
          inputSchema: z.object({
            query: z.string(),
          }),
          outputSchema: z.array(
            z.object({
              title: z.string(),
              url: z.string(),
            }),
          ),
          execute: async () =>
            [{ title: "missing-url" }] as unknown as Array<{
              title: string;
              url: string;
            }>,
        },
      },
    ])) as CommandLike;

    const result = await command.execute(["searchDocs"], {
      stdin: JSON.stringify({ query: "cache" }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "codemode.searchDocs output validation failed:",
    );
    expect(result.stderr).toContain("result[0].url");
  });
});
