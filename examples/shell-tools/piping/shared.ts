/**
 * Shared tool definitions for piping example.
 *
 * This scenario tests multi-step pipeline where shell tools can chain:
 * 1. Get order IDs for a customer
 * 2. Fetch each order's details
 * 3. Sum the totals
 *
 * Baseline: Multiple round-trips (list IDs, then fetch each order)
 * Shell tools: One bash call with for-loop chaining
 */

import { z } from "zod";

// ============ Mock Database ============

export const db = {
  orders: [
    {
      id: "ord_1",
      customerId: "cust_1",
      total: 199.98,
      status: "completed",
      date: "2024-01-15",
    },
    {
      id: "ord_2",
      customerId: "cust_2",
      total: 899.99,
      status: "completed",
      date: "2024-01-16",
    },
    {
      id: "ord_3",
      customerId: "cust_1",
      total: 89.97,
      status: "pending",
      date: "2024-01-17",
    },
    {
      id: "ord_4",
      customerId: "cust_3",
      total: 99.99,
      status: "completed",
      date: "2024-01-18",
    },
    {
      id: "ord_5",
      customerId: "cust_1",
      total: 124.95,
      status: "completed",
      date: "2024-01-21",
    },
  ],
  customers: new Map([
    ["cust_1", { name: "Alice Johnson" }],
    ["cust_2", { name: "Bob Smith" }],
    ["cust_3", { name: "Charlie Brown" }],
  ]),
};

// ============ Shared Schemas ============

export const listOrderIdsInputSchema = z.object({
  customerId: z.string().describe("The customer ID to get orders for"),
});

export const listOrderIdsOutputSchema = z.object({
  orderIds: z.array(z.string()),
  count: z.number(),
});

export const getOrderInputSchema = z.object({
  id: z.string().describe("The order ID"),
});

export const getOrderOutputSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.string(),
  date: z.string(),
});

// ============ Shared Execute Functions ============

export async function executeListOrderIds({
  customerId,
}: z.infer<typeof listOrderIdsInputSchema>) {
  const orderIds = db.orders
    .filter((o) => o.customerId === customerId)
    .map((o) => o.id);
  return { orderIds, count: orderIds.length };
}

export async function executeGetOrder({
  id,
}: z.infer<typeof getOrderInputSchema>) {
  const order = db.orders.find((o) => o.id === id);
  if (!order) throw new Error(`Order not found: ${id}`);
  return {
    id: order.id,
    customerId: order.customerId,
    total: order.total,
    status: order.status,
    date: order.date,
  };
}

// ============ Tool Descriptions ============

export const descriptions = {
  listOrderIds: "Get all order IDs for a customer",
  getOrder: "Get order details by ID",
};

// ============ Prompt ============

// This requires: 1) list IDs, 2) fetch each order, 3) sum totals
// Baseline: 1 + N calls where N = number of orders (4 calls for cust_1)
// Shell tools: 1 bash call with for-loop
export const prompt =
  "What's the total amount spent by customer cust_1? Show each order and the total.";
