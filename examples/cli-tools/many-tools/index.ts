/**
 * Example: CLI Tools with Many Commands
 *
 * This example demonstrates where CLI tools shine: when you have many
 * related operations. Instead of 15+ separate AI SDK tools, they're all
 * exposed through a single bash tool with compact descriptions.
 *
 * Run with: npx tsx examples/cli-tools/many-tools/index.ts
 */

import { ToolLoopAgent } from "ai";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
} from "../../../src/index.js";
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
  getContactOutputSchema,
  getCustomerInputSchema,
  getCustomerOutputSchema,
  getDealInputSchema,
  getDealOutputSchema,
  getInvoiceInputSchema,
  getInvoiceOutputSchema,
  getProductInputSchema,
  getProductOutputSchema,
  getTaskInputSchema,
  getTaskOutputSchema,
  listActivitiesInputSchema,
  listActivitiesOutputSchema,
  listContactsInputSchema,
  listContactsOutputSchema,
  listCustomersInputSchema,
  listCustomersOutputSchema,
  listDealsInputSchema,
  listDealsOutputSchema,
  listInvoicesInputSchema,
  listInvoicesOutputSchema,
  listNotesInputSchema,
  listNotesOutputSchema,
  listProductsInputSchema,
  listProductsOutputSchema,
  listTasksInputSchema,
  listTasksOutputSchema,
  prompt,
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
} from "./shared.js";

// ============ Customer Tools ============

const getCustomer = createCliTool({
  description: descriptions.getCustomer,
  inputSchema: getCustomerInputSchema,
  outputSchema: getCustomerOutputSchema,
  execute: executeGetCustomer,
});

const listCustomers = createCliTool({
  description: descriptions.listCustomers,
  inputSchema: listCustomersInputSchema,
  outputSchema: listCustomersOutputSchema,
  execute: executeListCustomers,
});

const searchCustomers = createCliTool({
  description: descriptions.searchCustomers,
  inputSchema: searchCustomersInputSchema,
  outputSchema: searchCustomersOutputSchema,
  execute: executeSearchCustomers,
});

// ============ Contact Tools ============

const getContact = createCliTool({
  description: descriptions.getContact,
  inputSchema: getContactInputSchema,
  outputSchema: getContactOutputSchema,
  execute: executeGetContact,
});

const listContacts = createCliTool({
  description: descriptions.listContacts,
  inputSchema: listContactsInputSchema,
  outputSchema: listContactsOutputSchema,
  execute: executeListContacts,
});

// ============ Deal Tools ============

const getDeal = createCliTool({
  description: descriptions.getDeal,
  inputSchema: getDealInputSchema,
  outputSchema: getDealOutputSchema,
  execute: executeGetDeal,
});

const listDeals = createCliTool({
  description: descriptions.listDeals,
  inputSchema: listDealsInputSchema,
  outputSchema: listDealsOutputSchema,
  execute: executeListDeals,
});

// ============ Task Tools ============

const getTask = createCliTool({
  description: descriptions.getTask,
  inputSchema: getTaskInputSchema,
  outputSchema: getTaskOutputSchema,
  execute: executeGetTask,
});

const listTasks = createCliTool({
  description: descriptions.listTasks,
  inputSchema: listTasksInputSchema,
  outputSchema: listTasksOutputSchema,
  execute: executeListTasks,
});

// ============ Note Tools ============

const listNotes = createCliTool({
  description: descriptions.listNotes,
  inputSchema: listNotesInputSchema,
  outputSchema: listNotesOutputSchema,
  execute: executeListNotes,
});

// ============ Activity Tools ============

const listActivities = createCliTool({
  description: descriptions.listActivities,
  inputSchema: listActivitiesInputSchema,
  outputSchema: listActivitiesOutputSchema,
  execute: executeListActivities,
});

// ============ Invoice Tools ============

const getInvoice = createCliTool({
  description: descriptions.getInvoice,
  inputSchema: getInvoiceInputSchema,
  outputSchema: getInvoiceOutputSchema,
  execute: executeGetInvoice,
});

const listInvoices = createCliTool({
  description: descriptions.listInvoices,
  inputSchema: listInvoicesInputSchema,
  outputSchema: listInvoicesOutputSchema,
  execute: executeListInvoices,
});

// ============ Product Tools ============

const getProduct = createCliTool({
  description: descriptions.getProduct,
  inputSchema: getProductInputSchema,
  outputSchema: getProductOutputSchema,
  execute: executeGetProduct,
});

const listProducts = createCliTool({
  description: descriptions.listProducts,
  inputSchema: listProductsInputSchema,
  outputSchema: listProductsOutputSchema,
  execute: executeListProducts,
});

async function main() {
  console.log("Creating bash tool with 15 CRM CLI tools...\n");

  const { tools } = await createBashTool({
    cliTools: {
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

  console.log("15 CLI tools registered via single bash tool.\n");

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
