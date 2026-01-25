/**
 * Shared tool definitions for piping example.
 *
 * This module defines schemas and execute functions once,
 * which are then used to create both shell tools and AI SDK tools.
 */

import { z } from "zod";

// ============ Mock Database ============

export const db = {
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

// ============ Shared Schemas ============

export const listOrdersInputSchema = z.object({
  status: z
    .string()
    .optional()
    .describe("Filter by status: completed, pending, refunded"),
});

export const listOrdersOutputSchema = z.object({
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
});

export const listCustomersInputSchema = z.object({
  tier: z.string().optional().describe("Filter by tier: premium, standard"),
  state: z.string().optional().describe("Filter by state code"),
});

export const listCustomersOutputSchema = z.object({
  customers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      tier: z.string(),
      state: z.string(),
    }),
  ),
});

export const listProductsInputSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Filter by category: electronics, accessories"),
});

export const listProductsOutputSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      price: z.number(),
    }),
  ),
});

// ============ Shared Execute Functions ============

export async function executeListOrders({
  status,
}: z.infer<typeof listOrdersInputSchema>) {
  const orders = db.orders
    .filter((o) => !status || o.status === status)
    .map((o) => {
      const customer = db.customers.get(o.customerId);
      const product = db.products.get(o.productId);
      if (!customer || !product) throw new Error("Data integrity error");
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
}

export async function executeListCustomers({
  tier,
  state,
}: z.infer<typeof listCustomersInputSchema>) {
  const customers = Array.from(db.customers.entries())
    .filter(
      ([_, c]) => (!tier || c.tier === tier) && (!state || c.state === state),
    )
    .map(([id, c]) => ({ id, name: c.name, tier: c.tier, state: c.state }));
  return { customers };
}

export async function executeListProducts({
  category,
}: z.infer<typeof listProductsInputSchema>) {
  const products = Array.from(db.products.entries())
    .filter(([_, p]) => !category || p.category === category)
    .map(([id, p]) => ({
      id,
      name: p.name,
      category: p.category,
      price: p.price,
    }));
  return { products };
}

// ============ Tool Descriptions ============

export const descriptions = {
  listOrders: "List all orders with customer and product details embedded",
  listCustomers: "List all customers",
  listProducts: "List all products",
};

// ============ Prompt ============

export const prompt =
  "What's the total revenue from completed orders placed by premium customers in California?";
