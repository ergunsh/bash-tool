import type { z } from "zod";
import { getDescription, isOptional, toKebabCase } from "./cli-parser.js";

/**
 * Get the type label for a Zod schema (for CLI help display).
 */
function getTypeLabel(schema: z.ZodTypeAny): string {
  const typeName = getInnerTypeName(schema);

  switch (typeName) {
    case "ZodString":
      return "<string>";
    case "ZodNumber":
      return "<number>";
    case "ZodBoolean":
      return ""; // Boolean flags don't show a type label
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
 * Get the default value from a schema, if any.
 */
function getDefaultValue(schema: z.ZodTypeAny): unknown {
  if (schema._def.typeName === "ZodDefault") {
    return schema._def.defaultValue();
  }
  if (
    schema._def.typeName === "ZodOptional" ||
    schema._def.typeName === "ZodNullable"
  ) {
    return getDefaultValue(schema._def.innerType);
  }
  return undefined;
}

/**
 * Format a value for display in help text.
 */
function formatDefaultValue(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Generate a compact type signature for the output schema.
 */
function generateOutputSignature(schema: z.ZodTypeAny, indent = 2): string {
  const inner = getInnerType(schema);
  const typeName = inner._def.typeName;

  if (typeName === "ZodObject") {
    const shape = getShape(schema);
    if (!shape) return "object";

    const lines: string[] = ["{"];
    const entries = Object.entries(shape);

    for (const [key, fieldSchema] of entries) {
      const optional = isOptional(fieldSchema);
      const desc = getDescription(fieldSchema);
      const typeLabel = getOutputTypeLabel(fieldSchema);
      const optMarker = optional ? "?" : "";

      let line = `${" ".repeat(indent)}"${key}"${optMarker}: ${typeLabel}`;
      if (desc) {
        line += `,  // ${desc}`;
      } else {
        line += ",";
      }
      lines.push(line);
    }

    lines.push("}");
    return lines.join("\n");
  }

  if (typeName === "ZodArray") {
    const elementType = inner._def.type as z.ZodTypeAny;
    return `${getOutputTypeLabel(elementType)}[]`;
  }

  return getOutputTypeLabel(schema);
}

/**
 * Get the type label for output schema (TypeScript-like syntax).
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
    case "ZodEnum": {
      const values = inner._def.values as string[];
      return values.map((v) => `"${v}"`).join(" | ");
    }
    case "ZodArray": {
      const elementType = inner._def.type as z.ZodTypeAny;
      return `${getOutputTypeLabel(elementType)}[]`;
    }
    case "ZodObject":
      return "object";
    case "ZodNull":
      return "null";
    case "ZodUndefined":
      return "undefined";
    default:
      return "unknown";
  }
}

export interface HelpGeneratorOptions {
  /** Command name (kebab-case) */
  name: string;
  /** Command description */
  description: string;
  /** Input schema */
  inputSchema: z.ZodTypeAny;
  /** Output schema */
  outputSchema: z.ZodTypeAny;
}

/**
 * Generate a help page for a shell tool command.
 *
 * @example
 * ```
 * fetch-user - Fetches a user from the database
 *
 * USAGE:
 *   fetch-user --id <string> [--include-metadata]
 *
 * ARGUMENTS:
 *   --id <string>           The user UUID (required)
 *   --include-metadata      Include timestamps (optional)
 *
 * OUTPUT (JSON):
 *   {
 *     "name": string,        // Full display name
 *     "email": string,       // Primary email address
 *     "createdAt"?: string   // ISO timestamp
 *   }
 * ```
 */
export function generateHelp(options: HelpGeneratorOptions): string {
  const { name, description, inputSchema, outputSchema } = options;

  const shape = getShape(inputSchema);
  if (!shape) {
    return `${name} - ${description}\n\nError: Input schema must be a ZodObject`;
  }

  const lines: string[] = [];

  // Header
  lines.push(`${name} - ${description}`);
  lines.push("");

  // USAGE section
  const usageParts: string[] = [name];
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const kebabName = toKebabCase(fieldName);
    const typeLabel = getTypeLabel(fieldSchema);
    const optional = isOptional(fieldSchema);

    if (getInnerTypeName(fieldSchema) === "ZodBoolean") {
      // Boolean flags
      if (optional) {
        usageParts.push(`[--${kebabName}]`);
      } else {
        usageParts.push(`--${kebabName}`);
      }
    } else {
      // Value flags
      if (optional) {
        usageParts.push(`[--${kebabName} ${typeLabel}]`);
      } else {
        usageParts.push(`--${kebabName} ${typeLabel}`);
      }
    }
  }

  lines.push("USAGE:");
  lines.push(`  ${usageParts.join(" ")}`);
  lines.push("");

  // ARGUMENTS section
  lines.push("ARGUMENTS:");
  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const kebabName = toKebabCase(fieldName);
    const typeLabel = getTypeLabel(fieldSchema);
    const optional = isOptional(fieldSchema);
    const desc = getDescription(fieldSchema);
    const defaultValue = getDefaultValue(fieldSchema);

    let argLine = `  --${kebabName}`;
    if (typeLabel) {
      argLine += ` ${typeLabel}`;
    }

    // Pad to align descriptions
    const padding = Math.max(2, 30 - argLine.length);
    argLine += " ".repeat(padding);

    // Add description
    if (desc) {
      argLine += desc;
    }

    // Add required/optional marker
    if (optional) {
      if (defaultValue !== undefined) {
        argLine += ` (default: ${formatDefaultValue(defaultValue)})`;
      } else {
        argLine += " (optional)";
      }
    } else {
      argLine += " (required)";
    }

    lines.push(argLine);
  }
  lines.push("");

  // OUTPUT section
  lines.push("OUTPUT (JSON):");
  const outputSig = generateOutputSignature(outputSchema);
  for (const line of outputSig.split("\n")) {
    lines.push(`  ${line}`);
  }

  return lines.join("\n");
}
