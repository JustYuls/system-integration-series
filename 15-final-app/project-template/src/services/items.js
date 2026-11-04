// Placeholder service 2: the things that are asked for. Replace with YOUR second system.
import { createResourceApp } from "./resource-app.js";

export const ITEMS = [
  { id: "1", name: "Projector", stock: 5 },
  { id: "2", name: "Laptop", stock: 0 },
  { id: "3", name: "Microphone", stock: 12 },
];

export const createItemsApp = (seed = ITEMS) => createResourceApp({ name: "items", resource: "items", fields: { name: "text", stock: "integer" }, seed });
