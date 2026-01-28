/**
 * Many Tools Shell Tools Evaluation
 *
 * Tests shell tools with 15 CRM operations.
 * This scenario tests token efficiency: 15 tools via single bash tool
 * vs 15 separate AI SDK tools.
 *
 * Run with: npx tsx examples/shell-tools/evals/many-tools.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
import {
  createBashTool,
  experimental_createShellTool as createShellTool,
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
} from "../many-tools/shared.js";
import {
  createStepHandler,
  type RunResult,
  runComparison,
  type ToolCall,
} from "./utils.js";

// ============ Shell Tools Version ============

async function runShellToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  // Customer tools
  const getCustomer = createShellTool({
    description: descriptions.getCustomer,
    inputSchema: getCustomerInputSchema,
    outputSchema: getCustomerOutputSchema,
    execute: executeGetCustomer,
  });

  const listCustomers = createShellTool({
    description: descriptions.listCustomers,
    inputSchema: listCustomersInputSchema,
    outputSchema: listCustomersOutputSchema,
    execute: executeListCustomers,
  });

  const searchCustomers = createShellTool({
    description: descriptions.searchCustomers,
    inputSchema: searchCustomersInputSchema,
    outputSchema: searchCustomersOutputSchema,
    execute: executeSearchCustomers,
  });

  // Contact tools
  const getContact = createShellTool({
    description: descriptions.getContact,
    inputSchema: getContactInputSchema,
    outputSchema: getContactOutputSchema,
    execute: executeGetContact,
  });

  const listContacts = createShellTool({
    description: descriptions.listContacts,
    inputSchema: listContactsInputSchema,
    outputSchema: listContactsOutputSchema,
    execute: executeListContacts,
  });

  // Deal tools
  const getDeal = createShellTool({
    description: descriptions.getDeal,
    inputSchema: getDealInputSchema,
    outputSchema: getDealOutputSchema,
    execute: executeGetDeal,
  });

  const listDeals = createShellTool({
    description: descriptions.listDeals,
    inputSchema: listDealsInputSchema,
    outputSchema: listDealsOutputSchema,
    execute: executeListDeals,
  });

  // Task tools
  const getTask = createShellTool({
    description: descriptions.getTask,
    inputSchema: getTaskInputSchema,
    outputSchema: getTaskOutputSchema,
    execute: executeGetTask,
  });

  const listTasks = createShellTool({
    description: descriptions.listTasks,
    inputSchema: listTasksInputSchema,
    outputSchema: listTasksOutputSchema,
    execute: executeListTasks,
  });

  // Note tools
  const listNotes = createShellTool({
    description: descriptions.listNotes,
    inputSchema: listNotesInputSchema,
    outputSchema: listNotesOutputSchema,
    execute: executeListNotes,
  });

  // Activity tools
  const listActivities = createShellTool({
    description: descriptions.listActivities,
    inputSchema: listActivitiesInputSchema,
    outputSchema: listActivitiesOutputSchema,
    execute: executeListActivities,
  });

  // Invoice tools
  const getInvoice = createShellTool({
    description: descriptions.getInvoice,
    inputSchema: getInvoiceInputSchema,
    outputSchema: getInvoiceOutputSchema,
    execute: executeGetInvoice,
  });

  const listInvoices = createShellTool({
    description: descriptions.listInvoices,
    inputSchema: listInvoicesInputSchema,
    outputSchema: listInvoicesOutputSchema,
    execute: executeListInvoices,
  });

  // Product tools
  const getProduct = createShellTool({
    description: descriptions.getProduct,
    inputSchema: getProductInputSchema,
    outputSchema: getProductOutputSchema,
    execute: executeGetProduct,
  });

  const listProducts = createShellTool({
    description: descriptions.listProducts,
    inputSchema: listProductsInputSchema,
    outputSchema: listProductsOutputSchema,
    execute: executeListProducts,
  });

  const { tools } = await createBashTool({
    shellTools: {
      getCustomer,
      listCustomers,
      searchCustomers,
      getContact,
      listContacts,
      getDeal,
      listDeals,
      getTask,
      listTasks,
      listNotes,
      listActivities,
      getInvoice,
      listInvoices,
      getProduct,
      listProducts,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful CRM assistant. Use the bash tool to help users with their requests.",
    onStepFinish: createStepHandler(calls),
  });

  const start = Date.now();
  const result = await agent.generate({ prompt });
  const duration = Date.now() - start;

  return {
    calls,
    response: result.text,
    tokens: result.usage.totalTokens ?? 0,
    steps: result.steps?.length ?? 0,
    duration,
  };
}

// ============ Baseline Version ============

async function runBaselineVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  // Customer tools
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

  // Contact tools
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

  // Deal tools
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

  // Task tools
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

  // Note tools
  const listNotes = tool({
    description: descriptions.listNotes,
    inputSchema: listNotesInputSchema,
    execute: executeListNotes,
  });

  // Activity tools
  const listActivities = tool({
    description: descriptions.listActivities,
    inputSchema: listActivitiesInputSchema,
    execute: executeListActivities,
  });

  // Invoice tools
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

  // Product tools
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

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      getCustomer,
      listCustomers,
      searchCustomers,
      getContact,
      listContacts,
      getDeal,
      listDeals,
      getTask,
      listTasks,
      listNotes,
      listActivities,
      getInvoice,
      listInvoices,
      getProduct,
      listProducts,
    },
    instructions:
      "You are a helpful CRM assistant. Use the available tools to help users with their requests.",
    onStepFinish: createStepHandler(calls),
  });

  const start = Date.now();
  const result = await agent.generate({ prompt });
  const duration = Date.now() - start;

  return {
    calls,
    response: result.text,
    tokens: result.usage.totalTokens ?? 0,
    steps: result.steps?.length ?? 0,
    duration,
  };
}

// ============ Main ============

async function main() {
  await runComparison({
    name: "Many Tools Shell Tools Example",
    prompt,
    runShellTools: runShellToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      // The prompt asks about Acme Corp summary
      requiredResponseTerms: ["acme", "contacts", "deals"],
    },
    outputPath: "examples/shell-tools/evals/data/many-tools-output.json",
  });
}

main().catch(console.error);
