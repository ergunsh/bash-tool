# Shell Tools Prompt Optimization Workflow

You are iteratively improving the shell tools prompt so that the **shell tools version uses fewer tokens** than the baseline across all evals.

## Goal

Make shell tools use **fewer tokens** than the baseline (native AI SDK tools) for every eval. Tool call count does not matter — only total token usage.

## Success Criteria

- **Done**: All 5 evals pass the `fewerTokens` assertion
- **Stretch goal**: Each eval uses at least 10% fewer tokens than baseline (provides safety margin against LLM variance)

The baseline gives the LLM separate tools with typed schemas. Shell tools gives the LLM a single `bash` tool with custom CLI commands.

Shell tools can win on tokens by:
- **Eliminating LLM round-trips**: Each round-trip resends the full prompt. Writing bash scripts that chain multiple tool calls in a single bash call avoids this.
- **Reducing prompt overhead**: The baseline embeds every tool's full schema in the prompt. Shell tools can be more compact since all tools go through a single bash tool.
- **Filtering data in bash**: Using `jq`, `grep`, etc. to filter/aggregate data without sending large payloads back to the LLM for processing.

**Key insight**: Token usage is dominated by the number of LLM round-trips, because each round-trip includes the full system prompt + conversation history. A single extra round-trip can cost 500-1000+ tokens. Minimizing round-trips is the most effective lever.

## Key Files

### Files you SHOULD modify

- **`src/shell-tools/prompt-generator.ts`** - Generates the LLM prompt section for shell tools. This is the primary file to iterate on. The `generateShellToolsPrompt()` function produces text that gets embedded in the bash tool's description.

- **`src/shell-tools/help-generator.ts`** - Generates the `--help` output for individual tools. If the agent runs `tool --help`, this is what it sees. You can modify this to be more or less detailed.

- **`src/tools/bash.ts`** - The `generateDescription()` function assembles the full bash tool description. The shell tools prompt is inserted via the `toolPrompt` parameter. You can also modify the surrounding context (e.g., the "Common operations" section).

### Files you SHOULD NOT modify

- **Eval files** (`examples/shell-tools/evals/*.eval.ts`) - Do not change existing evals to make them pass. The eval scenarios and assertions are fixed. However, you CAN create new eval files (see "Creating New Evals" below).

- **`examples/shell-tools/evals/utils.ts`** - The eval harness. Do not modify.

- **`src/shell-tools/command-adapter.ts`** - Converts shell tool definitions to bash commands. Not related to prompting.

- **`src/shell-tools/cli-parser.ts`** - Parses CLI arguments. Not related to prompting.

### Files you should read for context

- **`examples/shell-tools/CONTEXT.md`** - Full history of investigation, findings, and previous approaches tried.

- **Eval output files** (`examples/shell-tools/evals/data/*-output.json`) - Detailed results from the last eval run, including every tool call the agent made and the full response.

## Key Learnings (from previous iterations)

- **Full schemas were too verbose**: Including output schemas in the prompt added too many tokens per round-trip
- **Progressive disclosure works for many-tools**: When there are 15+ tools, compact listing beats 15 full schemas
- **Progressive disclosure fails for few-tools**: 2-3 tool scenarios can't afford `--help` round-trips
- **Round-trips dominate**: A single extra round-trip costs more than any reasonable prompt optimization

## Iteration Loop

### Step 1: Read current state

```bash
# See the current prompt that gets sent to the LLM
npx tsx scripts/print-tool-prompt.ts --shell-tools

# Compare with the non-shell-tools prompt
npx tsx scripts/print-tool-prompt.ts
```

### Step 2: Run all evals

```bash
npx tsx examples/shell-tools/evals/basic.eval.ts
npx tsx examples/shell-tools/evals/composing.eval.ts
npx tsx examples/shell-tools/evals/piping.eval.ts
npx tsx examples/shell-tools/evals/many-tools.eval.ts
npx tsx examples/shell-tools/evals/batch.eval.ts
```

Run them in parallel if possible. Each takes 10-30 seconds. Results are saved to `examples/shell-tools/evals/data/<name>-output.json`.

### Step 3: Analyze results

Read the JSON output files. **Analysis checklist**:

1. [ ] Compare `shellTools.steps` vs `baseline.steps` (most important metric)
2. [ ] Look for `--help` calls in `shellTools.calls` (each wastes a round-trip)
3. [ ] Look for error/retry patterns (syntax errors waste round-trips)
4. [ ] Count bash calls vs baseline tool calls
5. [ ] Check if agent used scripting (for-loops, chaining, piping)
6. [ ] **Verify correctness**: Check that the agent's final answer in the response is actually correct

For each failing eval, diagnose:

- **`shellTools.calls`** - What commands did the agent actually run? Look for:
   - **Wasted round-trips**: `--help` lookups, failed commands with wrong syntax, exploratory calls — each wastes a full round-trip worth of tokens
   - **Missed batching**: Sequential calls that could have been a for-loop in one bash call
   - **Missed piping**: Separate fetch + filter calls that could have been `tool | jq '...'` in one call
   - **Missed chaining**: Sequential dependent calls that could have been `a=$(tool-a); tool-b --id $(echo "$a" | jq -r '.ref')` in one call

- **`shellTools.steps`** vs **`baseline.steps`** - Steps = LLM round-trips. Each step resends the full prompt. Fewer steps = dramatically fewer tokens. This is the most important metric.

- **`shellTools.tokens`** vs **`baseline.tokens`** - The target metric. Shell tools must be <= baseline.

- **Prompt overhead math**: Count how many tokens the shell tools prompt adds vs the baseline's tool schemas. Then calculate how many round-trips need to be saved to break even.

### Step 4: Hypothesize and modify

Based on what went wrong, modify the prompt in `src/shell-tools/prompt-generator.ts`. Common failure patterns and fixes:

| Failure Pattern | Token Impact | Potential Fix |
|----------------|-------------|---------------|
| Agent uses positional args, gets error, retries | +1 wasted round-trip (~500-1000 tokens) | Add "no positional args" note or show usage signatures |
| Agent guesses wrong flag names, gets error | +1 wasted round-trip (~500-1000 tokens) | Include usage signatures or make `--help` more prominent |
| Agent runs `--help` on every tool before using it | +N round-trips for N tools | Show usage signatures upfront instead of requiring `--help` |
| Agent calls tools one-by-one instead of batching | +N extra round-trips | Add batch/loop examples in prompt |
| Agent pipes data to LLM instead of using jq | Large tool output inflates token count | Add pipe/filter examples in prompt |
| Agent makes separate calls for dependent data | +1 extra round-trip per dependency | Add chain examples in prompt |
| Shell tools prompt itself is too large | Adds overhead to every round-trip | Make prompt more compact, remove unnecessary sections |

### Step 5: Run tests and validate

```bash
pnpm lint:fix
pnpm test:run
```

Update any failing tests in `src/shell-tools/prompt-generator.test.ts` and `src/shell-tools/shell-tools.integration.test.ts` to match your prompt changes.

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

### many-tools ✅ (15 tools, PASSING)
- **Prompt**: "Give me a summary of Acme Corp - their contacts, open deals, and recent activities."
- **Baseline**: 5 calls, 3 steps across 15 available tools
- **Why shell tools wins**: 15 tool schemas in baseline is huge (~2500 tokens). Shell tools' compact listing is much smaller.
- **Status**: PASSING - this is the showcase eval for shell tools' prompt efficiency advantage.

### basic ❌ (2 tools, currently failing)
- **Prompt**: "Send a welcome email to usr_1 using their actual email from the database."
- **Baseline**: 2 calls, 3 steps (fetchUser, sendEmail)
- **Current issue**: Shell tools has ~60 tokens more overhead per step than baseline's 2 small tool schemas. Same step count means baseline wins.
- **Needs redesign**: Pattern C (Aggregation) or Pattern A (Large Data) to create a scenario where shell tools' filtering/computation saves tokens.

### composing ❌ (2 tools, currently failing)
- **Prompt**: "Get the full details for user 'alice', including their team's name and department."
- **Baseline**: 2 calls, 3 steps (getUser, getTeam)
- **Current issue**: Same as basic - 2 tools means baseline has lower overhead, same steps means baseline wins.
- **Needs redesign**: Pattern B (Deep Chain) - add a 3rd level of dependency that can't be parallelized.

### piping ❌ (2 tools, currently failing)
- **Prompt**: "What's the total amount spent by customer cust_1?"
- **Baseline**: 4 calls, 3 steps (listOrderIds + 3x getOrder in parallel)
- **Current issue**: Baseline parallelizes the getOrder calls. Shell tools makes sequential calls.
- **Needs redesign**: Pattern A (Large Data) - make the tool return LARGE payloads so jq filtering saves tokens.

### batch ❌ (2 tools, currently failing)
- **Prompt**: "Get the total account balance for all active users."
- **Baseline**: 5 calls, 3 steps (listUserIds + 4x getUser in parallel)
- **Current issue**: Same as piping - baseline parallelizes, shell tools is sequential.
- **Needs redesign**: Pattern A (Large Data) + Pattern C (Aggregation)

## The Core Tradeoff

Shell tools has an inherent **per-round-trip prompt overhead** because the bash tool description (which includes the shell tools listing) is larger than individual tool schemas (for small tool counts). This means:

- **Each round-trip costs the full prompt** — system prompt + all tool descriptions + conversation history
- **Saving 1 round-trip saves ~500-1000 tokens** depending on prompt size and conversation length
- **Adding 1 wasted round-trip** (e.g., `--help` call or syntax error) costs ~500-1000 tokens
- **For 2-3 tool scenarios**, shell tools prompt overhead is ~200-400 tokens more than baseline per round-trip, so it MUST save at least 1 round-trip to break even
- **For many-tool scenarios** (15+), shell tools prompt is already smaller than 15 separate tool schemas, so it wins per-round-trip even without batching

## Structural Limitations (Important!)

Shell tools has **fundamental structural disadvantages** against certain patterns. Understanding these is critical for eval design.

### Baseline's Parallel Tool Calling Advantage

The AI SDK's ToolLoopAgent can call **multiple independent tools in parallel** within a single step. For example:
- Step 1: `listUserIds()` → returns [usr_1, usr_2, usr_3, usr_4]
- Step 2: `getUser(usr_1)` + `getUser(usr_2)` + `getUser(usr_3)` + `getUser(usr_4)` **ALL IN PARALLEL**
- Step 3: Response

Shell tools **cannot match this** because bash commands run sequentially. Even if the LLM writes a for-loop, it's still one bash tool call per step, and the loop runs sequentially inside that call.

### Shell Tools Wins When

| Scenario | Why Shell Tools Wins |
|----------|---------------------|
| **Many tools (10+)** | Compact listing is smaller than 10+ full tool schemas |
| **Large data filtering** | jq filters data before returning to LLM, reducing output tokens |
| **Deep sequential chains** | Where step 2 REQUIRES step 1's output (can't parallelize anyway) |
| **Complex aggregations** | jq computes sums/averages vs LLM doing mental math |

### Shell Tools Loses When

| Scenario | Why Baseline Wins |
|----------|------------------|
| **Few tools (2-3)** | Baseline's small schemas < shell tools' bash overhead |
| **Fan-out patterns** | Baseline parallelizes N calls in 1 step; shell tools needs N sequential |
| **Simple lookups** | Same steps, but baseline has lower per-step overhead |

### Eval Design Implications

For evals where shell tools should win:
1. **Pattern A (Large Data)**: Tool returns 100+ records, query needs subset → jq filters
2. **Pattern B (Deep Chain)**: 3+ sequential dependencies → can't parallelize
3. **Pattern C (Aggregation)**: Query needs computed result → jq vs LLM mental math
4. **Pattern D (Many Tools)**: 10+ tools available → compact listing wins

Avoid evals with:
- Fan-out patterns (get list, then fetch each) - baseline parallelizes
- 2-3 tools with simple queries - baseline has lower overhead
- Scenarios where LLM scripting is optional - LLM prefers simple calls

## Strategies to Explore

### Prioritization Guide

1. **For few-tool evals failing** (basic, composing, piping, batch): Try Strategy A first (show signatures upfront)
2. **For many-tool evals failing** (many-tools): Strategy B (progressive disclosure) likely already works
3. **If agent makes sequential calls instead of scripting**: Try Strategy D (emphasize scripting)
4. **If both few-tool and many-tool evals need different approaches**: Try Strategy C (hybrid)
5. **For marginal improvements**: Try Strategy E (reduce bash description overhead)

### Handling Tradeoffs

If a change improves some evals but regresses others:
1. Analyze WHY each behaves differently (tool count? scripting behavior?)
2. Consider Strategy C (hybrid based on tool count)
3. If no hybrid works, prioritize the eval with tightest margin (usually `composing`)

### Strategy A: Show usage signatures upfront (no `--help` needed)
Show `tool --flag <type>` in the prompt so the agent never needs to call `--help`. Prevents wasted round-trips from syntax errors and `--help` lookups. Increases prompt size slightly but saves round-trips. Previously tried with output schemas included — was too verbose. Try with ONLY usage signatures (no output info).

### Strategy B: Progressive disclosure (current approach)
Show only tool names + descriptions, require `--help` before first use. Saves prompt tokens per round-trip but costs `--help` round-trips (each costing ~500-1000 tokens). Works well for many-tools, poorly for few-tool scenarios.

### Strategy C: Hybrid based on tool count
Show full signatures when there are few tools (< 5), use progressive disclosure when there are many (5+). More complex but could optimize for both cases.

### Strategy D: Emphasize scripting over individual calls
Instead of listing tools and hoping the agent scripts, explicitly frame the prompt to prime scripting behavior. E.g., "Always combine multiple operations in a single bash call."

### Strategy E: Reduce bash tool description overhead
Remove or condense the "Common operations" section when shell tools are present. Every token saved in the base description compounds across all round-trips.

### Strategy F: Smarter `--help` output
Make `--help` output more compact so it costs fewer tokens when the agent does call it. Or include only the most essential information (just usage line + flags, skip the verbose output schema).

## Creating New Evals

If you identify a scenario where shell tools should clearly win on tokens, create a new eval. Good candidates:

1. **Large fan-out**: Get a list of IDs, then fetch details for each (10+ items). Baseline needs many round-trips (each resending full prompt), shell tools can do it in 2 calls with a for-loop.

2. **Deep data pipeline**: Fetch data, filter by multiple criteria, transform, aggregate. Baseline gets all raw data back to the LLM (huge token cost), shell tools can do `tool | jq 'complex_query'` and only return the final result.

3. **Multi-join**: Get entity A, use its foreign key to get B, use B's foreign key to get C. Baseline needs 3 sequential round-trips. Shell tools can chain in 1 call.

4. **Many tools, few used**: 20+ tools available but only 3-4 needed. Baseline's prompt includes all 20 tool schemas (massive token overhead per round-trip). Shell tools listing is a fraction of that size.

Follow the pattern in existing eval files:
- Define mock data and schemas
- Create both shell tool and baseline versions using the same schemas and execute functions
- Use `runComparison()` from `utils.ts`
- Save output to `examples/shell-tools/evals/data/<name>-output.json`
- Use `anthropic/claude-sonnet-4.5` as the model

## Constraints

- **No eval-specific prompting**: Changes to `prompt-generator.ts` must be generic. You cannot detect which eval is running and customize the prompt.
- **Optimize for tokens only**: The `fewerTokens` assertion is the only one that matters. Tool call count is irrelevant — the agent can make as many calls as it wants as long as total tokens are lower.
- **Must pass all tests**: Run `pnpm test:run` after changes. Update test assertions in `prompt-generator.test.ts` and `shell-tools.integration.test.ts` to match new prompt format.
- **Must pass lint**: Run `pnpm lint:fix` after changes.
- **Keep it real**: Any new evals must represent realistic use cases, not contrived scenarios designed to favor shell tools.
