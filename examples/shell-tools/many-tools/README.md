# Many Tools Example

This example demonstrates where shell tools provide the most benefit: when you have many related operations.

## The Problem

With regular AI SDK tools, each tool adds its full schema to the context. With 15+ tools, this can become significant overhead.

## The Solution

Shell tools consolidate all operations into a single bash tool with a compact description. The agent discovers available commands from the bash tool description.

## Running the Examples

```bash
# Shell tools approach (15 tools via single bash tool)
npx tsx examples/shell-tools/many-tools/index.ts

# Baseline comparison (15 separate AI SDK tools)
npx tsx examples/shell-tools/many-tools/baseline.ts
```

## CRM Tools Included

| Category | Tools |
|----------|-------|
| Customers | `get-customer`, `list-customers`, `search-customers` |
| Contacts | `get-contact`, `list-contacts` |
| Deals | `get-deal`, `list-deals` |
| Tasks | `get-task`, `list-tasks` |
| Notes | `list-notes` |
| Activities | `list-activities` |
| Invoices | `get-invoice`, `list-invoices` |
| Products | `get-product`, `list-products` |

## Expected Results

Run both examples and compare the `Total tokens` output. The shell tools approach should use fewer tokens because:

1. **Single tool definition**: One bash tool vs 15 separate tool schemas
2. **Compact descriptions**: Shell tools use a summarized format in the bash tool description
3. **No per-tool overhead**: Regular tools each have JSON schema overhead

The token savings increase as you add more tools.
