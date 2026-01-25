# Piping Example

This example demonstrates where piping provides the most benefit: complex queries that require filtering, joining, and aggregating data.

## The Problem

With regular AI SDK tools, complex multi-step queries require multiple LLM round-trips:

1. LLM calls `listCustomers({ tier: "premium", state: "CA" })` → gets customer IDs
2. LLM calls `listOrders({ status: "completed" })` → gets all orders
3. LLM processes results to correlate customers with orders
4. LLM calculates the sum

Each step consumes tokens and adds latency.

## The Solution

With shell tools, the agent can do everything in a single command:

```bash
list-orders --status completed | jq '[.orders[] | select(.customer.tier == "premium" and .customer.state == "CA")] | map(.total) | add'
```

One command. One LLM round-trip. The data processing happens in `jq`, not the LLM.

## Running the Examples

```bash
# Shell tools + jq piping
npx tsx examples/shell-tools/piping/index.ts

# Baseline (regular tools, multiple round-trips)
npx tsx examples/shell-tools/piping/baseline.ts
```

## The Query

Both examples answer: **"What's the total revenue from completed orders placed by premium customers in California?"**

This requires:
1. Filter orders by status (completed)
2. Filter by customer tier (premium)
3. Filter by customer state (CA)
4. Sum the totals

## Expected Results

Compare:
- **Steps**: Shell tools should complete in fewer steps (1-2 vs 2-4)
- **Total tokens**: Shell tools should use fewer tokens (less LLM processing)

## Key Insight

Shell tools return rich, denormalized data that's optimized for piping. The `list-orders` tool embeds customer and product details in each order, enabling powerful one-liner queries with `jq`.
