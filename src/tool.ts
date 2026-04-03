import path from "node:path";
import {
  createCodemodeCommand,
  createCodemodeProbeCommand,
} from "./codemode/bridge.js";
import { generateCodemodeFiles } from "./codemode/generated-files.js";
import { validateCodemodeTools } from "./codemode/registry.js";
import { getFilePaths, streamFiles } from "./files/loader.js";
import {
  createJustBashSandbox,
  isJustBash,
  wrapJustBash,
} from "./sandbox/just-bash.js";
import { isVercelSandbox, wrapVercelSandbox } from "./sandbox/vercel.js";
import { createBashExecuteTool } from "./tools/bash.js";
import { createReadFileTool } from "./tools/read-file.js";
import { createWriteFileTool } from "./tools/write-file.js";
import { createToolPrompt } from "./tools-prompt.js";
import type {
  BashToolkit,
  CommandResult,
  CreateBashToolOptions,
  Sandbox,
} from "./types.js";

const DEFAULT_DESTINATION = "/workspace";
const VERCEL_SANDBOX_DESTINATION = "/vercel/sandbox/workspace";
const WRITE_BATCH_SIZE = 20;
const DEFAULT_MAX_FILES = 1000;
const CODEMODE_PROBE_TIMEOUT_MS = 1500;

/**
 * Creates a bash tool with tools for AI agents.
 *
 * @example
 * ```typescript
 * // Simple usage with inline files
 * const { tools, sandbox } = await createBashTool({
 *   files: { "src/index.ts": "export const x = 1;" },
 * });
 *
 * // Upload a directory from disk
 * const { tools, sandbox } = await createBashTool({
 *   uploadDirectory: { source: "./my-project" },
 * });
 *
 * // Use with AI SDK
 * const result = await generateText({
 *   model,
 *   tools,
 *   prompt: "List all TypeScript files",
 * });
 *
 * // Cleanup
 * await sandbox.stop();
 * ```
 */
export async function createBashTool(
  options: CreateBashToolOptions = {},
): Promise<BashToolkit> {
  const codemodeTools = validateCodemodeTools(options.codemode);
  const codemodeEnabled = codemodeTools.length > 0;

  if (codemodeEnabled && options.sandbox) {
    throw new Error(
      "codemode is only supported on the default just-bash sandbox in v1",
    );
  }

  // Determine default destination based on sandbox type
  const defaultDestination =
    options.sandbox && isVercelSandbox(options.sandbox)
      ? VERCEL_SANDBOX_DESTINATION
      : DEFAULT_DESTINATION;
  const destination = options.destination ?? defaultDestination;
  const codemodeGenerated = codemodeEnabled
    ? await generateCodemodeFiles(codemodeTools)
    : undefined;
  const codemodeCommand = codemodeEnabled
    ? await createCodemodeCommand(codemodeTools)
    : undefined;

  // 3. Create or wrap sandbox
  let sandbox: Sandbox;
  let usingJustBash = false;
  let fileList: string[] = [];
  let workingDir = destination;
  const codemodePrompt = codemodeGenerated?.prompt;

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  let fileWrittenPromise: Promise<void> | undefined;

  if (options.sandbox) {
    // External sandbox provided - stream files and write in batches
    // Check @vercel/sandbox first (more specific check)
    if (isVercelSandbox(options.sandbox)) {
      sandbox = wrapVercelSandbox(options.sandbox);
    } else if (isJustBash(options.sandbox)) {
      sandbox = wrapJustBash(options.sandbox);
      usingJustBash = true;
    } else {
      sandbox = options.sandbox as Sandbox;
    }

    // Get file paths for tool prompt (without loading content)
    fileList = await getFilePaths({
      files: options.files,
      uploadDirectory: options.uploadDirectory,
    });

    // Check file limit
    if (maxFiles > 0 && fileList.length > maxFiles) {
      throw new Error(
        `Too many files to upload: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
          `Either increase maxFiles, use a more restrictive include pattern in uploadDirectory, ` +
          `or write files to the sandbox yourself before calling createBashTool.`,
      );
    }

    // Stream files and write in batches to avoid memory issues
    fileWrittenPromise = (async () => {
      let batch: Array<{ path: string; content: Buffer }> = [];

      for await (const file of streamFiles({
        files: options.files,
        uploadDirectory: options.uploadDirectory,
      })) {
        batch.push({
          path: path.posix.join(destination, file.path),
          content: file.content,
        });

        if (batch.length >= WRITE_BATCH_SIZE) {
          await sandbox.writeFiles(batch);
          batch = [];
        }
      }

      // Write remaining files
      if (batch.length > 0) {
        await sandbox.writeFiles(batch);
      }
    })();
  } else {
    // No external sandbox - use just-bash
    usingJustBash = true;

    if (options.uploadDirectory && !options.files) {
      // Use OverlayFs for uploadDirectory (avoids loading all files into memory)
      const overlayRoot = path.resolve(options.uploadDirectory.source);
      const result = await createJustBashSandbox({
        overlayRoot,
        javascript: codemodeEnabled,
        customCommands: codemodeCommand ? [codemodeCommand] : undefined,
      });
      sandbox = result;

      // Get file paths without loading content (for tool prompt)
      fileList = await getFilePaths({
        uploadDirectory: options.uploadDirectory,
      });

      // Check file limit (even for OverlayFs, we list files for the tool prompt)
      if (maxFiles > 0 && fileList.length > maxFiles) {
        throw new Error(
          `Too many files: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
            `Either increase maxFiles or use a more restrictive include pattern in uploadDirectory.`,
        );
      }

      if (codemodeGenerated) {
        fileList = [...fileList, ...codemodeGenerated.relativePaths];
        const codemodeRoot = result.mountPoint ?? destination;

        await sandbox.writeFiles(
          codemodeGenerated.files.map((file) => ({
            path: path.posix.join(codemodeRoot, file.relativePath),
            content: file.content,
          })),
        );
      }

      // Use the OverlayFs mount point as working directory
      if (result.mountPoint) {
        workingDir = result.mountPoint;
      }
    } else {
      // Load files into memory for in-memory filesystem
      // For just-bash we need all files upfront, but stream to avoid peak memory
      const filesWithDestination: Record<string, string> = {};

      for await (const file of streamFiles({
        files: options.files,
        uploadDirectory: options.uploadDirectory,
      })) {
        const absolutePath = path.posix.join(destination, file.path);
        filesWithDestination[absolutePath] = file.content.toString("utf-8");
      }

      fileList = await getFilePaths({
        files: options.files,
        uploadDirectory: options.uploadDirectory,
      });

      // Check file limit
      if (maxFiles > 0 && fileList.length > maxFiles) {
        throw new Error(
          `Too many files to load: ${fileList.length} files exceeds the limit of ${maxFiles}. ` +
            `Either increase maxFiles, use a more restrictive include pattern in uploadDirectory, ` +
            `or provide your own sandbox with files already written.`,
        );
      }

      if (codemodeGenerated) {
        fileList = [...fileList, ...codemodeGenerated.relativePaths];

        for (const file of codemodeGenerated.files) {
          const absolutePath = path.posix.join(destination, file.relativePath);
          filesWithDestination[absolutePath] = file.content;
        }
      }

      sandbox = await createJustBashSandbox({
        files: filesWithDestination,
        cwd: destination,
        javascript: codemodeEnabled,
        customCommands: codemodeCommand ? [codemodeCommand] : undefined,
      });
    }
  }

  // 4. Discover available tools and generate prompt
  const [toolPrompt] = await Promise.all([
    createToolPrompt({
      sandbox,
      filenames: fileList,
      isJustBash: usingJustBash,
      toolPrompt: options.promptOptions?.toolPrompt,
    }),
    fileWrittenPromise,
  ]);

  if (codemodeEnabled) {
    const probeCommand = createCodemodeProbeCommand(workingDir);
    const probeResult = await executeCommandWithTimeout(
      sandbox,
      probeCommand,
      CODEMODE_PROBE_TIMEOUT_MS,
    );

    if (probeResult.exitCode !== 0) {
      throw new Error(
        "codemode requires a sandbox that can run js-exec and import ./.codemode/index.ts",
      );
    }
  }

  // 5. Create tools
  const bash = createBashExecuteTool({
    sandbox,
    cwd: workingDir,
    files: fileList,
    toolPrompt,
    codemodePrompt,
    extraInstructions: options.extraInstructions,
    onBeforeBashCall: options.onBeforeBashCall,
    onAfterBashCall: options.onAfterBashCall,
    maxOutputLength: options.maxOutputLength,
  });

  const tools = {
    bash,
    readFile: createReadFileTool({ sandbox, cwd: workingDir }),
    writeFile: createWriteFileTool({ sandbox, cwd: workingDir }),
  };

  return { bash, tools, sandbox };
}

async function executeCommandWithTimeout(
  sandbox: Sandbox,
  command: string,
  timeoutMs: number,
): Promise<CommandResult> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<CommandResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({
        stdout: "",
        stderr: "",
        exitCode: 124,
      });
    }, timeoutMs);
  });

  const result = await Promise.race([
    sandbox.executeCommand(command),
    timeoutPromise,
  ]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  return result;
}
