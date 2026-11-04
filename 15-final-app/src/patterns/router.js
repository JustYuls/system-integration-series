// Content-based router: pick the handler from one property of the message, with a default.
export function createRouter({ by, routes, fallback }) {
  return function route(message) {
    const key = message[by];
    const handler = Object.hasOwn(routes, key) ? routes[key] : fallback;
    if (!handler) throw new Error(`no route for ${by} = ${key}`);
    return handler(message);
  };
}
