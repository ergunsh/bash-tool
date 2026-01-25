/**
 * Shared tool definitions for many-tools example.
 *
 * This module defines schemas and execute functions once,
 * which are then used to create both shell tools and AI SDK tools.
 */

import { z } from "zod";

// ============ Mock Database ============

export const db = {
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

// ============ Customer Schemas ============

export const getCustomerInputSchema = z.object({ id: z.string() });
export const getCustomerOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  tier: z.string(),
});

export const listCustomersInputSchema = z.object({
  tier: z.string().optional(),
});
export const listCustomersOutputSchema = z.object({
  customers: z.array(
    z.object({ id: z.string(), name: z.string(), tier: z.string() }),
  ),
});

export const searchCustomersInputSchema = z.object({ query: z.string() });
export const searchCustomersOutputSchema = z.object({
  results: z.array(z.object({ id: z.string(), name: z.string() })),
});

// ============ Contact Schemas ============

export const getContactInputSchema = z.object({ id: z.string() });
export const getContactOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  email: z.string(),
  customerId: z.string(),
});

export const listContactsInputSchema = z.object({ customerId: z.string() });
export const listContactsOutputSchema = z.object({
  contacts: z.array(
    z.object({ id: z.string(), name: z.string(), role: z.string() }),
  ),
});

// ============ Deal Schemas ============

export const getDealInputSchema = z.object({ id: z.string() });
export const getDealOutputSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  value: z.number(),
  stage: z.string(),
  product: z.string(),
});

export const listDealsInputSchema = z.object({
  customerId: z.string().optional(),
  stage: z.string().optional(),
});
export const listDealsOutputSchema = z.object({
  deals: z.array(
    z.object({ id: z.string(), value: z.number(), stage: z.string() }),
  ),
  totalValue: z.number(),
});

// ============ Task Schemas ============

export const getTaskInputSchema = z.object({ id: z.string() });
export const getTaskOutputSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  title: z.string(),
  dueDate: z.string(),
  status: z.string(),
});

export const listTasksInputSchema = z.object({
  customerId: z.string(),
  status: z.string().optional(),
});
export const listTasksOutputSchema = z.object({
  tasks: z.array(
    z.object({ id: z.string(), title: z.string(), status: z.string() }),
  ),
});

// ============ Note Schemas ============

export const listNotesInputSchema = z.object({ customerId: z.string() });
export const listNotesOutputSchema = z.object({
  notes: z.array(
    z.object({ id: z.string(), content: z.string(), createdAt: z.string() }),
  ),
});

// ============ Activity Schemas ============

export const listActivitiesInputSchema = z.object({
  customerId: z.string(),
  type: z.string().optional(),
});
export const listActivitiesOutputSchema = z.object({
  activities: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      date: z.string(),
    }),
  ),
});

// ============ Invoice Schemas ============

export const getInvoiceInputSchema = z.object({ id: z.string() });
export const getInvoiceOutputSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.number(),
  status: z.string(),
  dueDate: z.string(),
});

export const listInvoicesInputSchema = z.object({
  customerId: z.string(),
  status: z.string().optional(),
});
export const listInvoicesOutputSchema = z.object({
  invoices: z.array(
    z.object({ id: z.string(), amount: z.number(), status: z.string() }),
  ),
  total: z.number(),
});

// ============ Product Schemas ============

export const getProductInputSchema = z.object({ id: z.string() });
export const getProductOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  features: z.array(z.string()),
});

export const listProductsInputSchema = z.object({});
export const listProductsOutputSchema = z.object({
  products: z.array(
    z.object({ id: z.string(), name: z.string(), price: z.number() }),
  ),
});

// ============ Execute Functions ============

export async function executeGetCustomer({
  id,
}: z.infer<typeof getCustomerInputSchema>) {
  const customer = db.customers.get(id);
  if (!customer) throw new Error(`Customer not found: ${id}`);
  return { id, ...customer };
}

export async function executeListCustomers({
  tier,
}: z.infer<typeof listCustomersInputSchema>) {
  const customers = Array.from(db.customers.entries())
    .filter(([_, c]) => !tier || c.tier === tier)
    .map(([id, c]) => ({ id, name: c.name, tier: c.tier }));
  return { customers };
}

export async function executeSearchCustomers({
  query,
}: z.infer<typeof searchCustomersInputSchema>) {
  const results = Array.from(db.customers.entries())
    .filter(([_, c]) => c.name.toLowerCase().includes(query.toLowerCase()))
    .map(([id, c]) => ({ id, name: c.name }));
  return { results };
}

export async function executeGetContact({
  id,
}: z.infer<typeof getContactInputSchema>) {
  const contact = db.contacts.get(id);
  if (!contact) throw new Error(`Contact not found: ${id}`);
  return { id, ...contact };
}

export async function executeListContacts({
  customerId,
}: z.infer<typeof listContactsInputSchema>) {
  const contacts = Array.from(db.contacts.entries())
    .filter(([_, c]) => c.customerId === customerId)
    .map(([id, c]) => ({ id, name: c.name, role: c.role }));
  return { contacts };
}

export async function executeGetDeal({
  id,
}: z.infer<typeof getDealInputSchema>) {
  const deal = db.deals.get(id);
  if (!deal) throw new Error(`Deal not found: ${id}`);
  return { id, ...deal };
}

export async function executeListDeals({
  customerId,
  stage,
}: z.infer<typeof listDealsInputSchema>) {
  const deals = Array.from(db.deals.entries())
    .filter(
      ([_, d]) =>
        (!customerId || d.customerId === customerId) &&
        (!stage || d.stage === stage),
    )
    .map(([id, d]) => ({ id, value: d.value, stage: d.stage }));
  return { deals, totalValue: deals.reduce((sum, d) => sum + d.value, 0) };
}

export async function executeGetTask({
  id,
}: z.infer<typeof getTaskInputSchema>) {
  const task = db.tasks.get(id);
  if (!task) throw new Error(`Task not found: ${id}`);
  return { id, ...task };
}

export async function executeListTasks({
  customerId,
  status,
}: z.infer<typeof listTasksInputSchema>) {
  const tasks = Array.from(db.tasks.entries())
    .filter(
      ([_, t]) =>
        t.customerId === customerId && (!status || t.status === status),
    )
    .map(([id, t]) => ({ id, title: t.title, status: t.status }));
  return { tasks };
}

export async function executeListNotes({
  customerId,
}: z.infer<typeof listNotesInputSchema>) {
  const notes = Array.from(db.notes.entries())
    .filter(([_, n]) => n.customerId === customerId)
    .map(([id, n]) => ({ id, content: n.content, createdAt: n.createdAt }));
  return { notes };
}

export async function executeListActivities({
  customerId,
  type,
}: z.infer<typeof listActivitiesInputSchema>) {
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
}

export async function executeGetInvoice({
  id,
}: z.infer<typeof getInvoiceInputSchema>) {
  const invoice = db.invoices.get(id);
  if (!invoice) throw new Error(`Invoice not found: ${id}`);
  return { id, ...invoice };
}

export async function executeListInvoices({
  customerId,
  status,
}: z.infer<typeof listInvoicesInputSchema>) {
  const invoices = Array.from(db.invoices.entries())
    .filter(
      ([_, i]) =>
        i.customerId === customerId && (!status || i.status === status),
    )
    .map(([id, i]) => ({ id, amount: i.amount, status: i.status }));
  return { invoices, total: invoices.reduce((sum, i) => sum + i.amount, 0) };
}

export async function executeGetProduct({
  id,
}: z.infer<typeof getProductInputSchema>) {
  const product = db.products.get(id);
  if (!product) throw new Error(`Product not found: ${id}`);
  return { id, ...product };
}

export async function executeListProducts() {
  const products = Array.from(db.products.entries()).map(([id, p]) => ({
    id,
    name: p.name,
    price: p.price,
  }));
  return { products };
}

// ============ Tool Descriptions ============

export const descriptions = {
  getCustomer: "Get customer details by ID",
  listCustomers: "List all customers",
  searchCustomers: "Search customers by name",
  getContact: "Get contact details",
  listContacts: "List contacts for a customer",
  getDeal: "Get deal details",
  listDeals: "List deals, optionally filtered by customer or stage",
  getTask: "Get task details",
  listTasks: "List tasks for a customer",
  listNotes: "List notes for a customer",
  listActivities: "List activities for a customer",
  getInvoice: "Get invoice details",
  listInvoices: "List invoices for a customer",
  getProduct: "Get product details",
  listProducts: "List all products",
};

// ============ Prompt ============

export const prompt =
  "Give me a summary of Acme Corp - their contacts, open deals, and recent activities.";
