/**
 * Large Data CLI Tools Evaluation
 *
 * Tests CLI tools with large datasets where file-based output is beneficial.
 * The CLI tools save large outputs to files, allowing the model to use
 * jq/grep to extract specific fields instead of processing the full dataset.
 *
 * Scenario: Query a large product catalog and find specific items.
 *
 * Run with: npx tsx examples/cli-tools/evals/large-data.eval.ts
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
  createBashTool,
  experimental_createCliTool as createCliTool,
} from "../../../src/index.js";
import {
  createStepHandler,
  type RunResult,
  runComparison,
  type ToolCall,
} from "./utils.js";

// ============ Large Mock Database ============

// Generate 500 products to create a large dataset
function generateProducts() {
  const categories = [
    "electronics",
    "clothing",
    "home",
    "sports",
    "books",
    "toys",
  ];
  const adjectives = [
    "Premium",
    "Basic",
    "Pro",
    "Ultra",
    "Mini",
    "Max",
    "Elite",
    "Standard",
  ];
  const items = [
    "Widget",
    "Gadget",
    "Device",
    "Tool",
    "Kit",
    "Set",
    "Pack",
    "Bundle",
  ];

  const products: Record<
    string,
    {
      name: string;
      category: string;
      price: number;
      stock: number;
      rating: number;
      description: string;
    }
  > = {};

  // Generate 500 products - enough to make baseline expensive
  for (let i = 1; i <= 500; i++) {
    const adj = adjectives[i % adjectives.length];
    const item = items[Math.floor(i / adjectives.length) % items.length];
    const category = categories[i % categories.length];
    // Prices from $50-$500
    const price = Math.round((50 + Math.random() * 450) * 100) / 100;
    const stock = Math.floor(Math.random() * 1000);
    // Ratings 2.0-4.5 for most products
    const rating = Math.round((2 + Math.random() * 2.5) * 10) / 10;

    products[`prod_${i}`] = {
      name: `${adj} ${item} ${i}`,
      category,
      price,
      stock,
      rating,
      description: `This is a ${adj.toLowerCase()} ${item.toLowerCase()} in the ${category} category. Product ID: prod_${i}. Features include high quality materials, durable construction, and excellent performance. Suitable for both professional and personal use. Additional details: manufactured with care, tested rigorously, backed by warranty.`,
    };
  }

  // Add specific product we'll query for - give it the highest rating
  products.prod_42 = {
    name: "Ultra Wireless Headphones",
    category: "electronics",
    price: 299.99,
    stock: 150,
    rating: 4.9,
    description:
      "Premium wireless headphones with active noise cancellation, 30-hour battery life, and superior sound quality.",
  };

  return products;
}

const products = generateProducts();

// ============ Schema Definitions ============

const categoryEnum = z.enum([
  "electronics",
  "clothing",
  "home",
  "sports",
  "books",
  "toys",
]);

const listProductsInputSchema = z.object({
  category: categoryEnum.optional().describe("Filter by product category"),
  minPrice: z.number().optional().describe("Minimum price filter"),
  maxPrice: z.number().optional().describe("Maximum price filter"),
  minRating: z.number().optional().describe("Minimum rating filter (1-5)"),
});

const getProductInputSchema = z.object({
  id: z.string().describe("The product ID (e.g., prod_42)"),
});

const searchProductsInputSchema = z.object({
  query: z.string().describe("Search term to find in product names"),
});

// ============ Execute Functions ============

async function executeListProducts({
  category,
  minPrice,
  maxPrice,
  minRating,
}: z.infer<typeof listProductsInputSchema>) {
  const filtered = Object.entries(products)
    .filter(([_, product]) => {
      if (category && product.category !== category) return false;
      if (minPrice !== undefined && product.price < minPrice) return false;
      if (maxPrice !== undefined && product.price > maxPrice) return false;
      if (minRating !== undefined && product.rating < minRating) return false;
      return true;
    })
    .map(([id, product]) => ({
      id,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      rating: product.rating,
      description: product.description,
    }));

  return {
    products: filtered,
    total: filtered.length,
  };
}

async function executeGetProduct({
  id,
}: z.infer<typeof getProductInputSchema>) {
  const product = products[id];
  if (!product) {
    throw new Error(`Product not found: ${id}`);
  }
  return {
    id,
    ...product,
  };
}

async function executeSearchProducts({
  query,
}: z.infer<typeof searchProductsInputSchema>) {
  const matches = Object.entries(products)
    .filter(([_, product]) =>
      product.name.toLowerCase().includes(query.toLowerCase()),
    )
    .map(([id, product]) => ({
      id,
      name: product.name,
      category: product.category,
      price: product.price,
      rating: product.rating,
    }));

  return {
    results: matches,
    total: matches.length,
  };
}

// ============ Tool Descriptions ============

const descriptions = {
  listProducts:
    "List products from the catalog with optional filters. Returns full product details including descriptions.",
  getProduct: "Get detailed information for a specific product by ID",
  searchProducts: "Search products by name",
};

// ============ Prompt ============

const prompt =
  "Find the highest-rated electronics product that costs less than $350. Tell me its name, price, and rating.";

// ============ CLI Tools Version ============

async function runCliToolsVersion(): Promise<RunResult> {
  const calls: ToolCall[] = [];

  const listProducts = createCliTool({
    description: descriptions.listProducts,
    inputSchema: listProductsInputSchema,
    execute: executeListProducts,
  });

  const getProduct = createCliTool({
    description: descriptions.getProduct,
    inputSchema: getProductInputSchema,
    execute: executeGetProduct,
  });

  const searchProducts = createCliTool({
    description: descriptions.searchProducts,
    inputSchema: searchProductsInputSchema,
    execute: executeSearchProducts,
  });

  const { tools } = await createBashTool({
    cliTools: {
      listProducts,
      getProduct,
      searchProducts,
    },
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: { bash: tools.bash },
    instructions:
      "You are a helpful assistant. Use the bash tool to query the product catalog.",
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

  const listProducts = tool({
    description: descriptions.listProducts,
    inputSchema: listProductsInputSchema,
    execute: executeListProducts,
  });

  const getProduct = tool({
    description: descriptions.getProduct,
    inputSchema: getProductInputSchema,
    execute: executeGetProduct,
  });

  const searchProducts = tool({
    description: descriptions.searchProducts,
    inputSchema: searchProductsInputSchema,
    execute: executeSearchProducts,
  });

  const agent = new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.5",
    tools: {
      listProducts,
      getProduct,
      searchProducts,
    },
    instructions:
      "You are a helpful assistant. Use the available tools to query the product catalog.",
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
    name: "Large Data CLI Tools Example",
    prompt,
    runCliTools: runCliToolsVersion,
    runBaseline: runBaselineVersion,
    assertions: {
      // The answer should be the Ultra Wireless Headphones (prod_42)
      // which is electronics, $299.99, rating 4.9
      requiredResponseTerms: ["headphones", "299", "4.9"],
      // CLI tools may use more calls but saves tokens by using jq
      // to extract only needed data from large files
      skipFewerToolCalls: true,
    },
    outputPath: "examples/cli-tools/evals/data/large-data-output.json",
  });
}

main().catch(console.error);
