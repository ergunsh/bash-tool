/**
 * Baseline: Regular AI SDK tools (15 separate tools)
 *
 * This example uses regular AI SDK tools for the same CRM use case.
 * Compare token usage with index.ts to see the overhead of many tools.
 *
 * Run with: npx tsx examples/shell-tools/many-tools/baseline.ts
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";

// Mock CRM database (same as shell tools example)
const db = {
  customers: new Map([
    [
      "cust_1",
      { name: "Acme Corp", email: "contact@acme.com", tier: "enterprise" },
    ],
    [
      "cust_2",
      { name: "Startup Inc", email: "hello@startup.io", tier: "growth" },
    ],
    [
      "cust_3",
      { name: "Local Shop", email: "owner@localshop.com", tier: "starter" },
    ],
  ]),
  contacts: new Map([
    [
      "cont_1",
      {
        customerId: "cust_1",
        name: "John Doe",
        role: "CTO",
        email: "john@acme.com",
      },
    ],
    [
      "cont_2",
      {
        customerId: "cust_1",
        name: "Jane Smith",
        role: "CEO",
        email: "jane@acme.com",
      },
    ],
    [
      "cont_3",
      {
        customerId: "cust_2",
        name: "Bob Wilson",
        role: "Founder",
        email: "bob@startup.io",
      },
    ],
  ]),
  deals: new Map([
    [
      "deal_1",
      {
        customerId: "cust_1",
        value: 50000,
        stage: "negotiation",
        product: "Enterprise Plan",
      },
    ],
    [
      "deal_2",
      {
        customerId: "cust_2",
        value: 5000,
        stage: "proposal",
        product: "Growth Plan",
      },
    ],
    [
      "deal_3",
      {
        customerId: "cust_1",
        value: 25000,
        stage: "closed_won",
        product: "Add-on Package",
      },
    ],
  ]),
  tasks: new Map([
    [
      "task_1",
      {
        customerId: "cust_1",
        title: "Follow up on proposal",
        dueDate: "2024-02-01",
        status: "pending",
      },
    ],
    [
      "task_2",
      {
        customerId: "cust_2",
        title: "Schedule demo",
        dueDate: "2024-01-25",
        status: "completed",
      },
    ],
  ]),
  notes: new Map([
    [
      "note_1",
      {
        customerId: "cust_1",
        content: "Very interested in enterprise features",
        createdAt: "2024-01-15",
      },
    ],
    [
      "note_2",
      {
        customerId: "cust_2",
        content: "Budget approved for Q1",
        createdAt: "2024-01-20",
      },
    ],
  ]),
  activities: new Map([
    [
      "act_1",
      {
        customerId: "cust_1",
        type: "call",
        description: "Intro call",
        date: "2024-01-10",
      },
    ],
    [
      "act_2",
      {
        customerId: "cust_1",
        type: "email",
        description: "Sent proposal",
        date: "2024-01-12",
      },
    ],
    [
      "act_3",
      {
        customerId: "cust_2",
        type: "meeting",
        description: "Product demo",
        date: "2024-01-18",
      },
    ],
  ]),
  invoices: new Map([
    [
      "inv_1",
      {
        customerId: "cust_1",
        amount: 25000,
        status: "paid",
        dueDate: "2024-01-01",
      },
    ],
    [
      "inv_2",
      {
        customerId: "cust_3",
        amount: 500,
        status: "pending",
        dueDate: "2024-02-01",
      },
    ],
  ]),
  products: new Map([
    [
      "prod_1",
      {
        name: "Starter Plan",
        price: 99,
        features: ["Basic support", "5 users"],
      },
    ],
    [
      "prod_2",
      {
        name: "Growth Plan",
        price: 499,
        features: ["Priority support", "25 users", "API access"],
      },
    ],
    [
      "prod_3",
      {
        name: "Enterprise Plan",
        price: 2999,
        features: ["24/7 support", "Unlimited users", "Custom integrations"],
      },
    ],
  ]),
};

// ============ Customer Tools ============

const getCustomerSchema = z.object({ id: z.string() });
const getCustomer = tool({
  description: "Get customer details by ID",
  inputSchema: getCustomerSchema,
  execute: async ({ id }: z.infer<typeof getCustomerSchema>) => {
    const customer = db.customers.get(id);
    if (!customer) throw new Error(`Customer not found: ${id}`);
    return { id, ...customer };
  },
});

const listCustomersSchema = z.object({ tier: z.string().optional() });
const listCustomers = tool({
  description: "List all customers",
  inputSchema: listCustomersSchema,
  execute: async ({ tier }: z.infer<typeof listCustomersSchema>) => {
    const customers = Array.from(db.customers.entries())
      .filter(([_, c]) => !tier || c.tier === tier)
      .map(([id, c]) => ({ id, name: c.name, tier: c.tier }));
    return { customers };
  },
});

const searchCustomersSchema = z.object({ query: z.string() });
const searchCustomers = tool({
  description: "Search customers by name",
  inputSchema: searchCustomersSchema,
  execute: async ({ query }: z.infer<typeof searchCustomersSchema>) => {
    const results = Array.from(db.customers.entries())
      .filter(([_, c]) => c.name.toLowerCase().includes(query.toLowerCase()))
      .map(([id, c]) => ({ id, name: c.name }));
    return { results };
  },
});

// ============ Contact Tools ============

const getContactSchema = z.object({ id: z.string() });
const getContact = tool({
  description: "Get contact details",
  inputSchema: getContactSchema,
  execute: async ({ id }: z.infer<typeof getContactSchema>) => {
    const contact = db.contacts.get(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);
    return { id, ...contact };
  },
});

const listContactsSchema = z.object({ customerId: z.string() });
const listContacts = tool({
  description: "List contacts for a customer",
  inputSchema: listContactsSchema,
  execute: async ({ customerId }: z.infer<typeof listContactsSchema>) => {
    const contacts = Array.from(db.contacts.entries())
      .filter(([_, c]) => c.customerId === customerId)
      .map(([id, c]) => ({ id, name: c.name, role: c.role }));
    return { contacts };
  },
});

// ============ Deal Tools ============

const getDealSchema = z.object({ id: z.string() });
const getDeal = tool({
  description: "Get deal details",
  inputSchema: getDealSchema,
  execute: async ({ id }: z.infer<typeof getDealSchema>) => {
    const deal = db.deals.get(id);
    if (!deal) throw new Error(`Deal not found: ${id}`);
    return { id, ...deal };
  },
});

const listDealsSchema = z.object({
  customerId: z.string().optional(),
  stage: z.string().optional(),
});
const listDeals = tool({
  description: "List deals, optionally filtered by customer or stage",
  inputSchema: listDealsSchema,
  execute: async ({ customerId, stage }: z.infer<typeof listDealsSchema>) => {
    const deals = Array.from(db.deals.entries())
      .filter(
        ([_, d]) =>
          (!customerId || d.customerId === customerId) &&
          (!stage || d.stage === stage),
      )
      .map(([id, d]) => ({ id, value: d.value, stage: d.stage }));
    return { deals, totalValue: deals.reduce((sum, d) => sum + d.value, 0) };
  },
});

// ============ Task Tools ============

const getTaskSchema = z.object({ id: z.string() });
const getTask = tool({
  description: "Get task details",
  inputSchema: getTaskSchema,
  execute: async ({ id }: z.infer<typeof getTaskSchema>) => {
    const task = db.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return { id, ...task };
  },
});

const listTasksSchema = z.object({
  customerId: z.string(),
  status: z.string().optional(),
});
const listTasks = tool({
  description: "List tasks for a customer",
  inputSchema: listTasksSchema,
  execute: async ({ customerId, status }: z.infer<typeof listTasksSchema>) => {
    const tasks = Array.from(db.tasks.entries())
      .filter(
        ([_, t]) =>
          t.customerId === customerId && (!status || t.status === status),
      )
      .map(([id, t]) => ({ id, title: t.title, status: t.status }));
    return { tasks };
  },
});

// ============ Note Tools ============

const listNotesSchema = z.object({ customerId: z.string() });
const listNotes = tool({
  description: "List notes for a customer",
  inputSchema: listNotesSchema,
  execute: async ({ customerId }: z.infer<typeof listNotesSchema>) => {
    const notes = Array.from(db.notes.entries())
      .filter(([_, n]) => n.customerId === customerId)
      .map(([id, n]) => ({ id, content: n.content, createdAt: n.createdAt }));
    return { notes };
  },
});

// ============ Activity Tools ============

const listActivitiesSchema = z.object({
  customerId: z.string(),
  type: z.string().optional(),
});
const listActivities = tool({
  description: "List activities for a customer",
  inputSchema: listActivitiesSchema,
  execute: async ({
    customerId,
    type,
  }: z.infer<typeof listActivitiesSchema>) => {
    const activities = Array.from(db.activities.entries())
      .filter(
        ([_, a]) => a.customerId === customerId && (!type || a.type === type),
      )
      .map(([id, a]) => ({
        id,
        type: a.type,
        description: a.description,
        date: a.date,
      }));
    return { activities };
  },
});

// ============ Invoice Tools ============

const getInvoiceSchema = z.object({ id: z.string() });
const getInvoice = tool({
  description: "Get invoice details",
  inputSchema: getInvoiceSchema,
  execute: async ({ id }: z.infer<typeof getInvoiceSchema>) => {
    const invoice = db.invoices.get(id);
    if (!invoice) throw new Error(`Invoice not found: ${id}`);
    return { id, ...invoice };
  },
});

const listInvoicesSchema = z.object({
  customerId: z.string(),
  status: z.string().optional(),
});
const listInvoices = tool({
  description: "List invoices for a customer",
  inputSchema: listInvoicesSchema,
  execute: async ({
    customerId,
    status,
  }: z.infer<typeof listInvoicesSchema>) => {
    const invoices = Array.from(db.invoices.entries())
      .filter(
        ([_, i]) =>
          i.customerId === customerId && (!status || i.status === status),
      )
      .map(([id, i]) => ({ id, amount: i.amount, status: i.status }));
    return { invoices, total: invoices.reduce((sum, i) => sum + i.amount, 0) };
  },
});

// ============ Product Tools ============

const getProductSchema = z.object({ id: z.string() });
const getProduct = tool({
  description: "Get product details",
  inputSchema: getProductSchema,
  execute: async ({ id }: z.infer<typeof getProductSchema>) => {
    const product = db.products.get(id);
    if (!product) throw new Error(`Product not found: ${id}`);
    return { id, ...product };
  },
});

const listProductsSchema = z.object({});
const listProducts = tool({
  description: "List all products",
  inputSchema: listProductsSchema,
  execute: async () => {
    const products = Array.from(db.products.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      price: p.price,
    }));
    return { products };
  },
});

async function main() {
  console.log("Creating agent with 15 regular AI SDK tools (baseline)...\n");

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      // Customers (3)
      getCustomer,
      listCustomers,
      searchCustomers,
      // Contacts (2)
      getContact,
      listContacts,
      // Deals (2)
      getDeal,
      listDeals,
      // Tasks (2)
      getTask,
      listTasks,
      // Notes (1)
      listNotes,
      // Activities (1)
      listActivities,
      // Invoices (2)
      getInvoice,
      listInvoices,
      // Products (2)
      getProduct,
      listProducts,
    },
    instructions:
      "You are a helpful CRM assistant. Use the available tools to help users with their requests.",
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
            console.log(json.slice(0, 500));
          }
        }
        console.log("");
      }
    },
  });

  const prompt =
    "Give me a summary of Acme Corp - their contacts, open deals, and recent activities.";

  console.log("Sending prompt to agent...\n");
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
