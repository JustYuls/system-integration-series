// Placeholder service 1: the people who ask. Replace the name, the fields and the seed with YOUR first system.
import { createResourceApp } from "./resource-app.js";

export const CUSTOMERS = [
  { id: "1", name: "Ana Reyes", email: "ana@example.com", active: true },
  { id: "2", name: "Ben Cruz", email: "ben@example.com", active: true },
  { id: "3", name: "Carla Diaz", email: "carla@example.com", active: false },
];

export const createCustomersApp = (seed = CUSTOMERS) =>
  createResourceApp({ name: "customers", resource: "customers", fields: { name: "text", email: "email", active: "boolean" }, seed });
