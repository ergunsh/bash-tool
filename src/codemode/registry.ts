import type { AnyCodemodeTool, CodemodeOptions } from "./types.js";

export const CODEMODE_DIRECTORY = ".codemode";
export const CODEMODE_IMPORT_PATH = "./.codemode/index.ts";
export const CODEMODE_README_PATH = "./.codemode/README.md";
export const CODEMODE_COMMAND_NAME = "__codemode_call";

const IDENTIFIER_PATTERN = /^[$A-Z_a-z][$\w]*$/;
const RESERVED_NAMES = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "codemode",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export interface ValidatedCodemodeTool {
  name: string;
  description: string;
  tool: AnyCodemodeTool;
}

export function isCodemodeEnabled(
  codemode: CodemodeOptions | undefined,
): codemode is CodemodeOptions {
  return codemode !== undefined;
}

export function validateCodemodeTools(
  codemode: CodemodeOptions | undefined,
): ValidatedCodemodeTool[] {
  if (!codemode) {
    return [];
  }

  const entries = Object.entries(codemode.runtimeTools);

  if (entries.length === 0) {
    throw new Error("codemode.runtimeTools must contain at least one tool");
  }

  const seenNames = new Set<string>();

  return entries.map(([name, tool]) => {
    validateToolName(name);

    if (seenNames.has(name)) {
      throw new Error(`codemode tool name "${name}" is duplicated`);
    }

    seenNames.add(name);

    return {
      name,
      description: tool.description,
      tool,
    };
  });
}

export function validateToolName(name: string): void {
  if (!IDENTIFIER_PATTERN.test(name)) {
    throw new Error(
      `codemode tool name "${name}" is invalid: use a valid JavaScript identifier`,
    );
  }

  if (RESERVED_NAMES.has(name)) {
    throw new Error(
      `codemode tool name "${name}" is invalid: use a valid JavaScript identifier`,
    );
  }
}

export interface CodemodeTypeNames {
  base: string;
  input: string;
  output: string;
}

export function getCodemodeTypeNames(toolName: string): CodemodeTypeNames {
  const base = `${toolName.slice(0, 1).toUpperCase()}${toolName.slice(1)}`;

  return {
    base,
    input: `${base}Input`,
    output: `${base}Output`,
  };
}
