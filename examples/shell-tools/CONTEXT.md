# Shell Tools Composing Example - Context & Investigation

## Problem Statement

We're trying to demonstrate where shell tools + bash scripting provides genuine advantages over regular AI SDK tools, but our examples keep showing shell tools using MORE tokens, not fewer.

## Interview Insights

### Original Vision

**Q: When you first envisioned shell tools + bash composition being more efficient, what was the specific scenario?**

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

**Shell tools approach (expected 1 round-trip):**
```bash
user=$(get-user --id alice)
team_id=$(echo "$user" | jq -r '.teamId')
team=$(get-team --id "$team_id")
echo "$user" | jq --argjson team "$team" '. + {team: $team}'
```

## Test Results (User + Team Join)

**Result: Agent did NOT write a combined script.**

Shell tools version made 2 separate calls:
1. `get-user --id alice` → LLM saw result
2. `get-team --id team_eng` → LLM saw result

Baseline made identical 2 calls:
1. `getUser({id: "alice"})` → LLM saw result
2. `getTeam({id: "team_eng"})` → LLM saw result

**Token comparison:**
- Shell tools: 1433 tokens (301 more due to larger bash tool description)
- Baseline: 1132 tokens

**What the agent COULD have done:**
```bash
user=$(get-user --id alice)
team_id=$(echo "$user" | jq -r '.teamId')
get-team --id "$team_id"
```

This confirms: **"Not shown as possible"** - the agent doesn't realize it can write multi-step bash scripts.

## Next Steps

1. ✅ Test case built and confirmed the hypothesis
2. **TODO:** Update the bash tool prompt to educate the agent about scripting capabilities
3. Don't overindex on jq - also consider grep, sed, file operations
4. Re-run comparison after prompt improvements

## Key Realization

The value proposition of shell tools isn't just about jq filtering - it's about **eliminating LLM round-trips** by letting the agent write scripts that:
- Execute multiple tool calls
- Store intermediate results in variables
- Combine/transform data
- Return only the final result to the LLM
