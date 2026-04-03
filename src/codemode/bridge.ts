import type { ZodError, ZodIssue } from "zod";
import {
  CODEMODE_COMMAND_NAME,
  CODEMODE_IMPORT_PATH,
  type ValidatedCodemodeTool,
} from "./registry.js";

export async function createCodemodeCommand(
  tools: ValidatedCodemodeTool[],
): Promise<import("just-bash").CustomCommand> {
  const { defineCommand } = await import("just-bash");
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

  return defineCommand(CODEMODE_COMMAND_NAME, async (args, ctx) => {
    const toolName = args[0];

    if (!toolName) {
      return fail("codemode failed: missing tool name");
    }

    const entry = toolMap.get(toolName);

    if (!entry) {
      return fail(`codemode.${toolName} failed: tool is not registered`);
    }

    let parsedInput: unknown;

    try {
      parsedInput = JSON.parse(ctx.stdin || "null");
    } catch {
      return fail(`codemode.${toolName} failed: input must be valid JSON`);
    }

    const inputResult = entry.tool.inputSchema.safeParse(parsedInput);

    if (!inputResult.success) {
      return fail(
        `codemode.${toolName} input validation failed: ${formatZodError(
          "input",
          inputResult.error,
        )}`,
      );
    }

    try {
      const output = await entry.tool.execute(inputResult.data);
      const outputResult = entry.tool.outputSchema.safeParse(output);

      if (!outputResult.success) {
        return fail(
          `codemode.${toolName} output validation failed: ${formatZodError(
            "result",
            outputResult.error,
          )}`,
        );
      }

      return {
        stdout: JSON.stringify(outputResult.data),
        stderr: "",
        exitCode: 0,
      };
    } catch (error) {
      return fail(`codemode.${toolName} failed: ${getErrorMessage(error)}`);
    }
  });
}

export function createCodemodeProbeCommand(cwd: string): string {
  return `cd "${cwd}" && js-exec ${CODEMODE_IMPORT_PATH}`;
}

function fail(message: string) {
  return {
    stdout: "",
    stderr: message,
    exitCode: 1,
  };
}

function formatZodError(label: string, error: ZodError): string {
  return error.issues.map((issue) => formatIssue(label, issue)).join("; ");
}

function formatIssue(label: string, issue: ZodIssue): string {
  const path = formatPath(issue.path);
  const location =
    path.length > 0
      ? `${label}${path.startsWith("[") ? "" : "."}${path}`
      : label;
  return `${location} ${issue.message}`;
}

function formatPath(path: Array<string | number>): string {
  let result = "";

  for (const part of path) {
    if (typeof part === "number") {
      result += `[${part}]`;
      continue;
    }

    if (result.length > 0) {
      result += ".";
    }

    result += part;
  }

  return result;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
