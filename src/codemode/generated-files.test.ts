import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateCodemodeFiles } from "./generated-files.js";

describe("generateCodemodeFiles", () => {
  it("creates a readable sdk, readme, and manifest", async () => {
    const result = await generateCodemodeFiles([
      {
        name: "searchDocs",
        description: "Search docs",
        tool: {
          description: "Search docs",
          inputSchema: z.object({
            query: z.string(),
            limit: z.number().optional(),
          }),
          outputSchema: z.array(
            z.object({
              title: z.string(),
              url: z.string(),
            }),
          ),
          execute: async () => [],
        },
      },
    ]);

    expect(result.relativePaths).toEqual([
      ".codemode/index.ts",
      ".codemode/README.md",
      ".codemode/manifest.json",
    ]);

    const indexFile = result.files.find(
      (file) => file.relativePath === ".codemode/index.ts",
    );

    expect(indexFile?.content).toContain("export interface SearchDocsInput");
    expect(indexFile?.content).toContain("export type SearchDocsOutput =");
    expect(indexFile?.content).toContain(
      'return await callTool<SearchDocsOutput>("searchDocs", input);',
    );

    expect(result.prompt).toContain("CODEMODE:");
    expect(result.prompt).toContain(
      "searchDocs(input) -> Promise<SearchDocsOutput>",
    );
  });
});
