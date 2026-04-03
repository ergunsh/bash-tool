import { createHash } from "node:crypto";
import { compile, type JSONSchema } from "json-schema-to-typescript";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CODEMODE_COMMAND_NAME,
  CODEMODE_DIRECTORY,
  CODEMODE_IMPORT_PATH,
  CODEMODE_README_PATH,
  getCodemodeTypeNames,
  type ValidatedCodemodeTool,
} from "./registry.js";

export interface CodemodeFile {
  relativePath: string;
  content: string;
}

export interface GeneratedCodemodeFiles {
  files: CodemodeFile[];
  prompt: string;
  relativePaths: string[];
}

export async function generateCodemodeFiles(
  tools: ValidatedCodemodeTool[],
): Promise<GeneratedCodemodeFiles> {
  const indexContent = await renderIndexFile(tools);
  const readmeContent = renderReadmeFile(tools);
  const manifestContent = renderManifestFile(
    tools,
    indexContent,
    readmeContent,
  );

  const relativePaths = [
    `${CODEMODE_DIRECTORY}/index.ts`,
    `${CODEMODE_DIRECTORY}/README.md`,
    `${CODEMODE_DIRECTORY}/manifest.json`,
  ];

  const files = [
    {
      relativePath: `${CODEMODE_DIRECTORY}/index.ts`,
      content: indexContent,
    },
    {
      relativePath: `${CODEMODE_DIRECTORY}/README.md`,
      content: readmeContent,
    },
    {
      relativePath: `${CODEMODE_DIRECTORY}/manifest.json`,
      content: manifestContent,
    },
  ];

  return {
    files,
    prompt: renderPromptBlock(tools),
    relativePaths,
  };
}

async function renderIndexFile(
  tools: ValidatedCodemodeTool[],
): Promise<string> {
  const typeBlocks: string[] = [];

  for (const tool of tools) {
    const typeNames = getCodemodeTypeNames(tool.name);

    typeBlocks.push(
      await compileSchema(tool.tool.inputSchema, typeNames.input),
    );
    typeBlocks.push(
      await compileSchema(tool.tool.outputSchema, typeNames.output),
    );
  }

  const lines: string[] = [
    'import { execSync } from "child_process";',
    "",
    ...joinBlocks(typeBlocks),
    "type CodemodeHostCall = (",
    "  toolName: string,",
    "  inputJson: string,",
    ") => Promise<string>;",
    "",
    "function getErrorMessage(error: unknown): string {",
    '  if (error && typeof error === "object") {',
    '    const stderr = "stderr" in error ? error.stderr : undefined;',
    '    if (typeof stderr === "string" && stderr.trim().length > 0) {',
    "      return stderr.trim();",
    "    }",
    "",
    '    const stdout = "stdout" in error ? error.stdout : undefined;',
    '    if (typeof stdout === "string" && stdout.trim().length > 0) {',
    "      return stdout.trim();",
    "    }",
    "",
    '    const message = "message" in error ? error.message : undefined;',
    '    if (typeof message === "string" && message.trim().length > 0) {',
    "      return message.trim();",
    "    }",
    "  }",
    "",
    "  return String(error);",
    "}",
    "",
    "async function callTool<TOutput>(",
    "  toolName: string,",
    "  input: unknown,",
    "): Promise<TOutput> {",
    "  const inputJson = JSON.stringify(input);",
    "  const hostCall = (globalThis as typeof globalThis & {",
    "    __CODEMODE_CALL__?: CodemodeHostCall;",
    "  }).__CODEMODE_CALL__;",
    "",
    "  try {",
    "    const text =",
    '      typeof hostCall === "function"',
    "        ? (await hostCall(toolName, inputJson)).trim()",
    `        : execSync(\`${CODEMODE_COMMAND_NAME} \${toolName}\`, {`,
    "            stdin: inputJson,",
    "          }).trim();",
    "",
    "    if (text.length === 0) {",
    `      throw new Error(\`codemode.\${toolName} failed: tool returned no JSON output\`);`,
    "    }",
    "",
    "    return JSON.parse(text) as TOutput;",
    "  } catch (error) {",
    "    throw new Error(getErrorMessage(error));",
    "  }",
    "}",
  ];

  for (const tool of tools) {
    const typeNames = getCodemodeTypeNames(tool.name);

    lines.push("");
    lines.push(
      `export async function ${tool.name}(input: ${typeNames.input}): Promise<${typeNames.output}> {`,
    );
    lines.push(
      `  return await callTool<${typeNames.output}>("${tool.name}", input);`,
    );
    lines.push("}");
  }

  return `${lines.join("\n")}\n`;
}

async function compileSchema(
  schema: ValidatedCodemodeTool["tool"]["inputSchema"],
  name: string,
): Promise<string> {
  const jsonSchema = zodToJsonSchema(schema, name);
  const source = await compile(jsonSchema as JSONSchema, name, {
    bannerComment: "",
  });

  return source.trim();
}

function renderReadmeFile(tools: ValidatedCodemodeTool[]): string {
  const exampleTool = tools[0];
  const exampleTypeNames = getCodemodeTypeNames(exampleTool.name);
  const lines = [
    "# Codemode SDK",
    "",
    "Import helpers from `./.codemode/index.ts` inside `js-exec`.",
    "",
    "```ts",
    `import { ${exampleTool.name} } from "${CODEMODE_IMPORT_PATH}";`,
    "",
    `const result = await ${exampleTool.name}({`,
    `  // ${exampleTypeNames.input}`,
    "});",
    "",
    "console.log(result);",
    "```",
    "",
    "Available helpers:",
  ];

  for (const tool of tools) {
    lines.push(`- \`${tool.name}\`: ${tool.description}`);
  }

  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderManifestFile(
  tools: ValidatedCodemodeTool[],
  indexContent: string,
  readmeContent: string,
): string {
  const hash = createHash("sha256")
    .update(indexContent)
    .update(readmeContent)
    .digest("hex");

  return `${JSON.stringify(
    {
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      sdkHash: hash,
      tools: tools.map((tool) => tool.name),
    },
    null,
    2,
  )}\n`;
}

function renderPromptBlock(tools: ValidatedCodemodeTool[]): string {
  const lines = [
    "CODEMODE:",
    "You can write TypeScript or JavaScript and run it with js-exec.",
    `Typed runtime helpers live at ${CODEMODE_IMPORT_PATH}.`,
    "Import from that path inside the sandbox.",
    "Available helpers:",
  ];

  for (const tool of tools) {
    const typeNames = getCodemodeTypeNames(tool.name);
    lines.push(`  - ${tool.name}(input) -> Promise<${typeNames.output}>`);
  }

  lines.push(`Read ${CODEMODE_README_PATH} for examples.`);

  return lines.join("\n");
}

function joinBlocks(blocks: string[]): string[] {
  const lines: string[] = [];

  blocks.forEach((block, index) => {
    lines.push(block);

    if (index < blocks.length - 1) {
      lines.push("");
    }
  });

  return lines;
}
