import type { z } from "zod";
import { isOptional, toKebabCase } from "./cli-parser.js";
import type { ShellToolDefinition } from "./types.js";

/**
 * Get the type label for a Zod schema (for prompt display).
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
      const values = getEnumValues(schema);
      return `<${values.join("|")}>`;
    }
    case "ZodArray":
      return "<value>...";
    case "ZodObject":
    case "ZodRecord":
      return "<json>";
    default:
      return "<value>";
  }
}

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
 * Get enum values from a ZodEnum schema.
 */
function getEnumValues(schema: z.ZodTypeAny): string[] {
  const inner = getInnerType(schema);
  if (inner._def.typeName === "ZodEnum") {
    return inner._def.values as string[];
  }
  return [];
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
 * Get a compact output type description for the prompt.
 * Shows nested structure for arrays of objects and enum values to help with jq queries.
 */
function getOutputDescription(schema: z.ZodTypeAny, depth = 0): string {
  const inner = getInnerType(schema);
  const typeName = inner._def.typeName;

  if (typeName === "ZodObject") {
    const shape = getShape(schema);
    if (!shape) return "object";

    const fields = Object.entries(shape).map(([key, fieldSchema]) => {
      const optional = isOptional(fieldSchema);
      const fieldInner = getInnerType(fieldSchema);
      const fieldTypeName = fieldInner._def.typeName;

      // For nested objects at shallow depth, show their fields
      if (fieldTypeName === "ZodObject" && depth < 2) {
        const nestedDesc = getOutputDescription(fieldSchema, depth + 1);
        return optional ? `${key}?:${nestedDesc}` : `${key}:${nestedDesc}`;
      }

      // For arrays of objects, show element structure
      if (fieldTypeName === "ZodArray" && depth < 2) {
        const elementType = fieldInner._def.type as z.ZodTypeAny;
        const elementInner = getInnerType(elementType);
        if (elementInner._def.typeName === "ZodObject") {
          const elementDesc = getOutputDescription(elementType, depth + 1);
          return optional ? `${key}?[]${elementDesc}` : `${key}[]${elementDesc}`;
        }
      }

      // For enums, show the values
      if (fieldTypeName === "ZodEnum") {
        const values = getEnumValues(fieldSchema);
        const enumStr = values.join("|");
        return optional ? `${key}?:<${enumStr}>` : `${key}:<${enumStr}>`;
      }

      return optional ? `${key}?` : key;
    });

    return `{${fields.join(", ")}}`;
  }

  if (typeName === "ZodArray") {
    const elementType = inner._def.type as z.ZodTypeAny;
    const elementInner = getInnerType(elementType);
    if (elementInner._def.typeName === "ZodObject" && depth < 2) {
      return `${getOutputDescription(elementType, depth + 1)}[]`;
    }
    return `${getOutputTypeLabel(elementType)}[]`;
  }

  return getOutputTypeLabel(schema);
}

/**
 * Get the type label for output schema.
 */
function getOutputTypeLabel(schema: z.ZodTypeAny): string {
  const inner = getInnerType(schema);
  const typeName = inner._def.typeName;

  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodObject":
      return "object";
    default:
      return "unknown";
  }
}

/**
 * Generate a single line description for a shell tool.
 */
function generateToolLine(
  name: string,
  definition: ShellToolDefinition,
): string {
  const kebabName = toKebabCase(name);
  const { description, inputSchema, outputSchema } = definition;

  const shape = getShape(inputSchema);
  if (!shape) {
    return `${kebabName} - ${description}`;
  }

  // Build usage signature
  const usageParts: string[] = [kebabName];
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const kebabField = toKebabCase(fieldName);
    const typeLabel = getTypeLabel(fieldSchema);
    const optional = isOptional(fieldSchema);

    if (getInnerTypeName(fieldSchema) === "ZodBoolean") {
      if (optional) {
        usageParts.push(`[--${kebabField}]`);
      } else {
        usageParts.push(`--${kebabField}`);
      }
    } else {
      if (optional) {
        usageParts.push(`[--${kebabField} ${typeLabel}]`);
      } else {
        usageParts.push(`--${kebabField} ${typeLabel}`);
      }
    }
  }

  const usageLine = usageParts.join(" ");
  const outputDesc = getOutputDescription(outputSchema);

  return `${usageLine}\n  ${description}\n  Output: JSON ${outputDesc}`;
}

/**
 * Generate LLM prompt section for shell tools.
 *
 * @example
 * ```
 * CUSTOM SHELL TOOLS:
 *
 * fetch-user --id <string> [--include-metadata]
 *   Fetches a user from the database.
 *   Output: JSON { name, email, createdAt? }
 *
 * Run any tool with --help for detailed documentation.
 * ```
 */
export function generateShellToolsPrompt(
  shellTools: Record<string, ShellToolDefinition>,
): string {
  const toolNames = Object.keys(shellTools);

  if (toolNames.length === 0) {
    return "";
  }

  const lines: string[] = ["CUSTOM SHELL TOOLS:", ""];

  for (const name of toolNames) {
    const definition = shellTools[name];
    lines.push(generateToolLine(name, definition));
    lines.push("");
  }

  lines.push("Run any tool with --help for detailed documentation.");
  lines.push("");
  lines.push("EFFICIENCY: Combine operations in ONE bash call to minimize round-trips:");
  lines.push("  Pipe: tool | jq '[.items[] | select(.field == \"x\") | .val] | add'");
  lines.push("  Chain: a=$(tool-a); tool-b --id $(echo \"$a\" | jq -r '.ref')");
  lines.push("  Batch: for id in x y z; do tool --id $id; done | jq -s '[.[].val] | add'");

  return lines.join("\n");
}
