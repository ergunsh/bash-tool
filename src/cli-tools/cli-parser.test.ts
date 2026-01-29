import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  getDescription,
  isOptional,
  parseCliArgs,
  toCamelCase,
  toKebabCase,
} from "./cli-parser.js";

describe("toKebabCase", () => {
  it("converts camelCase to kebab-case", () => {
    expect(toKebabCase("fetchUser")).toBe("fetch-user");
    expect(toKebabCase("includeMetadata")).toBe("include-metadata");
    expect(toKebabCase("id")).toBe("id");
    expect(toKebabCase("getAPIKey")).toBe("get-apikey");
  });
});

describe("toCamelCase", () => {
  it("converts kebab-case to camelCase", () => {
    expect(toCamelCase("fetch-user")).toBe("fetchUser");
    expect(toCamelCase("include-metadata")).toBe("includeMetadata");
    expect(toCamelCase("id")).toBe("id");
  });
});

describe("isOptional", () => {
  it("returns false for required fields", () => {
    expect(isOptional(z.string())).toBe(false);
    expect(isOptional(z.number())).toBe(false);
    expect(isOptional(z.boolean())).toBe(false);
  });

  it("returns true for optional fields", () => {
    expect(isOptional(z.string().optional())).toBe(true);
    expect(isOptional(z.number().optional())).toBe(true);
  });

  it("returns true for fields with defaults", () => {
    expect(isOptional(z.string().default("test"))).toBe(true);
    expect(isOptional(z.number().default(10))).toBe(true);
  });
});

describe("getDescription", () => {
  it("returns description from schema", () => {
    expect(getDescription(z.string().describe("A test string"))).toBe(
      "A test string",
    );
  });

  it("returns undefined when no description", () => {
    expect(getDescription(z.string())).toBeUndefined();
  });
});

describe("parseCliArgs", () => {
  describe("string arguments", () => {
    it("parses string flags", () => {
      const schema = z.object({
        id: z.string(),
      });
      const result = parseCliArgs(["--id", "usr_123"], schema);
      expect(result).toEqual({ success: true, data: { id: "usr_123" } });
    });

    it("parses kebab-case string flags", () => {
      const schema = z.object({
        userId: z.string(),
      });
      const result = parseCliArgs(["--user-id", "usr_123"], schema);
      expect(result).toEqual({ success: true, data: { userId: "usr_123" } });
    });
  });

  describe("number arguments", () => {
    it("parses number flags", () => {
      const schema = z.object({
        count: z.number(),
      });
      const result = parseCliArgs(["--count", "42"], schema);
      expect(result).toEqual({ success: true, data: { count: 42 } });
    });

    it("parses negative numbers", () => {
      const schema = z.object({
        offset: z.number(),
      });
      const result = parseCliArgs(["--offset", "-10"], schema);
      expect(result).toEqual({ success: true, data: { offset: -10 } });
    });

    it("parses floating point numbers", () => {
      const schema = z.object({
        ratio: z.number(),
      });
      const result = parseCliArgs(["--ratio", "3.14"], schema);
      expect(result).toEqual({ success: true, data: { ratio: 3.14 } });
    });

    it("returns error for invalid numbers", () => {
      const schema = z.object({
        count: z.number(),
      });
      const result = parseCliArgs(["--count", "not-a-number"], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid number");
      }
    });
  });

  describe("boolean arguments", () => {
    it("parses boolean flag as true", () => {
      const schema = z.object({
        verbose: z.boolean(),
      });
      const result = parseCliArgs(["--verbose"], schema);
      expect(result).toEqual({ success: true, data: { verbose: true } });
    });

    it("parses --no-flag as false", () => {
      const schema = z.object({
        verbose: z.boolean(),
      });
      const result = parseCliArgs(["--no-verbose"], schema);
      expect(result).toEqual({ success: true, data: { verbose: false } });
    });

    it("parses optional boolean with default", () => {
      const schema = z.object({
        verbose: z.boolean().default(false),
      });
      const result = parseCliArgs([], schema);
      expect(result).toEqual({ success: true, data: { verbose: false } });
    });
  });

  describe("array arguments", () => {
    it("parses array with single value", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });
      const result = parseCliArgs(["--tags", "important"], schema);
      expect(result).toEqual({ success: true, data: { tags: ["important"] } });
    });

    it("parses array with multiple values", () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });
      const result = parseCliArgs(
        ["--tags", "important", "--tags", "urgent"],
        schema,
      );
      expect(result).toEqual({
        success: true,
        data: { tags: ["important", "urgent"] },
      });
    });

    it("parses array of numbers", () => {
      const schema = z.object({
        ids: z.array(z.number()),
      });
      const result = parseCliArgs(
        ["--ids", "1", "--ids", "2", "--ids", "3"],
        schema,
      );
      expect(result).toEqual({ success: true, data: { ids: [1, 2, 3] } });
    });
  });

  describe("object arguments (JSON)", () => {
    it("parses JSON object", () => {
      const schema = z.object({
        config: z.object({ key: z.string() }),
      });
      const result = parseCliArgs(["--config", '{"key":"value"}'], schema);
      expect(result).toEqual({
        success: true,
        data: { config: { key: "value" } },
      });
    });

    it("returns error for invalid JSON", () => {
      const schema = z.object({
        config: z.object({ key: z.string() }),
      });
      const result = parseCliArgs(["--config", "not-json"], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid JSON");
      }
    });
  });

  describe("enum arguments", () => {
    it("parses valid enum value", () => {
      const schema = z.object({
        level: z.enum(["debug", "info", "error"]),
      });
      const result = parseCliArgs(["--level", "info"], schema);
      expect(result).toEqual({ success: true, data: { level: "info" } });
    });

    it("returns error for invalid enum value", () => {
      const schema = z.object({
        level: z.enum(["debug", "info", "error"]),
      });
      const result = parseCliArgs(["--level", "warning"], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid enum value");
      }
    });
  });

  describe("optional and default values", () => {
    it("uses default value when flag not provided", () => {
      const schema = z.object({
        limit: z.number().default(10),
      });
      const result = parseCliArgs([], schema);
      expect(result).toEqual({ success: true, data: { limit: 10 } });
    });

    it("allows optional fields to be omitted", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string().optional(),
      });
      const result = parseCliArgs(["--id", "123"], schema);
      expect(result).toEqual({ success: true, data: { id: "123" } });
    });
  });

  describe("error handling", () => {
    it("returns error for missing required field", () => {
      const schema = z.object({
        id: z.string(),
      });
      const result = parseCliArgs([], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Missing required flag: --id");
      }
    });

    it("returns error for unknown flag", () => {
      const schema = z.object({
        id: z.string(),
      });
      const result = parseCliArgs(["--unknown", "value"], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unknown flag: --unknown");
      }
    });

    it("returns error for missing flag value", () => {
      const schema = z.object({
        id: z.string(),
      });
      const result = parseCliArgs(["--id"], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Missing value for --id");
      }
    });

    it("returns error for argument without --", () => {
      const schema = z.object({
        id: z.string(),
      });
      const result = parseCliArgs(["id", "123"], schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Arguments must start with --");
      }
    });
  });

  describe("complex schemas", () => {
    it("parses mixed required and optional fields", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string().optional(),
        count: z.number().default(10),
        verbose: z.boolean().default(false),
      });

      const result = parseCliArgs(
        ["--id", "usr_1", "--name", "Alice", "--verbose"],
        schema,
      );
      expect(result).toEqual({
        success: true,
        data: { id: "usr_1", name: "Alice", count: 10, verbose: true },
      });
    });

    it("handles kebab-case to camelCase conversion", () => {
      const schema = z.object({
        userId: z.string(),
        includeMetadata: z.boolean().default(false),
        maxRetries: z.number().default(3),
      });

      const result = parseCliArgs(
        ["--user-id", "usr_1", "--include-metadata", "--max-retries", "5"],
        schema,
      );
      expect(result).toEqual({
        success: true,
        data: { userId: "usr_1", includeMetadata: true, maxRetries: 5 },
      });
    });
  });
});
