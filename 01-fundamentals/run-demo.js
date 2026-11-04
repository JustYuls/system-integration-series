// Run the integration lab:  node run-demo.js
import { table } from "./src/connections.js";
import { blockReasons, canApprove, integrate } from "./src/integrate.js";

const { requests, issues } = integrate();
console.log(`${"request".padEnd(9)}  ${"title".padEnd(16)} ${"status".padEnd(8)} ${"balance".padStart(8)} ${"hours".padStart(5)} ${"penalty".padStart(7)}  approval`);
for (const r of Object.values(requests)) {
  const balance = r.balancePhp === null ? "-" : r.balancePhp.toFixed(2);
  const approval = canApprove(r) ? "OK" : `blocked: ${blockReasons(r).join(", ")}`;
  console.log(`${r.requestNo.padEnd(9)}  ${r.title.padEnd(16)} ${r.status.padEnd(8)} ${balance.padStart(8)} ${String(r.hours ?? "-").padStart(5)} ${String(r.penaltyPhp ?? "-").padStart(7)}  ${approval}`);
}
console.log(`\n${issues.length} data issues:`);
for (const issue of issues) console.log("  -", issue);
console.log("\nsystems  point-to-point  hub");
for (const [n, p2p, hub] of table()) console.log(`${String(n).padStart(7)}  ${String(p2p).padStart(14)}  ${String(hub).padStart(3)}`);
