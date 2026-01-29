import type { z } from "zod";

interface ParseResult<T> {
  success: true;
  data: T;
}

interface ParseError {
  success: false;
  error: string;
}

type ParseOutput<T> = ParseResult<T> | ParseError;

/**
 * Converts a camelCase name to kebab-case.
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Converts a kebab-case name to camelCase.
 */
export function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Get the inner type from a Zod schema, unwrapping optional/default wrappers.
 */
function getInnerType(schema: z.ZodTypeAny): z.ZodTypeAny {
  const typeName = schema._def.typeName;

  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    return getInnerType(schema._def.innerType);
  }
  if (typeName === "ZodDefault") {
    return getInnerType(schema._def.innerType);
  }

  return schema;
}

/**
 * Get the Zod type name for a schema.
 */
function getTypeName(schema: z.ZodTypeAny): string {
  return getInnerType(schema)._def.typeName;
}

/**
 * Check if a schema is optional (has .optional() or .default()).
 */
export function isOptional(schema: z.ZodTypeAny): boolean {
  const typeName = schema._def.typeName;
  return (
    typeName === "ZodOptional" ||
    typeName === "ZodDefault" ||
    (typeName === "ZodNullable" && isOptional(schema._def.innerType))
  );
}

/**
 * Get description from a Zod schema.
 */
export function getDescription(schema: z.ZodTypeAny): string | undefined {
  return schema._def.description ?? schema.description;
}

/**
 * Extract schema shape from a ZodObject.
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
 * Parse a string value to the expected type based on Zod schema.
 */
function parseValue(value: string, schema: z.ZodTypeAny): unknown {
  const typeName = getTypeName(schema);

  switch (typeName) {
    case "ZodString":
      return value;

    case "ZodNumber": {
      const num = Number(value);
      if (Number.isNaN(num)) {
        throw new Error(`Invalid number: ${value}`);
      }
      return num;
    }

    case "ZodBoolean":
      if (value === "true") return true;
      if (value === "false") return false;
      throw new Error(`Invalid boolean: ${value}`);

    case "ZodObject":
    case "ZodArray":
    case "ZodRecord":
      // Try parsing as JSON
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`Invalid JSON: ${value}`);
      }

    case "ZodEnum": {
      const enumValues = getInnerType(schema)._def.values as string[];
      if (!enumValues.includes(value)) {
        throw new Error(
          `Invalid enum value: ${value}. Expected one of: ${enumValues.join(", ")}`,
        );
      }
      return value;
    }

    case "ZodLiteral":
      return getInnerType(schema)._def.value;

    case "ZodUnion": {
      // Try each option in the union
      const options = getInnerType(schema)._def.options as z.ZodTypeAny[];
      for (const option of options) {
        try {
          return parseValue(value, option);
        } catch {
          // Try next option
        }
      }
      throw new Error(`Value doesn't match any union type: ${value}`);
    }

    default:
      // Default to string for unknown types
      return value;
  }
}

/**
 * Parse CLI arguments against a Zod object schema.
 *
 * Supports:
 * - `--flag <string>` for strings
 * - `--flag <number>` for numbers
 * - `--flag` / `--no-flag` for booleans
 * - `--flag <val> --flag <val>` for arrays
 * - `--flag <json>` for objects
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   id: z.string(),
 *   includeMetadata: z.boolean().optional(),
 *   count: z.number().default(10),
 * });
 *
 * const result = parseCliArgs(["--id", "usr_1", "--includeMetadata"], schema);
 * // { success: true, data: { id: "usr_1", includeMetadata: true, count: 10 } }
 * ```
 */
export function parseCliArgs<T>(
  args: string[],
  schema: z.ZodType<T>,
): ParseOutput<T> {
  const shape = getShape(schema as z.ZodTypeAny);

  if (!shape) {
    return {
      success: false,
      error: "Schema must be a ZodObject",
    };
  }

  const result: Record<string, unknown> = {};
  const arrayValues: Record<string, unknown[]> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (!arg.startsWith("--")) {
      return {
        success: false,
        error: `Unexpected argument: ${arg}. Arguments must start with --`,
      };
    }

    // Handle --no-flag for booleans
    if (arg.startsWith("--no-")) {
      const flagName = toCamelCase(arg.slice(5));
      const fieldSchema = shape[flagName];

      if (!fieldSchema) {
        return {
          success: false,
          error: `Unknown flag: ${arg}`,
        };
      }

      if (getTypeName(fieldSchema) !== "ZodBoolean") {
        return {
          success: false,
          error: `--no-${toKebabCase(flagName)} is only valid for boolean flags`,
        };
      }

      result[flagName] = false;
      i++;
      continue;
    }

    const flagName = toCamelCase(arg.slice(2));
    const fieldSchema = shape[flagName];

    if (!fieldSchema) {
      return {
        success: false,
        error: `Unknown flag: ${arg}`,
      };
    }

    const typeName = getTypeName(fieldSchema);

    // Boolean flags don't need a value
    if (typeName === "ZodBoolean") {
      result[flagName] = true;
      i++;
      continue;
    }

    // Other types need a value
    if (i + 1 >= args.length) {
      return {
        success: false,
        error: `Missing value for ${arg}`,
      };
    }

    const value = args[i + 1];

    // Handle arrays: collect multiple values
    if (typeName === "ZodArray") {
      if (!arrayValues[flagName]) {
        arrayValues[flagName] = [];
      }
      const innerSchema = getInnerType(fieldSchema)._def.type as z.ZodTypeAny;
      try {
        arrayValues[flagName].push(parseValue(value, innerSchema));
      } catch (e) {
        return {
          success: false,
          error: `Invalid value for ${arg}: ${(e as Error).message}`,
        };
      }
      i += 2;
      continue;
    }

    // Parse single value
    try {
      result[flagName] = parseValue(value, fieldSchema);
    } catch (e) {
      return {
        success: false,
        error: `Invalid value for ${arg}: ${(e as Error).message}`,
      };
    }

    i += 2;
  }

  // Add collected array values
  for (const [key, values] of Object.entries(arrayValues)) {
    result[key] = values;
  }

  // Validate with Zod schema to apply defaults and check required fields
  const validation = schema.safeParse(result);

  if (!validation.success) {
    const errors = validation.error.errors
      .map((e) => {
        const path = e.path.join(".");
        if (e.code === "invalid_type" && e.received === "undefined") {
          return `Missing required flag: --${toKebabCase(path)}`;
        }
        return `${path}: ${e.message}`;
      })
      .join("; ");
    return {
      success: false,
      error: errors,
    };
  }

  return {
    success: true,
    data: validation.data,
  };
}
