// Start the whole application: the three services, the queue with the notifier, and the gateway with the page on port 5000.
// The outside APIs are the real ones, so this needs internet.   Run:  npm start    then open http://localhost:5000
import { createExternal } from "./src/external.js";
import { createNotifier, TOPIC } from "./src/notifier.js";
import { PORTS, baseUrl } from "./src/ports.js";
import { createQueue } from "./src/queue.js";
import { createApp } from "./src/gateway/server.js";
import { createAccountsApp } from "./src/services/accounts.js";
import { createCustomersApp } from "./src/services/customers.js";
import { createItemsApp } from "./src/services/items.js";

function listen(name, app, port) {
  const server = app.listen(port, () => console.log(`${name.padEnd(16)} http://localhost:${port}`));
  server.on("error", (error) => {
    console.error(`${name}: cannot listen on ${port}: ${error.message}`);
    process.exit(1);
  });
}

listen("customers", createCustomersApp(), PORTS.customers);
listen("items", createItemsApp(), PORTS.items);
listen("accounts", createAccountsApp(), PORTS.accounts);

// The "mail" is a line in the console. A real project would call a mail server here.
const queue = createQueue();
queue.subscribe(TOPIC, createNotifier({ send: async ({ to, subject }) => console.log(`message to ${to}: ${subject}`) }));

const services = { customers: baseUrl("customers"), items: baseUrl("items"), accounts: baseUrl("accounts") };
listen("gateway + page", createApp({ services, external: createExternal(), queue }), PORTS.gateway);
