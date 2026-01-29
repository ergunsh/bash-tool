# CLI Tools Composing Example - Context & Investigation

## Problem Statement

We're trying to demonstrate where CLI tools + bash scripting provides genuine advantages over regular AI SDK tools, but our examples keep showing CLI tools using MORE tokens, not fewer.

## Interview Insights

### Original Vision

**Q: When you first envisioned CLI tools + bash composition being more efficient, what was the specific scenario?**

**A: Multi-tool pipelines + Bash utilities**

The idea was that:
1. Output of tool A feeds directly into tool B without LLM in the middle
2. Using wc, sort, uniq, grep alongside custom tools

### Pipeline Blocker

**Q: For multi-tool pipelines, what's preventing the agent from naturally chaining tools?**

**A: "Agent needs to wait for the answer of one tool to feed into the other tool call. However, with the composition (e.g. writing a bash script), it does not need to do that and it can do everything in one tool call."**

Key insight: With bash scripting, the agent can write a script that chains multiple operations WITHOUT needing multiple LLM round-trips.

### Why Agent Isn't Writing Multi-Step Scripts

**Q: Why do you think the agent isn't writing these multi-step scripts?**

**A: "I think all of them might apply, but we need to find a concrete example where scripting is genuinely useful & test on it. If it doesn't work, and if we're sure that scripting is genuinely useful (e.g. a human would be more efficient in doing it with scripting), then we need to improve the implementation."**

Potential blockers:
- Agent doesn't know it can write multi-step scripts
- Simpler to call tools separately (feels more natural/safe)
- Uncertain about jq/bash syntax
- Our examples don't require multi-step scripts

### Human Scripting Use Cases

**Q: What kind of task would a human developer naturally solve with a bash script?**

**A: All of the following:**
1. **Batch operations** - For each X, do Y (looping over a list)
2. **Data pipeline** - Get data → filter → transform → aggregate → output
3. **Conditional logic** - If X then do A, else do B
4. **Variable reuse** - Store result of A, use it in B and C

### Best Candidate for Token Savings

**Q: Which scenario has the clearest token-saving potential?**

**A: "I was thinking of a combination of Join + Pipeline"**

Example: Get user → use teamId to get team → return combined result

### What's Blocking the Join Case

**Q: What prevents the agent from writing this as one script?**

**A: "I think 'Not shown as possible' is the answer. Maybe we need to update the main tool prompt to really say that 'Bash scripting is available and useful for ... cases'. I also don't want to overindex on `jq`, there is also `grep`, `sed` or many other tools (e.g. agent can save the result to a file and run grep etc on it). Though for making sure that the changes are meaningful, we need to have sample cases first."**

### Chosen Test Case

**Q: Which concrete scenario should we build?**

**A: User + Team join**
- Get user by ID
- Use their teamId to fetch team details
- Return combined info

## Current State

We've redesigned the `composing/` example to test the User + Team join scenario:

**Baseline approach (expected 2 round-trips):**
1. Call `getUser({id: "alice"})` → LLM sees full user object
2. LLM extracts teamId, calls `getTeam({id: "team_eng"})` → LLM sees full team object
3. LLM combines and responds

**CLI tools approach (expected 1 round-trip):**
```bash
user=$(get-user --id alice)
team_id=$(echo "$user" | jq -r '.teamId')
team=$(get-team --id "$team_id")
echo "$user" | jq --argjson team "$team" '. + {team: $team}'
```

## Test Results (User + Team Join)

**Result: Agent did NOT write a combined script.**

CLI tools version made 2 separate calls:
1. `get-user --id alice` → LLM saw result
2. `get-team --id team_eng` → LLM saw result

Baseline made identical 2 calls:
1. `getUser({id: "alice"})` → LLM saw result
2. `getTeam({id: "team_eng"})` → LLM saw result

**Token comparison:**
- CLI tools: 1433 tokens (301 more due to larger bash tool description)
- Baseline: 1132 tokens

**What the agent COULD have done:**
```bash
user=$(get-user --id alice)
team_id=$(echo "$user" | jq -r '.teamId')
get-team --id "$team_id"
```

This confirms: **"Not shown as possible"** - the agent doesn't realize it can write multi-step bash scripts.

## Key Realization

The value proposition of CLI tools isn't just about jq filtering - it's about **eliminating LLM round-trips** by letting the agent write scripts that:
- Execute multiple tool calls
- Store intermediate results in variables
- Combine/transform data
- Return only the final result to the LLM

---

## Session 2: Prompt Improvements & New Batch Eval (2026-01-28)

### Changes Made

#### 1. Improved Output Schema Display (`src/cli-tools/prompt-generator.ts`)

Modified `getOutputDescription()` to show nested object structures and enum values:

**Before:**
```
Output: JSON { orders }
```

**After:**
```
Output: JSON {orders[]{id, customer:{id, name, tier:<premium|standard>, state:<CA|NY|TX>}, total, status:<completed|pending|refunded>}}
```

This helps the agent understand:
- Nested field paths (e.g., `.customer.tier`, `.customer.state`)
- Valid enum values (e.g., "CA" not "California")

#### 2. Added Efficiency Guidance

Added three patterns to the CLI tools prompt:

```
EFFICIENCY: Combine operations in ONE bash call to minimize round-trips:
  Pipe: tool | jq '[.items[] | select(.field == "x") | .val] | add'
  Chain: a=$(tool-a); tool-b --id $(echo "$a" | jq -r '.ref')
  Batch: for id in x y z; do tool --id $id; done | jq -s '[.[].val] | add'
```

#### 3. Added Enums to Piping Example (`examples/cli-tools/piping/shared.ts`)

Changed string fields to enums so the agent knows valid values:
```typescript
const statusEnum = z.enum(["completed", "pending", "refunded"]);
const tierEnum = z.enum(["premium", "standard"]);
const stateEnum = z.enum(["CA", "NY", "TX"]);
```

#### 4. Created Batch Operations Eval (`examples/cli-tools/evals/batch.eval.ts`)

New eval that tests for-each loop operations:
- **Prompt:** "Get the total account balance for all active users"
- **Baseline:** Must call `listUserIds` then `getUser` 4 times (5 total calls)
- **CLI tools:** Can use a for-loop to batch all user fetches

#### 5. Updated All Evals to Use Sonnet

Changed from `claude-haiku-4.5` to `claude-sonnet-4.5` for more consistent results.

### Eval Results

| Eval | Shell Calls | Baseline Calls | Shell Tokens | Baseline Tokens | Status |
|------|-------------|----------------|--------------|-----------------|--------|
| **piping** | 1 | 2 | 1255 | 1759 | ✓ **PASS** |
| **batch** | 2 | 5 | 1647 | 1380 | ✗ calls great, tokens fail |
| **basic** | 2 | 2 | 1464 | 1203 | ✗ same calls |
| **composing** | 2 | 2 | 1478 | 1084 | ✗ same calls |
| **many-tools** | 7 | 5 | 2943 | 2500 | ✗ worse |

### What's Working

#### Piping Eval ✓
Agent successfully used jq piping in ONE call:
```bash
list-orders --status completed | jq '[.orders[] | select(.customer.tier == "premium" and .customer.state == "CA") | .total] | add'
```
- Used enum values correctly ("CA" not "California")
- Filtered by nested fields (`.customer.tier`, `.customer.state`)
- Aggregated with `add`

#### Batch Eval (Partial Success)
Agent used for-loop to reduce calls from 5 to 2:
```bash
for id in usr_1 usr_2 usr_4 usr_5; do get-user --id $id; done | jq -s '{users: [.[] | {name: .name, balance: .balance}], total: ([.[].balance] | add)}'
```
- Great call reduction (2 vs 5)
- Tokens still higher due to prompt overhead

### What's NOT Working

#### Composing Eval
Agent still makes 2 separate calls instead of chaining:
- **Actual:** `get-user --id alice` then `get-team --id team_eng`
- **Ideal:** `user=$(get-user --id alice); get-team --id $(echo "$user" | jq -r '.teamId')`

The agent recognizes the data dependency but chooses to make separate calls rather than write a chained script.

#### Token Overhead Problem
CLI tools has ~250 token overhead per LLM call due to:
1. Larger bash tool description (includes all CLI tools documentation)
2. Efficiency guidance text

**Break-even analysis:** CLI tools only wins on tokens when it saves 1+ LLM round-trips. For tasks where both make the same number of calls, baseline always wins on tokens.

### Root Cause Analysis

1. **Piping works** because:
   - One tool's output contains ALL needed data (orders have embedded customer info)
   - Simple jq pipe can filter and aggregate
   - No need to call multiple tools

2. **Batch works** because:
   - Clear loop pattern (for-each over list)
   - Efficiency guidance shows exact for-loop syntax
   - Agent recognizes the batch opportunity

3. **Composing doesn't work** because:
   - Chaining requires more complex bash syntax
   - Agent may perceive 2 simple calls as easier than 1 complex script
   - The benefit (1 fewer round-trip) may not seem worth the complexity

### Next Steps

1. **Reduce prompt overhead:**
   - Remove "Common operations" section when CLI tools are present
   - Make CLI tools documentation more compact
   - Consider lazy loading tool docs (only show relevant ones)

2. **Improve chaining guidance:**
   - Make the Chain example more prominent or add more examples
   - Consider detecting when tools have foreign key relationships and suggesting chaining

3. **Adjust eval assertions:**
   - Consider changing `fewerTokens` assertion to only apply when calls are reduced
   - Or accept that token overhead is fundamental and focus on call reduction

4. **Explore alternative approaches:**
   - Could the agent be told to "prefer combining operations" in system prompt?
   - Could we detect sequential dependencies and suggest scripting?

### Files Changed

- `src/cli-tools/prompt-generator.ts` - Nested schema display + efficiency guidance
- `examples/cli-tools/piping/shared.ts` - Added enums
- `examples/cli-tools/evals/piping.eval.ts` - Changed to Sonnet
- `examples/cli-tools/evals/basic.eval.ts` - Changed to Sonnet
- `examples/cli-tools/evals/batch.eval.ts` - NEW FILE
