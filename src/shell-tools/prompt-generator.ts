import type { z } from "zod";
import { isOptional, toKebabCase } from "./cli-parser.js";
import type { ShellToolDefinition } from "./types.js";

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
 * Generate LLM prompt section for shell tools.
 *
 * Shows usage signatures upfront so the agent can use tools immediately
 * without needing to call --help first. Emphasizes chaining to save round-trips.
 */
export function generateShellToolsPrompt(
  shellTools: Record<string, ShellToolDefinition>,
): string {
  const toolNames = Object.keys(shellTools);

  if (toolNames.length === 0) {
    return "";
  }

  const lines: string[] = ["SHELL TOOLS:"];

  for (const name of toolNames) {
    const kebabName = toKebabCase(name);
    const tool = shellTools[name];
    const usage = generateUsageSignature(kebabName, tool.inputSchema);
    lines.push(`  ${usage}`);
  }

  // Add multi-line script example to encourage scripting
  if (toolNames.length >= 2) {
    lines.push("");
    lines.push("CHAIN in ONE bash call:");
    lines.push("  result=$(cmd-a --id x)");
    lines.push("  field=$(echo \"$result\" | jq -r '.fieldName')");
    lines.push('  cmd-b --arg "$field"');
  }

  return lines.join("\n");
}
