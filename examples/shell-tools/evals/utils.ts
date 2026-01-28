/**
 * Shared evaluation harness for shell tools comparisons.
 *
 * Provides utilities to run shell tools vs baseline comparisons
 * with automatic assertions and result tracking.
 */

import { writeFileSync } from "node:fs";

// ============ Types ============

export interface ToolCall {
  tool: string;
  input: unknown;
  output: unknown;
}

export interface RunResult {
  calls: ToolCall[];
  response: string;
  tokens: number;
  steps: number;
  duration: number;
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface AssertionConfig {
  /** Terms that must appear in the response (case-insensitive) */
  requiredResponseTerms?: string[];
  /** Custom assertion functions */
  custom?: ((result: ComparisonResult) => AssertionResult)[];
}

export interface ComparisonConfig {
  /** Name of the evaluation */
  name: string;
  /** The prompt to test */
  prompt: string;
  /** Function that runs shell tools version and returns result */
  runShellTools: () => Promise<RunResult>;
  /** Function that runs baseline version and returns result */
  runBaseline: () => Promise<RunResult>;
  /** Assertion configuration */
  assertions?: AssertionConfig;
  /** Path to save JSON output (optional) */
  outputPath?: string;
}

export interface ComparisonResult {
  name: string;
  prompt: string;
  shellTools: RunResult;
  baseline: RunResult;
  assertions: AssertionResult[];
  allPassed: boolean;
}

// ============ Assertion Helpers ============

export const assertions = {
  /**
   * Assert shell tools use fewer or equal tool calls than baseline
   */
  fewerCalls: (): ((result: ComparisonResult) => AssertionResult) => {
    return (result: ComparisonResult) => {
      const passed =
        result.shellTools.calls.length <= result.baseline.calls.length;
      return {
        name: "fewerCalls",
        passed,
        message: passed
          ? `Shell tools used ${result.shellTools.calls.length} calls vs baseline ${result.baseline.calls.length}`
          : `Shell tools used MORE calls (${result.shellTools.calls.length}) than baseline (${result.baseline.calls.length})`,
        expected: `<= ${result.baseline.calls.length}`,
        actual: result.shellTools.calls.length,
      };
    };
  },

  /**
   * Assert shell tools use fewer or equal tokens than baseline
   */
  fewerTokens: (): ((result: ComparisonResult) => AssertionResult) => {
    return (result: ComparisonResult) => {
      const passed = result.shellTools.tokens <= result.baseline.tokens;
      return {
        name: "fewerTokens",
        passed,
        message: passed
          ? `Shell tools used ${result.shellTools.tokens} tokens vs baseline ${result.baseline.tokens}`
          : `Shell tools used MORE tokens (${result.shellTools.tokens}) than baseline (${result.baseline.tokens})`,
        expected: `<= ${result.baseline.tokens}`,
        actual: result.shellTools.tokens,
      };
    };
  },

  /**
   * Assert response contains a specific term (case-insensitive)
   */
  responseContains: (
    term: string,
  ): ((result: ComparisonResult) => AssertionResult) => {
    return (result: ComparisonResult) => {
      const shellContains = result.shellTools.response
        .toLowerCase()
        .includes(term.toLowerCase());
      const baselineContains = result.baseline.response
        .toLowerCase()
        .includes(term.toLowerCase());
      const passed = shellContains && baselineContains;
      return {
        name: `responseContains("${term}")`,
        passed,
        message: passed
          ? `Both responses contain "${term}"`
          : `Missing "${term}" - shell: ${shellContains}, baseline: ${baselineContains}`,
        expected: true,
        actual: { shell: shellContains, baseline: baselineContains },
      };
    };
  },
};

// ============ Core Functions ============

/**
 * Create a step finish handler that tracks tool calls
 */
export function createStepHandler(calls: ToolCall[]) {
  return ({
    toolCalls,
    toolResults,
  }: {
    toolCalls?: Array<{ toolName: string; input?: unknown }>;
    toolResults?: Array<{
      toolName: string;
      output?: unknown;
      result?: unknown;
    }>;
  }) => {
    if (toolCalls && toolResults) {
      for (let i = 0; i < toolCalls.length; i++) {
        const call = toolCalls[i];
        const result = toolResults[i];
        if (call && result) {
          calls.push({
            tool: call.toolName,
            input: "input" in call ? call.input : null,
            output:
              "output" in result
                ? result.output
                : "result" in result
                  ? result.result
                  : null,
          });
        }
      }
    }
  };
}

/**
 * Run a comparison between shell tools and baseline versions
 */
export async function runComparison(
  config: ComparisonConfig,
): Promise<ComparisonResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Evaluation: ${config.name}`);
  console.log(`${"=".repeat(60)}\n`);
  console.log(`Prompt: "${config.prompt}"\n`);

  // Run shell tools version
  console.log("--- Running Shell Tools Version ---\n");
  const shellResult = await config.runShellTools();
  console.log(
    `\nShell tools: ${shellResult.calls.length} calls, ${shellResult.tokens} tokens, ${shellResult.steps} steps, ${shellResult.duration}ms\n`,
  );

  // Run baseline version
  console.log("--- Running Baseline Version ---\n");
  const baselineResult = await config.runBaseline();
  console.log(
    `\nBaseline: ${baselineResult.calls.length} calls, ${baselineResult.tokens} tokens, ${baselineResult.steps} steps, ${baselineResult.duration}ms\n`,
  );

  // Run assertions
  const assertionResults: AssertionResult[] = [];
  const assertionConfig = config.assertions ?? {};

  // Always assert shell tools use fewer or equal tool calls
  const fewerCallsPassed =
    shellResult.calls.length <= baselineResult.calls.length;
  assertionResults.push({
    name: "fewerToolCalls",
    passed: fewerCallsPassed,
    message: fewerCallsPassed
      ? `Shell tools: ${shellResult.calls.length} calls <= baseline: ${baselineResult.calls.length} calls`
      : `Shell tools used MORE calls (${shellResult.calls.length}) than baseline (${baselineResult.calls.length})`,
    expected: `<= ${baselineResult.calls.length}`,
    actual: shellResult.calls.length,
  });

  // Always assert shell tools use fewer or equal tokens
  const fewerTokensPassed = shellResult.tokens <= baselineResult.tokens;
  assertionResults.push({
    name: "fewerTokens",
    passed: fewerTokensPassed,
    message: fewerTokensPassed
      ? `Shell tools: ${shellResult.tokens} tokens <= baseline: ${baselineResult.tokens} tokens`
      : `Shell tools used MORE tokens (${shellResult.tokens}) than baseline (${baselineResult.tokens})`,
    expected: `<= ${baselineResult.tokens}`,
    actual: shellResult.tokens,
  });

  // Required response terms
  if (assertionConfig.requiredResponseTerms) {
    for (const term of assertionConfig.requiredResponseTerms) {
      const shellContains = shellResult.response
        .toLowerCase()
        .includes(term.toLowerCase());
      const baselineContains = baselineResult.response
        .toLowerCase()
        .includes(term.toLowerCase());
      const passed = shellContains && baselineContains;
      assertionResults.push({
        name: `responseContains("${term}")`,
        passed,
        message: passed
          ? `Both responses contain "${term}"`
          : `Missing "${term}" - shell: ${shellContains}, baseline: ${baselineContains}`,
        expected: true,
        actual: { shell: shellContains, baseline: baselineContains },
      });
    }
  }

  // Custom assertions
  if (assertionConfig.custom) {
    const preliminaryResult: ComparisonResult = {
      name: config.name,
      prompt: config.prompt,
      shellTools: shellResult,
      baseline: baselineResult,
      assertions: [],
      allPassed: true,
    };
    for (const customAssertion of assertionConfig.custom) {
      assertionResults.push(customAssertion(preliminaryResult));
    }
  }

  const allPassed = assertionResults.every((a) => a.passed);

  const result: ComparisonResult = {
    name: config.name,
    prompt: config.prompt,
    shellTools: shellResult,
    baseline: baselineResult,
    assertions: assertionResults,
    allPassed,
  };

  // Print assertion results
  console.log("--- Assertion Results ---\n");
  for (const assertion of assertionResults) {
    const status = assertion.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${status}: ${assertion.name}`);
    console.log(`       ${assertion.message}`);
  }
  console.log("");

  // Print summary
  console.log("--- Summary ---\n");
  console.log(
    `Shell Tools: ${shellResult.calls.length} calls, ${shellResult.tokens} tokens, ${shellResult.steps} steps`,
  );
  console.log(
    `Baseline:    ${baselineResult.calls.length} calls, ${baselineResult.tokens} tokens, ${baselineResult.steps} steps`,
  );
  console.log("");
  console.log(
    allPassed ? "✓ All assertions passed" : "✗ Some assertions failed",
  );

  // Save results if output path provided
  if (config.outputPath) {
    const output = {
      name: config.name,
      prompt: config.prompt,
      timestamp: new Date().toISOString(),
      shellTools: {
        toolCalls: shellResult.calls.length,
        tokens: shellResult.tokens,
        steps: shellResult.steps,
        duration: shellResult.duration,
        calls: shellResult.calls,
        response: shellResult.response,
      },
      baseline: {
        toolCalls: baselineResult.calls.length,
        tokens: baselineResult.tokens,
        steps: baselineResult.steps,
        duration: baselineResult.duration,
        calls: baselineResult.calls,
        response: baselineResult.response,
      },
      assertions: assertionResults,
      allPassed,
    };
    writeFileSync(config.outputPath, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${config.outputPath}`);
  }

  // Exit with error if assertions failed
  if (!allPassed) {
    process.exitCode = 1;
  }

  return result;
}
