import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getCodemodeTypeNames, validateCodemodeTools } from "./registry.js";

describe("validateCodemodeTools", () => {
  it("rejects an empty registry", () => {
    expect(() =>
      validateCodemodeTools({
        runtimeTools: {},
      }),
    ).toThrow("codemode.runtimeTools must contain at least one tool");
  });

  it("rejects invalid JavaScript identifiers", () => {
    expect(() =>
      validateCodemodeTools({
        runtimeTools: {
          "search-docs": {
            description: "Search docs",
            inputSchema: z.object({ query: z.string() }),
            outputSchema: z.array(z.string()),
            execute: async () => ["ok"],
          },
        },
      }),
    ).toThrow(
      'codemode tool name "search-docs" is invalid: use a valid JavaScript identifier',
    );
  });

  it("rejects reserved names", () => {
    expect(() =>
      validateCodemodeTools({
        runtimeTools: {
          default: {
            description: "Search docs",
            inputSchema: z.object({ query: z.string() }),
            outputSchema: z.array(z.string()),
            execute: async () => ["ok"],
          },
        },
      }),
    ).toThrow(
      'codemode tool name "default" is invalid: use a valid JavaScript identifier',
    );
  });
});

describe("getCodemodeTypeNames", () => {
  it("creates readable type names from the tool name", () => {
    expect(getCodemodeTypeNames("searchDocs")).toEqual({
      base: "SearchDocs",
      input: "SearchDocsInput",
      output: "SearchDocsOutput",
    });
  });
});
