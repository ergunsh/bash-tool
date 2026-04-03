import type { z } from "zod";

export interface DefineCodemodeToolOptions<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
> {
  description: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  execute: (
    input: z.infer<TInputSchema>,
  ) => Promise<z.infer<TOutputSchema>> | z.infer<TOutputSchema>;
}

export interface CodemodeTool<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
> extends DefineCodemodeToolOptions<TInputSchema, TOutputSchema> {}

export interface AnyCodemodeTool {
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  execute(input: unknown): Promise<unknown> | unknown;
}

export interface CodemodeOptions {
  runtimeTools: Record<string, AnyCodemodeTool>;
}
