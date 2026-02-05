# CLI Tools Prompt Optimization Workflow

You are iteratively improving the CLI tools prompt so that the **CLI tools version uses fewer tokens** than the baseline across all evals.

## Goal

Make CLI tools use **fewer tokens** than the baseline (native AI SDK tools) for every eval. Tool call count does not matter — only total token usage.

## Success Criteria

- **Done**: All 6 evals pass the `fewerTokens` assertion
- **Stretch goal**: Each eval uses at least 10% fewer tokens than baseline (provides safety margin against LLM variance)

## Current Status

**2 of 6 evals passing:**
- ✅ **large-data**: 1278 tokens vs 6036 baseline (4.7x fewer)
- ✅ **many-tools**: 2051 tokens vs 2523 baseline (19% fewer)

The baseline gives the LLM separate tools with typed schemas. CLI tools gives the LLM a single `bash` tool with custom CLI commands.

CLI tools can win on tokens by:
- **Eliminating LLM round-trips**: Each round-trip resends the full prompt. Writing bash scripts that chain multiple tool calls in a single bash call avoids this.
- **Reducing prompt overhead**: The baseline embeds every tool's full schema in the prompt. CLI tools can be more compact since all tools go through a single bash tool.
- **Filtering data in bash**: Using `jq`, `grep`, etc. to filter/aggregate data without sending large payloads back to the LLM for processing.

**Key insight**: Token usage is dominated by the number of LLM round-trips, because each round-trip includes the full system prompt + conversation history. A single extra round-trip can cost 500-1000+ tokens. Minimizing round-trips is the most effective lever.

## Key Files

### Files you SHOULD modify

- **`src/cli-tools/prompt-generator.ts`** - Generates the LLM prompt section for CLI tools. This is the primary file to iterate on. The `generateCliToolsPrompt()` function produces text that gets embedded in the bash tool's description.

- **`src/cli-tools/help-generator.ts`** - Generates the `--help` output for individual tools. If the agent runs `tool --help`, this is what it sees. You can modify this to be more or less detailed.

- **`src/tools/bash.ts`** - The `generateDescription()` function assembles the full bash tool description. The CLI tools prompt is inserted via the `toolPrompt` parameter. You can also modify the surrounding context (e.g., the "Common operations" section).

### Files you SHOULD NOT modify

- **Eval files** (`examples/cli-tools/evals/*.eval.ts`) - Do not change existing evals to make them pass. The eval scenarios and assertions are fixed. However, you CAN create new eval files (see "Creating New Evals" below).

- **`examples/cli-tools/evals/utils.ts`** - The eval harness. Do not modify.

- **`src/cli-tools/command-adapter.ts`** - Converts CLI tool definitions to bash commands. Not related to prompting.

- **`src/cli-tools/cli-parser.ts`** - Parses CLI arguments. Not related to prompting.

### Files you should read for context

- **`examples/cli-tools/CONTEXT.md`** - Full history of investigation, findings, and previous approaches tried.

- **Eval output files** (`examples/cli-tools/evals/data/*-output.json`) - Detailed results from the last eval run, including every tool call the agent made and the full response.

## Key Learnings (from previous iterations)

- **Full schemas were too verbose**: Including output schemas in the prompt added too many tokens per round-trip
- **Progressive disclosure works for many-tools**: When there are 15+ tools, compact listing beats 15 full schemas
- **Progressive disclosure fails for few-tools**: 2-3 tool scenarios can't afford `--help` round-trips
- **Round-trips dominate**: A single extra round-trip costs more than any reasonable prompt optimization

## Iteration Loop

### Step 1: Read current state

```bash
# See the current prompt that gets sent to the LLM
npx tsx scripts/print-tool-prompt.ts --cli-tools

# Compare with the non-cli-tools prompt
npx tsx scripts/print-tool-prompt.ts
```

### Step 2: Run all evals

```bash
npx tsx examples/cli-tools/evals/basic.eval.ts
npx tsx examples/cli-tools/evals/composing.eval.ts
npx tsx examples/cli-tools/evals/piping.eval.ts
npx tsx examples/cli-tools/evals/many-tools.eval.ts
npx tsx examples/cli-tools/evals/batch.eval.ts
```

Run them in parallel if possible. Each takes 10-30 seconds. Results are saved to `examples/cli-tools/evals/data/<name>-output.json`.

### Step 3: Analyze results

Read the JSON output files. **Analysis checklist**:

1. [ ] Compare `cliTools.steps` vs `baseline.steps` (most important metric)
2. [ ] Look for `--help` calls in `cliTools.calls` (each wastes a round-trip)
3. [ ] Look for error/retry patterns (syntax errors waste round-trips)
4. [ ] Count bash calls vs baseline tool calls
5. [ ] Check if agent used scripting (for-loops, chaining, piping)
6. [ ] **Verify correctness**: Check that the agent's final answer in the response is actually correct

For each failing eval, diagnose:

- **`cliTools.calls`** - What commands did the agent actually run? Look for:
   - **Wasted round-trips**: `--help` lookups, failed commands with wrong syntax, exploratory calls — each wastes a full round-trip worth of tokens
   - **Missed batching**: Sequential calls that could have been a for-loop in one bash call
   - **Missed piping**: Separate fetch + filter calls that could have been `tool | jq '...'` in one call
   - **Missed chaining**: Sequential dependent calls that could have been `a=$(tool-a); tool-b --id $(echo "$a" | jq -r '.ref')` in one call

- **`cliTools.steps`** vs **`baseline.steps`** - Steps = LLM round-trips. Each step resends the full prompt. Fewer steps = dramatically fewer tokens. This is the most important metric.

- **`cliTools.tokens`** vs **`baseline.tokens`** - The target metric. CLI tools must be <= baseline.

- **Prompt overhead math**: Count how many tokens the CLI tools prompt adds vs the baseline's tool schemas. Then calculate how many round-trips need to be saved to break even.

### Step 4: Hypothesize and modify

Based on what went wrong, modify the prompt in `src/cli-tools/prompt-generator.ts`. Common failure patterns and fixes:

| Failure Pattern | Token Impact | Potential Fix |
|----------------|-------------|---------------|
| Agent uses positional args, gets error, retries | +1 wasted round-trip (~500-1000 tokens) | Add "no positional args" note or show usage signatures |
| Agent guesses wrong flag names, gets error | +1 wasted round-trip (~500-1000 tokens) | Include usage signatures or make `--help` more prominent |
| Agent runs `--help` on every tool before using it | +N round-trips for N tools | Show usage signatures upfront instead of requiring `--help` |
| Agent calls tools one-by-one instead of batching | +N extra round-trips | Add batch/loop examples in prompt |
| Agent pipes data to LLM instead of using jq | Large tool output inflates token count | Add pipe/filter examples in prompt |
| Agent makes separate calls for dependent data | +1 extra round-trip per dependency | Add chain examples in prompt |
| CLI tools prompt itself is too large | Adds overhead to every round-trip | Make prompt more compact, remove unnecessary sections |

### Step 5: Run tests and validate

```bash
pnpm lint:fix
pnpm test:run
```

Update any failing tests in `src/cli-tools/prompt-generator.test.ts` and `src/cli-tools/cli-tools.integration.test.ts` to match your prompt changes.

### Step 6: Repeat from Step 2

Keep iterating until all evals pass on the `fewerTokens` assertion.

### Handling Variance

LLM outputs are non-deterministic. If results are close to the threshold (within 5%), run evals 2-3 times to confirm. Aim for a 10%+ margin to be safe.

### Git Workflow

Commit after each successful iteration with descriptive messages:
```bash
git commit -m "Strategy A: add usage signatures - basic/composing pass"
```

## Eval Scenarios

### large-data ✅ (3 tools, PASSING)
- **Prompt**: "Find the highest-rated electronics product that costs less than $350."
- **Baseline**: 1 call, 6036 tokens (entire filtered dataset returned to LLM)
- **CLI tools**: 2 calls, 1278 tokens (jq extracts just the answer)
- **Why CLI tools wins**: Large dataset (500 products) saved to file. Structure hint enables correct jq query on first try. Only the final answer (3 fields) returns to LLM.
- **Status**: PASSING - demonstrates the power of jq filtering for large data.

### many-tools ✅ (15 tools, PASSING)
- **Prompt**: "Give me a summary of Acme Corp - their contacts, open deals, and recent activities."
- **Baseline**: 5 calls, 2523 tokens across 15 available tools
- **CLI tools**: 5 calls, 2051 tokens
- **Why CLI tools wins**: 15 tool schemas in baseline is huge. CLI tools' compact listing is much smaller.
- **Status**: PASSING - demonstrates prompt efficiency with many tools.

### basic ❌ (2 tools, currently failing)
- **Prompt**: "Send a welcome email to usr_1 using their actual email from the database."
- **Baseline**: 2 calls, 1223 tokens
- **CLI tools**: 2 calls, 1289 tokens (5% overhead)
- **Current issue**: With inline outputs, call count is now equal. But CLI tools has ~60 tokens more overhead per step due to bash tool description.

### composing ❌ (2 tools, currently failing)
- **Prompt**: "Get the full details for user 'alice', including their team's name and department."
- **Baseline**: 2 calls, 1045 tokens
- **CLI tools**: 2 calls, 1283 tokens (23% overhead)
- **Current issue**: Same as basic - 2 tools means baseline has lower overhead.

### piping ❌ (2 tools, currently failing)
- **Prompt**: "What's the total amount spent by customer cust_1?"
- **Baseline**: 4 calls, 1331 tokens
- **CLI tools**: 4 calls, 1640 tokens (23% overhead)
- **Current issue**: Both make same number of calls. Baseline has lower per-step overhead.

### batch ❌ (2 tools, currently failing)
- **Prompt**: "Get the total account balance for all active users."
- **Baseline**: 5 calls, 1376 tokens
- **CLI tools**: 7 calls, 1983 tokens (44% overhead)
- **Current issue**: CLI tools makes more calls and has higher per-step overhead.

## The Core Tradeoff

CLI tools has an inherent **per-round-trip prompt overhead** because the bash tool description (which includes the CLI tools listing) is larger than individual tool schemas (for small tool counts). This means:

- **Each round-trip costs the full prompt** — system prompt + all tool descriptions + conversation history
- **Saving 1 round-trip saves ~500-1000 tokens** depending on prompt size and conversation length
- **Adding 1 wasted round-trip** (e.g., `--help` call or syntax error) costs ~500-1000 tokens
- **For 2-3 tool scenarios**, CLI tools prompt overhead is ~200-400 tokens more than baseline per round-trip, so it MUST save at least 1 round-trip to break even
- **For many-tool scenarios** (15+), CLI tools prompt is already smaller than 15 separate tool schemas, so it wins per-round-trip even without batching

## Structural Limitations (Important!)

CLI tools has **fundamental structural disadvantages** against certain patterns. Understanding these is critical for eval design.

### Baseline's Parallel Tool Calling Advantage

The AI SDK's ToolLoopAgent can call **multiple independent tools in parallel** within a single step. For example:
- Step 1: `listUserIds()` → returns [usr_1, usr_2, usr_3, usr_4]
- Step 2: `getUser(usr_1)` + `getUser(usr_2)` + `getUser(usr_3)` + `getUser(usr_4)` **ALL IN PARALLEL**
- Step 3: Response

CLI tools **cannot match this** because bash commands run sequentially. Even if the LLM writes a for-loop, it's still one bash tool call per step, and the loop runs sequentially inside that call.

### CLI Tools Wins When

| Scenario | Why CLI Tools Wins |
|----------|---------------------|
| **Many tools (10+)** | Compact listing is smaller than 10+ full tool schemas |
| **Large data filtering** | jq filters data before returning to LLM, reducing output tokens |
| **Deep sequential chains** | Where step 2 REQUIRES step 1's output (can't parallelize anyway) |
| **Complex aggregations** | jq computes sums/averages vs LLM doing mental math |

### CLI Tools Loses When

| Scenario | Why Baseline Wins |
|----------|------------------|
| **Few tools (2-3)** | Baseline's small schemas < CLI tools' bash overhead |
| **Fan-out patterns** | Baseline parallelizes N calls in 1 step; CLI tools needs N sequential |
| **Simple lookups** | Same steps, but baseline has lower per-step overhead |

### Eval Design Implications

For evals where CLI tools should win:
1. **Pattern A (Large Data)**: Tool returns 100+ records, query needs subset → jq filters
2. **Pattern B (Deep Chain)**: 3+ sequential dependencies → can't parallelize
3. **Pattern C (Aggregation)**: Query needs computed result → jq vs LLM mental math
4. **Pattern D (Many Tools)**: 10+ tools available → compact listing wins

Avoid evals with:
- Fan-out patterns (get list, then fetch each) - baseline parallelizes
- 2-3 tools with simple queries - baseline has lower overhead
- Scenarios where LLM scripting is optional - LLM prefers simple calls

## Strategies Implemented

### ✅ Strategy G: Inline Small Outputs (IMPLEMENTED)
Small outputs (≤2000 chars) return inline instead of saving to files. This eliminated the need for a separate `cat` call, reducing call count by 50%.

**Before:** `fetch-user --id x` → "Output saved to file" → `cat file` → data
**After:** `fetch-user --id x` → data (inline)

### ✅ Strategy H: Structure Hints for Large Outputs (IMPLEMENTED)
When large outputs are saved to files, include a structure hint:
```
Output saved to /workspace/.cli-output/list-products-123.json
Structure: {products: array[55], total: number}
```

This enables correct jq queries on the first try without exploring the file.

## Strategies to Explore

### Prioritization Guide

1. **For few-tool evals failing** (basic, composing, piping, batch): The remaining overhead is fundamental - bash tool description is larger than 2-3 small tool schemas
2. **For large-data scenarios**: Strategy H (structure hints) already works well
3. **For many-tool scenarios**: Compact listing already wins

### Remaining Options

### Strategy A: Show usage signatures upfront (CURRENT)
Usage signatures are shown in the prompt so the agent doesn't need `--help`. This is already implemented.

### Strategy E: Reduce bash tool description overhead
Remove or condense the "Common operations" section when CLI tools are present. Every token saved in the base description compounds across all round-trips.

### Strategy D: Emphasize scripting over individual calls
For batch/piping scenarios, could add more aggressive prompting to encourage for-loops and jq pipelines. However, testing shows the model often prefers separate calls.

### Fundamental Limitation

For 2-3 tool scenarios with small data, native AI SDK tools will likely always be more efficient because:
1. Their tool schemas are smaller than the bash tool description
2. Same number of calls means baseline wins on tokens

CLI tools' advantage is in:
1. **Large datasets** - jq can filter data before returning to LLM
2. **Many tools** - compact listing beats many separate schemas

## Creating New Evals

If you identify a scenario where CLI tools should clearly win on tokens, create a new eval. Good candidates:

1. **Large dataset filtering** (see `large-data.eval.ts`): Tool returns hundreds of records, query needs specific subset. Baseline returns ALL data to LLM (huge token cost). CLI tools saves to file + jq extracts only needed fields.

2. **Deep data pipeline**: Fetch data, filter by multiple criteria, transform, aggregate. Baseline gets all raw data back to the LLM (huge token cost), CLI tools can do `tool | jq 'complex_query'` and only return the final result.

3. **Multi-join**: Get entity A, use its foreign key to get B, use B's foreign key to get C. Baseline needs 3 sequential round-trips. CLI tools can chain in 1 call.

4. **Many tools, few used** (see `many-tools.eval.ts`): 15+ tools available but only 3-4 needed. Baseline's prompt includes all tool schemas (massive token overhead per round-trip). CLI tools listing is a fraction of that size.

Follow the pattern in existing eval files:
- Define mock data and schemas
- Create both CLI tool and baseline versions using the same schemas and execute functions
- Use `runComparison()` from `utils.ts`
- Save output to `examples/cli-tools/evals/data/<name>-output.json`
- Use `anthropic/claude-sonnet-4.5` as the model

## Constraints

- **No eval-specific prompting**: Changes to `prompt-generator.ts` must be generic. You cannot detect which eval is running and customize the prompt.
- **Optimize for tokens only**: The `fewerTokens` assertion is the only one that matters. Tool call count is irrelevant — the agent can make as many calls as it wants as long as total tokens are lower.
- **Must pass all tests**: Run `pnpm test:run` after changes. Update test assertions in `prompt-generator.test.ts` and `cli-tools.integration.test.ts` to match new prompt format.
- **Must pass lint**: Run `pnpm lint:fix` after changes.
- **Keep it real**: Any new evals must represent realistic use cases, not contrived scenarios designed to favor CLI tools.
