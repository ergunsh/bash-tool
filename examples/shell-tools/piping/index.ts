/**
 * Example: Shell Tools with Piping
 *
 * This example demonstrates where piping provides the most benefit.
 * With shell tools, the agent can chain operations in a single command
 * using jq, avoiding multiple LLM round-trips.
 *
 * Run with: npx tsx examples/shell-tools/piping/index.ts
 */

import { ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
} from "../../../src/index.js";

// Mock e-commerce database
const db = {
  orders: [
    {
      id: "ord_1",
      customerId: "cust_1",
      productId: "prod_1",
      quantity: 2,
      total: 199.98,
      status: "completed",
      date: "2024-01-15",
    },
    {
      id: "ord_2",
      customerId: "cust_2",
      productId: "prod_3",
      quantity: 1,
      total: 899.99,
      status: "completed",
      date: "2024-01-16",
    },
    {
      id: "ord_3",
      customerId: "cust_1",
      productId: "prod_2",
      quantity: 3,
      total: 89.97,
      status: "pending",
      date: "2024-01-17",
    },
    {
      id: "ord_4",
      customerId: "cust_3",
      productId: "prod_1",
      quantity: 1,
      total: 99.99,
      status: "completed",
      date: "2024-01-18",
    },
    {
      id: "ord_5",
      customerId: "cust_2",
      productId: "prod_4",
      quantity: 2,
      total: 59.98,
      status: "completed",
      date: "2024-01-19",
    },
    {
      id: "ord_6",
      customerId: "cust_4",
      productId: "prod_3",
      quantity: 1,
      total: 899.99,
      status: "refunded",
      date: "2024-01-20",
    },
    {
      id: "ord_7",
      customerId: "cust_1",
      productId: "prod_5",
      quantity: 5,
      total: 124.95,
      status: "completed",
      date: "2024-01-21",
    },
    {
      id: "ord_8",
      customerId: "cust_5",
      productId: "prod_2",
      quantity: 2,
      total: 59.98,
      status: "completed",
      date: "2024-01-22",
    },
    {
      id: "ord_9",
      customerId: "cust_3",
      productId: "prod_4",
      quantity: 1,
      total: 29.99,
      status: "pending",
      date: "2024-01-23",
    },
    {
      id: "ord_10",
      customerId: "cust_2",
      productId: "prod_1",
      quantity: 3,
      total: 299.97,
      status: "completed",
      date: "2024-01-24",
    },
  ],
  customers: new Map([
    ["cust_1", { name: "Alice Johnson", tier: "premium", state: "CA" }],
    ["cust_2", { name: "Bob Smith", tier: "premium", state: "NY" }],
    ["cust_3", { name: "Charlie Brown", tier: "standard", state: "CA" }],
    ["cust_4", { name: "Diana Ross", tier: "standard", state: "TX" }],
    ["cust_5", { name: "Eve Wilson", tier: "premium", state: "CA" }],
  ]),
  products: new Map([
    [
      "prod_1",
      { name: "Wireless Headphones", category: "electronics", price: 99.99 },
    ],
    ["prod_2", { name: "Phone Case", category: "accessories", price: 29.99 }],
    ["prod_3", { name: "Smart Watch", category: "electronics", price: 899.99 }],
    ["prod_4", { name: "USB Cable", category: "accessories", price: 29.99 }],
    [
      "prod_5",
      { name: "Screen Protector", category: "accessories", price: 24.99 },
    ],
  ]),
};

// Shell tools that return rich data for piping

const listOrders = createShellTool({
  description: "List all orders with customer and product details embedded",
  inputSchema: z.object({
    status: z
      .string()
      .optional()
      .describe("Filter by status: completed, pending, refunded"),
  }),
  outputSchema: z.object({
    orders: z.array(
      z.object({
        id: z.string(),
        customer: z.object({
          id: z.string(),
          name: z.string(),
          tier: z.string(),
          state: z.string(),
        }),
        product: z.object({
          id: z.string(),
          name: z.string(),
          category: z.string(),
        }),
        quantity: z.number(),
        total: z.number(),
        status: z.string(),
        date: z.string(),
      }),
    ),
  }),
  execute: async ({ status }) => {
    const orders = db.orders
      .filter((o) => !status || o.status === status)
      .map((o) => {
        const customer = db.customers.get(o.customerId)!;
        const product = db.products.get(o.productId)!;
        return {
          id: o.id,
          customer: {
            id: o.customerId,
            name: customer.name,
            tier: customer.tier,
            state: customer.state,
          },
          product: {
            id: o.productId,
            name: product.name,
            category: product.category,
          },
          quantity: o.quantity,
          total: o.total,
          status: o.status,
          date: o.date,
        };
      });
    return { orders };
  },
});

const listCustomers = createShellTool({
  description: "List all customers",
  inputSchema: z.object({
    tier: z.string().optional().describe("Filter by tier: premium, standard"),
    state: z.string().optional().describe("Filter by state code"),
  }),
  outputSchema: z.object({
    customers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        tier: z.string(),
        state: z.string(),
      }),
    ),
  }),
  execute: async ({ tier, state }) => {
    const customers = Array.from(db.customers.entries())
      .filter(
        ([_, c]) => (!tier || c.tier === tier) && (!state || c.state === state),
      )
      .map(([id, c]) => ({ id, name: c.name, tier: c.tier, state: c.state }));
    return { customers };
  },
});

const listProducts = createShellTool({
  description: "List all products",
  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe("Filter by category: electronics, accessories"),
  }),
  outputSchema: z.object({
    products: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        price: z.number(),
      }),
    ),
  }),
  execute: async ({ category }) => {
    const products = Array.from(db.products.entries())
      .filter(([_, p]) => !category || p.category === category)
      .map(([id, p]) => ({
        id,
        name: p.name,
        category: p.category,
        price: p.price,
      }));
    return { products };
  },
});

async function main() {
  console.log("Creating bash tool with e-commerce shell tools...\n");

  const { tools } = await createBashTool({
    shellTools: {
      listOrders,
      listCustomers,
      listProducts,
    },
  });

  console.log(
    "Shell tools registered. Agent can use jq to chain operations.\n",
  );

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful analytics assistant. Use the bash tool to query data.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if (call.toolName === "bash" && "input" in call) {
            const input = call.input as { command: string };
            console.log(`> ${input.command}`);
          }
        }
      }
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          if (result.toolName === "bash" && "output" in result) {
            const output = result.output as { stdout: string; stderr: string };
            if (output.stdout) console.log(output.stdout.slice(0, 800));
            if (output.stderr) console.log(`Error: ${output.stderr}`);
          }
        }
        console.log("");
      }
    },
  });

  // This query requires: filter by status, filter by customer tier, filter by state, sum totals
  // With shell tools + jq: can be done in ONE command
  // With regular tools: would need multiple LLM round-trips
  const prompt =
    "What's the total revenue from completed orders placed by premium customers in California?";

  console.log(`Prompt: "${prompt}"\n`);
  console.log("---");

  const result = await agent.generate({ prompt });

  console.log("---\n");
  console.log("=== Final Response ===\n");
  console.log(result.text);

  console.log("\n=== Agent Stats ===");
  console.log(`Steps: ${result.steps.length}`);
  console.log(`Total tokens: ${result.usage.totalTokens}`);
}

main().catch(console.error);
