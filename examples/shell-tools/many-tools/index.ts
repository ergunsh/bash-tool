/**
 * Example: Shell Tools with Many Commands
 *
 * This example demonstrates where shell tools shine: when you have many
 * related operations. Instead of 15+ separate AI SDK tools, they're all
 * exposed through a single bash tool with compact descriptions.
 *
 * Run with: npx tsx examples/shell-tools/many-tools/index.ts
 */

import { ToolLoopAgent } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
} from "../../../src/index.js";

// Mock CRM database
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

const getCustomer = createShellTool({
  description: "Get customer details by ID",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    tier: z.string(),
  }),
  execute: async ({ id }) => {
    const customer = db.customers.get(id);
    if (!customer) throw new Error(`Customer not found: ${id}`);
    return { id, ...customer };
  },
});

const listCustomers = createShellTool({
  description: "List all customers",
  inputSchema: z.object({ tier: z.string().optional() }),
  outputSchema: z.object({
    customers: z.array(
      z.object({ id: z.string(), name: z.string(), tier: z.string() }),
    ),
  }),
  execute: async ({ tier }) => {
    const customers = Array.from(db.customers.entries())
      .filter(([_, c]) => !tier || c.tier === tier)
      .map(([id, c]) => ({ id, name: c.name, tier: c.tier }));
    return { customers };
  },
});

const searchCustomers = createShellTool({
  description: "Search customers by name",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({
    results: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  execute: async ({ query }) => {
    const results = Array.from(db.customers.entries())
      .filter(([_, c]) => c.name.toLowerCase().includes(query.toLowerCase()))
      .map(([id, c]) => ({ id, name: c.name }));
    return { results };
  },
});

// ============ Contact Tools ============

const getContact = createShellTool({
  description: "Get contact details",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    email: z.string(),
    customerId: z.string(),
  }),
  execute: async ({ id }) => {
    const contact = db.contacts.get(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);
    return { id, ...contact };
  },
});

const listContacts = createShellTool({
  description: "List contacts for a customer",
  inputSchema: z.object({ customerId: z.string() }),
  outputSchema: z.object({
    contacts: z.array(
      z.object({ id: z.string(), name: z.string(), role: z.string() }),
    ),
  }),
  execute: async ({ customerId }) => {
    const contacts = Array.from(db.contacts.entries())
      .filter(([_, c]) => c.customerId === customerId)
      .map(([id, c]) => ({ id, name: c.name, role: c.role }));
    return { contacts };
  },
});

// ============ Deal Tools ============

const getDeal = createShellTool({
  description: "Get deal details",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    customerId: z.string(),
    value: z.number(),
    stage: z.string(),
    product: z.string(),
  }),
  execute: async ({ id }) => {
    const deal = db.deals.get(id);
    if (!deal) throw new Error(`Deal not found: ${id}`);
    return { id, ...deal };
  },
});

const listDeals = createShellTool({
  description: "List deals, optionally filtered by customer or stage",
  inputSchema: z.object({
    customerId: z.string().optional(),
    stage: z.string().optional(),
  }),
  outputSchema: z.object({
    deals: z.array(
      z.object({ id: z.string(), value: z.number(), stage: z.string() }),
    ),
    totalValue: z.number(),
  }),
  execute: async ({ customerId, stage }) => {
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

const getTask = createShellTool({
  description: "Get task details",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    customerId: z.string(),
    title: z.string(),
    dueDate: z.string(),
    status: z.string(),
  }),
  execute: async ({ id }) => {
    const task = db.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return { id, ...task };
  },
});

const listTasks = createShellTool({
  description: "List tasks for a customer",
  inputSchema: z.object({
    customerId: z.string(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    tasks: z.array(
      z.object({ id: z.string(), title: z.string(), status: z.string() }),
    ),
  }),
  execute: async ({ customerId, status }) => {
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

const listNotes = createShellTool({
  description: "List notes for a customer",
  inputSchema: z.object({ customerId: z.string() }),
  outputSchema: z.object({
    notes: z.array(
      z.object({ id: z.string(), content: z.string(), createdAt: z.string() }),
    ),
  }),
  execute: async ({ customerId }) => {
    const notes = Array.from(db.notes.entries())
      .filter(([_, n]) => n.customerId === customerId)
      .map(([id, n]) => ({ id, content: n.content, createdAt: n.createdAt }));
    return { notes };
  },
});

// ============ Activity Tools ============

const listActivities = createShellTool({
  description: "List activities for a customer",
  inputSchema: z.object({
    customerId: z.string(),
    type: z.string().optional(),
  }),
  outputSchema: z.object({
    activities: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        description: z.string(),
        date: z.string(),
      }),
    ),
  }),
  execute: async ({ customerId, type }) => {
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

const getInvoice = createShellTool({
  description: "Get invoice details",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.number(),
    status: z.string(),
    dueDate: z.string(),
  }),
  execute: async ({ id }) => {
    const invoice = db.invoices.get(id);
    if (!invoice) throw new Error(`Invoice not found: ${id}`);
    return { id, ...invoice };
  },
});

const listInvoices = createShellTool({
  description: "List invoices for a customer",
  inputSchema: z.object({
    customerId: z.string(),
    status: z.string().optional(),
  }),
  outputSchema: z.object({
    invoices: z.array(
      z.object({ id: z.string(), amount: z.number(), status: z.string() }),
    ),
    total: z.number(),
  }),
  execute: async ({ customerId, status }) => {
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

const getProduct = createShellTool({
  description: "Get product details",
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    features: z.array(z.string()),
  }),
  execute: async ({ id }) => {
    const product = db.products.get(id);
    if (!product) throw new Error(`Product not found: ${id}`);
    return { id, ...product };
  },
});

const listProducts = createShellTool({
  description: "List all products",
  inputSchema: z.object({}),
  outputSchema: z.object({
    products: z.array(
      z.object({ id: z.string(), name: z.string(), price: z.number() }),
    ),
  }),
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
  console.log("Creating bash tool with 15 CRM shell tools...\n");

  const { tools } = await createBashTool({
    shellTools: {
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
  });

  console.log("15 shell tools registered via single bash tool.\n");

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful CRM assistant. Use the bash tool to help users with their requests.",
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
            if (output.stdout) console.log(output.stdout.slice(0, 500));
            if (output.stderr) console.log(`Error: ${output.stderr}`);
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
