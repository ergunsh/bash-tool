import type { z } from "zod";
import { isOptional, toKebabCase } from "./cli-parser.js";
import { CLI_OUTPUT_DIR, type CliToolDefinition } from "./types.js";

/**
 * Get the inner type name, unwrapping optional/default wrappers.
 */
function getInnerTypeName(schema: z.ZodTypeAny): string {
  const typeName = schema._def.typeName;
  if (
    typeName === "ZodOptional" ||
    typeName === "ZodNullable" ||
    typeName === "ZodDefault"
  ) {
    return getInnerTypeName(schema._def.innerType);
  }
  return typeName;
}

/**
 * Get the inner type, unwrapping optional/default wrappers.
 */
function getInnerType(schema: z.ZodTypeAny): z.ZodTypeAny {
  const typeName = schema._def.typeName;
  if (
    typeName === "ZodOptional" ||
    typeName === "ZodNullable" ||
    typeName === "ZodDefault"
  ) {
    return getInnerType(schema._def.innerType);
  }
  return schema;
}

/**
 * Get the type label for a Zod schema (for CLI display).
 */
function getTypeLabel(schema: z.ZodTypeAny): string {
  const typeName = getInnerTypeName(schema);
  switch (typeName) {
    case "ZodString":
      return "<string>";
    case "ZodNumber":
      return "<number>";
    case "ZodBoolean":
      return "";
    case "ZodEnum": {
      const inner = getInnerType(schema);
      const values = inner._def.values as string[];
      return `<${values.join("|")}>`;
    }
    case "ZodArray":
      return "<value>...";
    default:
      return "<value>";
  }
}

/**
 * Get the shape from a ZodObject schema.
 */
function getShape(
  schema: z.ZodTypeAny,
): Record<string, z.ZodTypeAny> | undefined {
  const inner = getInnerType(schema);
  if (inner._def.typeName === "ZodObject") {
    return inner._def.shape();
  }
  return undefined;
}

/**
 * Generate usage signature for a tool (e.g., "fetch-user --id <string> [--verbose]")
 */
function generateUsageSignature(
  name: string,
  inputSchema: z.ZodTypeAny,
): string {
  const shape = getShape(inputSchema);
  if (!shape) return name;

  const parts: string[] = [name];
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const kebabName = toKebabCase(fieldName);
    const typeLabel = getTypeLabel(fieldSchema);
    const optional = isOptional(fieldSchema);
    const isBoolean = getInnerTypeName(fieldSchema) === "ZodBoolean";

    if (isBoolean) {
      parts.push(optional ? `[--${kebabName}]` : `--${kebabName}`);
    } else {
      parts.push(
        optional
          ? `[--${kebabName} ${typeLabel}]`
          : `--${kebabName} ${typeLabel}`,
      );
    }
  }
  return parts.join(" ");
}

/**
 * Generate LLM prompt section for CLI tools.
 *
 * Shows usage signatures upfront so the agent can use tools immediately
 * without needing to call --help first. Outputs are saved to files.
 */
export function generateCliToolsPrompt(
  cliTools: Record<string, CliToolDefinition>,
): string {
  const toolNames = Object.keys(cliTools);

  if (toolNames.length === 0) {
    return "";
  }

  const lines: string[] = ["CLI TOOLS (outputs saved to files):"];

  for (const name of toolNames) {
    const kebabName = toKebabCase(name);
    const tool = cliTools[name];
    const usage = generateUsageSignature(kebabName, tool.inputSchema);
    lines.push(`  ${usage}`);
  }

  lines.push("");
  lines.push(`Output files saved to: ${CLI_OUTPUT_DIR}/`);
  lines.push("Read output: cat <path> | jq '.field'");
  lines.push("Search: grep 'pattern' <path>");

  return lines.join("\n");
}
