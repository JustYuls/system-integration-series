// One port for each service. The gateway (with the web page) listens on 5000.
// Change the names when you rename your services; keep the gateway first.
export const PORTS = { gateway: 5000, customers: 5001, items: 5002, accounts: 5003 };

export const baseUrl = (name, host = "http://localhost") => `${host}:${PORTS[name]}`;
