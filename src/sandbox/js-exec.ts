import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";
import { CODEMODE_COMMAND_NAME } from "../codemode/registry.js";

const JS_EXEC_HELP = `js-exec - JavaScript/TypeScript runtime for sandbox scripts

Usage: js-exec [OPTIONS] [-c CODE | FILE] [ARGS...]

Options:
  -c CODE          Execute inline code
  -m, --module     Accepted for compatibility
  --strip-types    Accepted for compatibility
  --version, -V    Show version
  --help           Show this help
`;

const SUPPORTED_TYPESCRIPT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

const MIRRORED_SYSTEM_PREFIXES = [
  "/bin/",
  "/dev/",
  "/proc/",
  "/tmp/",
  "/usr/bin/",
];

type JsExecCommand = import("just-bash").Command;
type JsExecContext = import("just-bash").CommandContext;

interface ParsedJsExecInput {
  code: string;
  scriptArgs: string[];
  scriptPath: string;
}

interface PreparedExecution {
  cleanup: () => Promise<void>;
  entryRuntimePath: string;
  runtimeRoot: string;
  workingDirectory: string;
  workspaceRoot: string;
}

interface OutputCapture {
  restore: () => void;
  stderr: string[];
  stdout: string[];
}

export async function createJavascriptCommands(
  javascript: boolean | { bootstrap?: string } | undefined,
): Promise<JsExecCommand[]> {
  const { defineCommand } = await import("just-bash");
  const bootstrap =
    typeof javascript === "object" ? javascript.bootstrap : undefined;

  return [
    defineCommand("js-exec", async (args, ctx) =>
      executeJsExecCommand(args, ctx, bootstrap),
    ),
    defineCommand("node", async () => ({
      stdout: "",
      stderr: `node: this sandbox uses js-exec instead of node

${JS_EXEC_HELP}`,
      exitCode: 1,
    })),
  ];
}

async function executeJsExecCommand(
  args: string[],
  ctx: JsExecContext,
  bootstrap: string | undefined,
): Promise<import("just-bash").ExecResult> {
  if (hasHelpFlag(args)) {
    return {
      stdout: JS_EXEC_HELP,
      stderr: "",
      exitCode: 0,
    };
  }

  if (hasVersionFlag(args)) {
    return {
      stdout: "Node.js + TypeScript transpile\n",
      stderr: "",
      exitCode: 0,
    };
  }

  const parsed = await parseJsExecInput(args, ctx);

  if ("exitCode" in parsed) {
    return parsed;
  }

  const prepared = await prepareExecutionWorkspace(ctx, parsed);
  const capture = startOutputCapture();
  const restoreEnvironment = applyProcessEnvironment(
    ctx,
    prepared.workingDirectory,
    prepared.entryRuntimePath,
    parsed.scriptArgs,
  );

  let exitCode = 0;

  try {
    const hostCall = createCodemodeHostCall(ctx);
    const previousHostCall = setHostCodemodeCall(hostCall);

    try {
      if (bootstrap) {
        const bootstrapPath = await writeBootstrapModule(
          prepared.runtimeRoot,
          bootstrap,
        );
        await importRuntimeModule(bootstrapPath);
      }

      await importRuntimeModule(prepared.entryRuntimePath);
    } finally {
      setHostCodemodeCall(previousHostCall);
    }
  } catch (error) {
    exitCode = error instanceof ProcessExitError ? error.exitCode : 1;
    const message = formatExecutionError(error);

    if (message.length > 0) {
      capture.stderr.push(`${message}\n`);
    }
  } finally {
    capture.restore();
    restoreEnvironment();

    try {
      await syncWorkspaceChangesBack(ctx, prepared.workspaceRoot);
    } finally {
      await prepared.cleanup();
    }
  }

  return {
    stdout: capture.stdout.join(""),
    stderr: capture.stderr.join(""),
    exitCode,
  };
}

function hasHelpFlag(args: string[]): boolean {
  return args.includes("--help");
}

function hasVersionFlag(args: string[]): boolean {
  return args.includes("--version") || args.includes("-V");
}

async function parseJsExecInput(
  args: string[],
  ctx: JsExecContext,
): Promise<ParsedJsExecInput | import("just-bash").ExecResult> {
  let code: string | undefined;
  let scriptFile: string | undefined;
  let scriptArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "-m" || arg === "--module" || arg === "--strip-types") {
      continue;
    }

    if (arg === "-c") {
      const inlineCode = args[index + 1];

      if (inlineCode === undefined) {
        return {
          stdout: "",
          stderr: "js-exec: option requires an argument -- 'c'\n",
          exitCode: 2,
        };
      }

      code = inlineCode;
      scriptArgs = args.slice(index + 2);
      break;
    }

    if (arg === "--") {
      scriptFile = args[index + 1];
      scriptArgs = args.slice(index + 2);
      break;
    }

    if (arg.startsWith("-")) {
      return {
        stdout: "",
        stderr: `js-exec: unrecognized option '${arg}'\n`,
        exitCode: 2,
      };
    }

    scriptFile = arg;
    scriptArgs = args.slice(index + 1);
    break;
  }

  if (code !== undefined) {
    return {
      code,
      scriptArgs,
      scriptPath: path.posix.join(ctx.cwd, "__js_exec_inline__.ts"),
    };
  }

  if (scriptFile) {
    const resolvedPath = ctx.fs.resolvePath(ctx.cwd, scriptFile);

    if (!(await ctx.fs.exists(resolvedPath))) {
      return {
        stdout: "",
        stderr: `js-exec: can't open file '${scriptFile}': No such file or directory\n`,
        exitCode: 2,
      };
    }

    try {
      return {
        code: await ctx.fs.readFile(resolvedPath),
        scriptArgs,
        scriptPath: resolvedPath,
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: `js-exec: can't open file '${scriptFile}': ${formatExecutionError(error)}\n`,
        exitCode: 2,
      };
    }
  }

  if (ctx.stdin.trim().length > 0) {
    return {
      code: ctx.stdin,
      scriptArgs,
      scriptPath: path.posix.join(ctx.cwd, "__js_exec_stdin__.ts"),
    };
  }

  return {
    stdout: "",
    stderr:
      "js-exec: no input provided (use -c CODE or provide a script file)\n",
    exitCode: 2,
  };
}

async function prepareExecutionWorkspace(
  ctx: JsExecContext,
  parsed: ParsedJsExecInput,
): Promise<PreparedExecution> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bash-tool-js-exec-"));
  const workspaceRoot = path.join(tempRoot, "workspace");
  const runtimeRoot = path.join(tempRoot, ".js-exec-runtime");
  const runtimeEntryPath = path.join(
    runtimeRoot,
    trimLeadingSlash(toRuntimeVirtualPath(parsed.scriptPath)),
  );
  const workingDirectory = path.join(
    workspaceRoot,
    trimLeadingSlash(ctx.cwd),
  );

  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(runtimeRoot, { recursive: true });
  await fs.writeFile(
    path.join(runtimeRoot, "package.json"),
    '{ "type": "module" }\n',
    "utf8",
  );

  await mirrorVirtualWorkspace(ctx, workspaceRoot);
  await ensureFileExists(workspaceRoot, parsed.scriptPath, parsed.code);
  await linkNodeModules(tempRoot);
  await buildRuntimeGraph(ctx, workspaceRoot, runtimeRoot, parsed.scriptPath);

  return {
    cleanup: async () => {
      await fs.rm(tempRoot, { recursive: true, force: true });
    },
    entryRuntimePath: runtimeEntryPath,
    runtimeRoot,
    workingDirectory,
    workspaceRoot,
  };
}

async function mirrorVirtualWorkspace(
  ctx: JsExecContext,
  workspaceRoot: string,
): Promise<void> {
  for (const virtualPath of ctx.fs.getAllPaths()) {
    if (shouldSkipMirroredPath(virtualPath)) {
      continue;
    }

    const stat = await safeStat(ctx, virtualPath);

    if (!stat?.isFile) {
      continue;
    }

    const fileContents = await ctx.fs.readFile(virtualPath);
    const targetPath = path.join(workspaceRoot, trimLeadingSlash(virtualPath));

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, fileContents, "utf8");
  }
}

function shouldSkipMirroredPath(virtualPath: string): boolean {
  if (virtualPath === "/" || virtualPath.length === 0) {
    return true;
  }

  return MIRRORED_SYSTEM_PREFIXES.some((prefix) => virtualPath.startsWith(prefix));
}

async function safeStat(
  ctx: JsExecContext,
  virtualPath: string,
): Promise<Awaited<ReturnType<JsExecContext["fs"]["stat"]>> | undefined> {
  try {
    return await ctx.fs.stat(virtualPath);
  } catch {
    return undefined;
  }
}

async function ensureFileExists(
  workspaceRoot: string,
  virtualPath: string,
  contents: string,
): Promise<void> {
  const targetPath = path.join(workspaceRoot, trimLeadingSlash(virtualPath));

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, contents, "utf8");
}

async function linkNodeModules(tempRoot: string): Promise<void> {
  const source = path.join(process.cwd(), "node_modules");
  const target = path.join(tempRoot, "node_modules");

  try {
    await fs.access(source);
  } catch {
    return;
  }

  try {
    await fs.symlink(source, target, "junction");
  } catch {
    // Ignore if the platform doesn't allow symlinks or the link already exists.
  }
}

async function buildRuntimeGraph(
  ctx: JsExecContext,
  workspaceRoot: string,
  runtimeRoot: string,
  entryVirtualPath: string,
): Promise<void> {
  const pending = [entryVirtualPath];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const virtualPath = pending.pop();

    if (!virtualPath || visited.has(virtualPath)) {
      continue;
    }

    visited.add(virtualPath);

    const sourcePath = path.join(workspaceRoot, trimLeadingSlash(virtualPath));
    const sourceCode = await fs.readFile(sourcePath, "utf8");
    const runtimeVirtualPath = toRuntimeVirtualPath(virtualPath);
    const runtimeFilePath = path.join(
      runtimeRoot,
      trimLeadingSlash(runtimeVirtualPath),
    );

    const transformed = await transformModule(
      ctx,
      sourceCode,
      virtualPath,
      runtimeVirtualPath,
    );

    await fs.mkdir(path.dirname(runtimeFilePath), { recursive: true });
    await fs.writeFile(runtimeFilePath, transformed.code, "utf8");

    for (const dependency of transformed.dependencies) {
      if (!visited.has(dependency)) {
        pending.push(dependency);
      }
    }
  }
}

async function transformModule(
  ctx: JsExecContext,
  sourceCode: string,
  virtualPath: string,
  runtimeVirtualPath: string,
): Promise<{ code: string; dependencies: string[] }> {
  const compiled = transpileSource(sourceCode, virtualPath);
  const dependencies = new Set<string>();

  const rewritten = await rewriteImportSpecifiers(
    compiled,
    ctx,
    virtualPath,
    runtimeVirtualPath,
    dependencies,
  );

  return {
    code: rewritten,
    dependencies: [...dependencies],
  };
}

function transpileSource(sourceCode: string, virtualPath: string): string {
  const extension = path.posix.extname(virtualPath);

  if (!SUPPORTED_TYPESCRIPT_EXTENSIONS.has(extension)) {
    return sourceCode;
  }

  return ts.transpileModule(sourceCode, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: virtualPath,
  }).outputText;
}

async function rewriteImportSpecifiers(
  sourceCode: string,
  ctx: JsExecContext,
  importerVirtualPath: string,
  importerRuntimeVirtualPath: string,
  dependencies: Set<string>,
): Promise<string> {
  const matches = [...sourceCode.matchAll(IMPORT_SPECIFIER_PATTERN)];

  if (matches.length === 0) {
    return sourceCode;
  }

  let rewritten = sourceCode;

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const specifier = match[1] ?? match[2];

    if (!specifier) {
      continue;
    }

    const resolved = await resolveLocalModule(ctx, importerVirtualPath, specifier);

    if (!resolved) {
      continue;
    }

    dependencies.add(resolved.virtualPath);

    const replacement = createRuntimeSpecifier(
      importerRuntimeVirtualPath,
      toRuntimeVirtualPath(resolved.virtualPath),
    );

    const start = match.index ?? 0;
    const end = start + match[0].length;
    const updatedMatch = match[0].replace(specifier, replacement);

    rewritten = `${rewritten.slice(0, start)}${updatedMatch}${rewritten.slice(end)}`;
  }

  return rewritten;
}

const IMPORT_SPECIFIER_PATTERN =
  /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"'`]+)["']|import\s*\(\s*["']([^"'`]+)["']\s*\)/g;

async function resolveLocalModule(
  ctx: JsExecContext,
  importerVirtualPath: string,
  rawSpecifier: string,
): Promise<{ virtualPath: string } | undefined> {
  const specifier = rawSpecifier.trim();

  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return undefined;
  }

  const basePath = specifier.startsWith("/")
    ? path.posix.normalize(specifier)
    : path.posix.resolve(path.posix.dirname(importerVirtualPath), specifier);

  for (const candidate of createModuleCandidates(basePath)) {
    if (await ctx.fs.exists(candidate)) {
      return { virtualPath: candidate };
    }
  }

  return undefined;
}

function createModuleCandidates(basePath: string): string[] {
  const candidates = [basePath];

  for (const extension of [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"]) {
    candidates.push(`${basePath}${extension}`);
  }

  for (const extension of [".ts", ".tsx", ".mts", ".js", ".mjs"]) {
    candidates.push(path.posix.join(basePath, `index${extension}`));
  }

  return [...new Set(candidates)];
}

function toRuntimeVirtualPath(virtualPath: string): string {
  const extension = path.posix.extname(virtualPath);

  if (SUPPORTED_TYPESCRIPT_EXTENSIONS.has(extension)) {
    return virtualPath.slice(0, -extension.length) + ".mjs";
  }

  return virtualPath;
}

function createRuntimeSpecifier(
  importerRuntimeVirtualPath: string,
  targetRuntimeVirtualPath: string,
): string {
  const importerDirectory = path.posix.dirname(importerRuntimeVirtualPath);
  let relativePath = path.posix.relative(
    importerDirectory,
    targetRuntimeVirtualPath,
  );

  const hasExplicitRelativePrefix =
    relativePath.startsWith("./") || relativePath.startsWith("../");

  if (!hasExplicitRelativePrefix) {
    relativePath = `./${relativePath}`;
  }

  return relativePath;
}

function startOutputCapture(): OutputCapture {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
    stdout.push(chunkToString(chunk));

    if (typeof encoding === "function") {
      encoding();
    }

    if (typeof callback === "function") {
      callback();
    }

    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: unknown, encoding?: unknown, callback?: unknown) => {
    stderr.push(chunkToString(chunk));

    if (typeof encoding === "function") {
      encoding();
    }

    if (typeof callback === "function") {
      callback();
    }

    return true;
  }) as typeof process.stderr.write;

  return {
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
    stdout,
    stderr,
  };
}

function applyProcessEnvironment(
  ctx: JsExecContext,
  workingDirectory: string,
  entryRuntimePath: string,
  scriptArgs: string[],
): () => void {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalCwd = process.cwd();
  const originalEnvValues = new Map<string, string | undefined>();

  for (const [key, value] of ctx.env.entries()) {
    originalEnvValues.set(key, process.env[key]);
    process.env[key] = value;
  }

  process.argv = [process.execPath, entryRuntimePath, ...scriptArgs];
  process.exit = ((exitCode?: number) => {
    throw new ProcessExitError(exitCode ?? 0);
  }) as typeof process.exit;
  process.chdir(workingDirectory);

  return () => {
    process.argv = originalArgv;
    process.exit = originalExit;
    process.chdir(originalCwd);

    for (const [key, value] of originalEnvValues) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

async function importRuntimeModule(runtimePath: string): Promise<void> {
  const moduleUrl = pathToFileURL(runtimePath);
  moduleUrl.searchParams.set("run", Date.now().toString());
  await import(moduleUrl.href);
}

async function writeBootstrapModule(
  runtimeRoot: string,
  bootstrap: string,
): Promise<string> {
  const bootstrapPath = path.join(runtimeRoot, "__bootstrap__.mjs");

  await fs.writeFile(bootstrapPath, bootstrap, "utf8");

  return bootstrapPath;
}

function createCodemodeHostCall(ctx: JsExecContext) {
  return async (toolName: string, inputJson: string): Promise<string> => {
    if (!ctx.exec) {
      throw new Error("codemode bridge is unavailable");
    }

    const result = await ctx.exec(`${CODEMODE_COMMAND_NAME} ${toolName}`, {
      cwd: ctx.cwd,
      env: mapToObject(ctx.env),
      stdin: inputJson,
      signal: ctx.signal,
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim());
    }

    return result.stdout;
  };
}

function mapToObject(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map.entries());
}

function setHostCodemodeCall(
  value:
    | ((toolName: string, inputJson: string) => Promise<string>)
    | undefined,
): typeof value {
  const globalState = globalThis as typeof globalThis & {
    __CODEMODE_CALL__?: typeof value;
  };
  const previous = globalState.__CODEMODE_CALL__;

  if (value === undefined) {
    delete globalState.__CODEMODE_CALL__;
  } else {
    globalState.__CODEMODE_CALL__ = value;
  }

  return previous;
}

async function syncWorkspaceChangesBack(
  ctx: JsExecContext,
  workspaceRoot: string,
): Promise<void> {
  await syncDirectory(ctx, workspaceRoot, workspaceRoot);
}

async function syncDirectory(
  ctx: JsExecContext,
  rootDirectory: string,
  currentDirectory: string,
): Promise<void> {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(rootDirectory, absolutePath);
    const virtualPath = `/${relativePath.split(path.sep).join("/")}`;

    if (entry.isDirectory()) {
      await syncDirectory(ctx, rootDirectory, absolutePath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const contents = await fs.readFile(absolutePath, "utf8");
    await ctx.fs.writeFile(virtualPath, contents);
  }
}

function chunkToString(chunk: unknown): string {
  if (typeof chunk === "string") {
    return chunk;
  }

  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString("utf8");
  }

  return String(chunk);
}

function trimLeadingSlash(filePath: string): string {
  return filePath.startsWith("/") ? filePath.slice(1) : filePath;
}

class ProcessExitError extends Error {
  constructor(readonly exitCode: number) {
    super(`Process exited with code ${exitCode}`);
  }
}

function formatExecutionError(error: unknown): string {
  if (error instanceof ProcessExitError) {
    return "";
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}
