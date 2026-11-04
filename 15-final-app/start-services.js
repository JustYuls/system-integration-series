// Start the three services, each on its own port.   Run:  npm run start:services
import { PORTS } from "./src/ports.js";
import { createFacilitiesApp } from "./src/services/facilities.js";
import { createFinanceApp } from "./src/services/finance.js";
import { createStudentAffairsApp } from "./src/services/student-affairs.js";

const services = [
  ["student-affairs", createStudentAffairsApp(), PORTS.studentAffairs],
  ["finance", createFinanceApp(), PORTS.finance],
  ["facilities", createFacilitiesApp(), PORTS.facilities],
];

const announce = (name, port) => () => console.log(`${name.padEnd(16)} http://localhost:${port}   (try /health)`);

for (const [name, app, port] of services) {
  const server = app.listen(port, announce(name, port));
  server.on("error", (err) => {
    console.error(`${name}: cannot listen on ${port}: ${err.message}`);
    process.exit(1);
  });
}
