// The planner application: the gateway of episode 11 plus the routes and the web page of this episode.
import { createClients } from "./clients.js";
import { createGateway as realGateway } from "./gateway.js";
import { plannerRoutes } from "./routes.js";

// services: { studentAffairs, finance, facilities } base URLs; external: createExternal(); queue: createQueue().
// createGateway can be replaced in a test; by default it is the real gateway.
export function createPlannerApp({ services, external, queue, fetch = globalThis.fetch, today, timeoutMs, log, createGateway = realGateway }) {
  const clients = createClients(services, { fetch, timeoutMs });
  const planner = plannerRoutes({ clients, external, queue, today });
  const app = createGateway({ services, fetch, timeoutMs, log, extend: planner.extend });
  app.locals.assessments = planner.assessments; // for tests and demos
  app.locals.clients = clients;
  return app;
}
