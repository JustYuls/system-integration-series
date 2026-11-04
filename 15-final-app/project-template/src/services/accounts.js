// Placeholder service 3: the money side. balance = what the customer still owes (0 = paid). Replace with YOUR third system.
import { createResourceApp } from "./resource-app.js";

export const ACCOUNTS = [
  { id: "1", customerId: "1", balance: 0 },
  { id: "2", customerId: "2", balance: 250.5 },
  { id: "3", customerId: "3", balance: 0 },
];

export const createAccountsApp = (seed = ACCOUNTS) =>
  createResourceApp({ name: "accounts", resource: "accounts", fields: { customerId: "text", balance: "number" }, seed });
