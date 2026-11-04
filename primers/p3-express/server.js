import { createApp } from "./src/app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp({ logger: console.log });

app.listen(port, () => {
  console.log(`Campus Event Planner on http://localhost:${port}`);
});
