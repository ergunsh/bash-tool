/**
 * Baseline: Regular AI SDK tools (no piping)
 *
 * With regular tools, complex queries require multiple LLM round-trips
 * because the LLM must process and filter data between calls.
 *
 * Run with: npx tsx examples/shell-tools/piping/baseline.ts
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";

// Mock e-commerce database (same as shell tools example)
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

// Regular AI SDK tools - note how they return raw data that needs LLM processing

const listOrdersSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by status: completed, pending, refunded"),
});
const listOrders = tool({
  description:
    "List all orders. Returns order data with customer and product IDs.",
  inputSchema: listOrdersSchema,
  execute: async ({ status }: z.infer<typeof listOrdersSchema>) => {
    const orders = db.orders
      .filter((o) => !status || o.status === status)
      .map((o) => ({
        id: o.id,
        customerId: o.customerId,
        productId: o.productId,
        quantity: o.quantity,
        total: o.total,
        status: o.status,
        date: o.date,
      }));
    return { orders };
  },
});

const getCustomerSchema = z.object({
  id: z.string().describe("Customer ID"),
});
const getCustomer = tool({
  description: "Get customer details by ID",
  inputSchema: getCustomerSchema,
  execute: async ({ id }: z.infer<typeof getCustomerSchema>) => {
    const customer = db.customers.get(id);
    if (!customer) throw new Error(`Customer not found: ${id}`);
    return { id, ...customer };
  },
});

const listCustomersSchema = z.object({
  tier: z.string().optional().describe("Filter by tier: premium, standard"),
  state: z.string().optional().describe("Filter by state code"),
});
const listCustomers = tool({
  description: "List all customers",
  inputSchema: listCustomersSchema,
  execute: async ({ tier, state }: z.infer<typeof listCustomersSchema>) => {
    const customers = Array.from(db.customers.entries())
      .filter(
        ([_, c]) => (!tier || c.tier === tier) && (!state || c.state === state),
      )
      .map(([id, c]) => ({ id, name: c.name, tier: c.tier, state: c.state }));
    return { customers };
  },
});

const listProductsSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Filter by category: electronics, accessories"),
});
const listProducts = tool({
  description: "List all products",
  inputSchema: listProductsSchema,
  execute: async ({ category }: z.infer<typeof listProductsSchema>) => {
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
  console.log("Creating agent with regular AI SDK tools (baseline)...\n");

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: {
      listOrders,
      getCustomer,
      listCustomers,
      listProducts,
    },
    instructions:
      "You are a helpful analytics assistant. Use the available tools to query data and answer questions.",
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
          if ("input" in call) {
            console.log(`> ${call.toolName}(${JSON.stringify(call.input)})`);
          }
        }
      }
      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          if ("result" in result) {
            const json = JSON.stringify(result.result, null, 2);
            console.log(json.slice(0, 800));
          }
        }
        console.log("");
      }
    },
  });

  // Same query as shell tools example
  // With regular tools: LLM needs to call listCustomers, then listOrders, then correlate and sum
  // Each step is a separate LLM round-trip
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
