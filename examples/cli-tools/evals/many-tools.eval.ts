/**
 * Many Tools CLI Tools Evaluation
 *
 * Tests CLI tools with 15 CRM operations.
 * This scenario tests token efficiency: 15 tools via single bash tool
 * vs 15 separate AI SDK tools.
 *
 * Run with: npx tsx examples/cli-tools/evals/many-tools.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
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
} from "../many-tools/shared.js";
import {
  createStepHandler,
  type RunResult,
  runComparison,
  type ToolCall,
} from "./utils.js";

// ============ CLI Tools Version ============

async function runCliToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  // Customer tools
  const getCustomer = createCliTool({
    description: descriptions.getCustomer,
    inputSchema: getCustomerInputSchema,
    execute: executeGetCustomer,
  });

  const listCustomers = createCliTool({
    description: descriptions.listCustomers,
    inputSchema: listCustomersInputSchema,
    execute: executeListCustomers,
  });

  const searchCustomers = createCliTool({
    description: descriptions.searchCustomers,
    inputSchema: searchCustomersInputSchema,
    execute: executeSearchCustomers,
  });

  // Contact tools
  const getContact = createCliTool({
    description: descriptions.getContact,
    inputSchema: getContactInputSchema,
    execute: executeGetContact,
  });

  const listContacts = createCliTool({
    description: descriptions.listContacts,
    inputSchema: listContactsInputSchema,
    execute: executeListContacts,
  });

  // Deal tools
  const getDeal = createCliTool({
    description: descriptions.getDeal,
    inputSchema: getDealInputSchema,
    execute: executeGetDeal,
  });

  const listDeals = createCliTool({
    description: descriptions.listDeals,
    inputSchema: listDealsInputSchema,
    execute: executeListDeals,
  });

  // Task tools
  const getTask = createCliTool({
    description: descriptions.getTask,
    inputSchema: getTaskInputSchema,
    execute: executeGetTask,
  });

  const listTasks = createCliTool({
    description: descriptions.listTasks,
    inputSchema: listTasksInputSchema,
    execute: executeListTasks,
  });

  // Note tools
  const listNotes = createCliTool({
    description: descriptions.listNotes,
    inputSchema: listNotesInputSchema,
    execute: executeListNotes,
  });

  // Activity tools
  const listActivities = createCliTool({
    description: descriptions.listActivities,
    inputSchema: listActivitiesInputSchema,
    execute: executeListActivities,
  });

  // Invoice tools
  const getInvoice = createCliTool({
    description: descriptions.getInvoice,
    inputSchema: getInvoiceInputSchema,
    execute: executeGetInvoice,
  });

  const listInvoices = createCliTool({
    description: descriptions.listInvoices,
    inputSchema: listInvoicesInputSchema,
    execute: executeListInvoices,
  });

  // Product tools
  const getProduct = createCliTool({
    description: descriptions.getProduct,
    inputSchema: getProductInputSchema,
    execute: executeGetProduct,
  });

  const listProducts = createCliTool({
    description: descriptions.listProducts,
    inputSchema: listProductsInputSchema,
    execute: executeListProducts,
  });

  const { tools } = await createBashTool({
    cliTools: {
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
    name: "Many Tools CLI Tools Example",
    prompt,
    runCliTools: runCliToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      // The prompt asks about Acme Corp summary
      requiredResponseTerms: ["acme", "contacts", "deals"],
    },
    outputPath: "examples/cli-tools/evals/data/many-tools-output.json",
  });
}

main().catch(console.error);
