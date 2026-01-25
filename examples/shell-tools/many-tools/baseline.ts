/**
 * Baseline: Regular AI SDK tools (15 separate tools)
 *
 * This example uses regular AI SDK tools for the same CRM use case.
 * Used for testing alongside the shell tools version in index.ts.
 *
 * Run with: npx tsx examples/shell-tools/many-tools/baseline.ts
 */

import { ToolLoopAgent, tool } from "ai";
import {
  descriptions,
  executeGetContact,
  executeGetCustomer,
  executeGetDeal,
  executeGetInvoice,
  executeGetProduct,
  executeGetTask,
  executeListActivities,
  executeListContacts,
  executeListCustomers,
  executeListDeals,
  executeListInvoices,
  executeListNotes,
  executeListProducts,
  executeListTasks,
  executeSearchCustomers,
  getContactInputSchema,
  getCustomerInputSchema,
  getDealInputSchema,
  getInvoiceInputSchema,
  getProductInputSchema,
  getTaskInputSchema,
  listActivitiesInputSchema,
  listContactsInputSchema,
  listCustomersInputSchema,
  listDealsInputSchema,
  listInvoicesInputSchema,
  listNotesInputSchema,
  listProductsInputSchema,
  listTasksInputSchema,
  prompt,
  searchCustomersInputSchema,
} from "./shared.js";

// ============ Customer Tools ============

const getCustomer = tool({
  description: descriptions.getCustomer,
  inputSchema: getCustomerInputSchema,
  execute: executeGetCustomer,
});

const listCustomers = tool({
  description: descriptions.listCustomers,
  inputSchema: listCustomersInputSchema,
  execute: executeListCustomers,
});

const searchCustomers = tool({
  description: descriptions.searchCustomers,
  inputSchema: searchCustomersInputSchema,
  execute: executeSearchCustomers,
});

// ============ Contact Tools ============

const getContact = tool({
  description: descriptions.getContact,
  inputSchema: getContactInputSchema,
  execute: executeGetContact,
});

const listContacts = tool({
  description: descriptions.listContacts,
  inputSchema: listContactsInputSchema,
  execute: executeListContacts,
});

// ============ Deal Tools ============

const getDeal = tool({
  description: descriptions.getDeal,
  inputSchema: getDealInputSchema,
  execute: executeGetDeal,
});

const listDeals = tool({
  description: descriptions.listDeals,
  inputSchema: listDealsInputSchema,
  execute: executeListDeals,
});

// ============ Task Tools ============

const getTask = tool({
  description: descriptions.getTask,
  inputSchema: getTaskInputSchema,
  execute: executeGetTask,
});

const listTasks = tool({
  description: descriptions.listTasks,
  inputSchema: listTasksInputSchema,
  execute: executeListTasks,
});

// ============ Note Tools ============

const listNotes = tool({
  description: descriptions.listNotes,
  inputSchema: listNotesInputSchema,
  execute: executeListNotes,
});

// ============ Activity Tools ============

const listActivities = tool({
  description: descriptions.listActivities,
  inputSchema: listActivitiesInputSchema,
  execute: executeListActivities,
});

// ============ Invoice Tools ============

const getInvoice = tool({
  description: descriptions.getInvoice,
  inputSchema: getInvoiceInputSchema,
  execute: executeGetInvoice,
});

const listInvoices = tool({
  description: descriptions.listInvoices,
  inputSchema: listInvoicesInputSchema,
  execute: executeListInvoices,
});

// ============ Product Tools ============

const getProduct = tool({
  description: descriptions.getProduct,
  inputSchema: getProductInputSchema,
  execute: executeGetProduct,
});

const listProducts = tool({
  description: descriptions.listProducts,
  inputSchema: listProductsInputSchema,
  execute: executeListProducts,
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
