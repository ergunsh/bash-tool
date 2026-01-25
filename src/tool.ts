import path from "node:path";
import { getFilePaths, streamFiles } from "./files/loader.js";
import {
  createJustBashSandbox,
  isJustBash,
  wrapJustBash,
} from "./sandbox/just-bash.js";
import { isVercelSandbox, wrapVercelSandbox } from "./sandbox/vercel.js";
import { generateShellToolsPrompt, toCommands } from "./shell-tools/index.js";
import { createBashExecuteTool } from "./tools/bash.js";
import { createReadFileTool } from "./tools/read-file.js";
import { createWriteFileTool } from "./tools/write-file.js";
import { createToolPrompt } from "./tools-prompt.js";
import type { BashToolkit, CreateBashToolOptions, Sandbox } from "./types.js";

const DEFAULT_DESTINATION = "/workspace";
const VERCEL_SANDBOX_DESTINATION = "/vercel/sandbox/workspace";
const WRITE_BATCH_SIZE = 20;
const DEFAULT_MAX_FILES = 1000;

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
  // Determine default destination based on sandbox type
  const defaultDestination =
    options.sandbox && isVercelSandbox(options.sandbox)
      ? VERCEL_SANDBOX_DESTINATION
      : DEFAULT_DESTINATION;
  const destination = options.destination ?? defaultDestination;

  // Convert shell tools to just-bash commands
  const customCommands = options.shellTools
    ? toCommands(options.shellTools)
    : undefined;

  // 3. Create or wrap sandbox
  let sandbox: Sandbox;
  let usingJustBash = false;
  let fileList: string[] = [];
  let workingDir = destination;

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  let fileWrittenPromise: Promise<void> | undefined;

  if (options.sandbox) {
    // Shell tools require just-bash - check if external sandbox is compatible
    if (options.shellTools) {
      if (isVercelSandbox(options.sandbox)) {
        throw new Error(
          "Shell tools are only supported with just-bash sandbox. " +
            "When using @vercel/sandbox, remove the shellTools option or use just-bash instead.",
        );
      }
      if (!isJustBash(options.sandbox)) {
        throw new Error(
          "Shell tools are only supported with just-bash sandbox. " +
            "Provide a just-bash Bash instance or remove the shellTools option.",
        );
      }
    }
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
        customCommands,
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

      sandbox = await createJustBashSandbox({
        files: filesWithDestination,
        cwd: destination,
        customCommands,
      });
    }
  }

  // 4. Discover available tools and generate prompt
  const [toolPrompt, _] = await Promise.all([
    createToolPrompt({
      sandbox,
      filenames: fileList,
      isJustBash: usingJustBash,
      toolPrompt: options.promptOptions?.toolPrompt,
    }),
    fileWrittenPromise,
  ]);

  // 5. Generate shell tools prompt if shell tools are provided
  const shellToolsPrompt = options.shellTools
    ? generateShellToolsPrompt(options.shellTools)
    : "";

  // Combine tool prompts
  const combinedPrompt = shellToolsPrompt
    ? `${toolPrompt}\n\n${shellToolsPrompt}`
    : toolPrompt;

  // 6. Create tools
  const bash = createBashExecuteTool({
    sandbox,
    cwd: workingDir,
    files: fileList,
    toolPrompt: combinedPrompt,
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
