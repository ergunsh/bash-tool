/**
 * Shared tool definitions for composing example.
 *
 * This example tests where bash scripting should genuinely save round-trips:
 * - Get user by ID
 * - Use their teamId to fetch team details
 * - Return combined result
 *
 * Baseline: 2 LLM round-trips (get user, then get team)
 * CLI tools: 1 round-trip (bash script does both and combines)
 */

import { z } from "zod";

// ============ Mock Data ============

const users = new Map([
  [
    "alice",
    {
      id: "alice",
      name: "Alice Johnson",
      email: "alice@example.com",
      teamId: "team_eng",
      role: "senior_engineer",
    },
  ],
  [
    "bob",
    {
      id: "bob",
      name: "Bob Smith",
      email: "bob@example.com",
      teamId: "team_sales",
      role: "account_exec",
    },
  ],
  [
    "charlie",
    {
      id: "charlie",
      name: "Charlie Brown",
      email: "charlie@example.com",
      teamId: "team_eng",
      role: "engineer",
    },
  ],
]);

const teams = new Map([
  [
    "team_eng",
    {
      id: "team_eng",
      name: "Engineering",
      manager: "diana",
      department: "Product",
      headcount: 12,
    },
  ],
  [
    "team_sales",
    {
      id: "team_sales",
      name: "Sales",
      manager: "eve",
      department: "Revenue",
      headcount: 8,
    },
  ],
]);

// ============ Schema Definitions ============

export const getUserInputSchema = z.object({
  id: z.string().describe("The user ID to look up"),
});

export const getUserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  teamId: z.string(),
  role: z.string(),
});

export const getTeamInputSchema = z.object({
  id: z.string().describe("The team ID to look up"),
});

export const getTeamOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  manager: z.string(),
  department: z.string(),
  headcount: z.number(),
});

// ============ Execute Functions ============

export async function executeGetUser({
  id,
}: z.infer<typeof getUserInputSchema>) {
  const user = users.get(id);
  if (!user) {
    throw new Error(`User not found: ${id}`);
  }
  return user;
}

export async function executeGetTeam({
  id,
}: z.infer<typeof getTeamInputSchema>) {
  const team = teams.get(id);
  if (!team) {
    throw new Error(`Team not found: ${id}`);
  }
  return team;
}

// ============ Tool Descriptions ============

export const descriptions = {
  getUser: "Get user details by ID. Returns user info including their teamId.",
  getTeam:
    "Get team details by ID. Returns team info including manager and headcount.",
};

// ============ Prompt ============

// This prompt requires joining data from two tools.
// Baseline: Call getUser, see result, call getTeam with teamId, combine
// CLI tools: One script that does both and returns combined result
export const prompt =
  "Get the full details for user 'alice', including their team's name and department.";
