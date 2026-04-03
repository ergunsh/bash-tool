import type { z } from "zod";
import type { CodemodeTool, DefineCodemodeToolOptions } from "./types.js";

export function experimental_defineCodemodeTool<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
>(
  options: DefineCodemodeToolOptions<TInputSchema, TOutputSchema>,
): CodemodeTool<TInputSchema, TOutputSchema> {
  return options;
}
