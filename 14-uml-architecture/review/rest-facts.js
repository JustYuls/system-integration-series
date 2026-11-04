// Facts for the AI review: a Student Affairs route drafted by an AI, checked by starting the draft and the real
// service and calling both with fetch.
import { send, start } from "../src/serve.js";
import { createStudentAffairsApp } from "../src/services/student-affairs.js";
import { createFlawedApp } from "./flawed-app.js";

const newRequest = { title: "Quiz Night", organization: "Math Club", date: "2027-05-20", venue: "Lab A", attendees: 35, budget: { amount: 1200, currency: "PHP" }, contactEmail: "math@campus.example" };

export async function collect() {
  const draft = await start(createFlawedApp());
  const real = await start(createStudentAffairsApp(undefined, { log: () => {} }));
  try {
    // Finding 1: what does a create answer?
    const draftCreate = await send(draft.url, "/requests", { method: "POST", body: newRequest });
    const realCreate = await send(real.url, "/requests", { method: "POST", body: newRequest });

    // Finding 2: what happens to an empty body?
    const draftEmpty = await send(draft.url, "/requests", { method: "POST", body: {} });
    const realEmpty = await send(real.url, "/requests", { method: "POST", body: {} });

    // Finding 3: does a GET change the data?
    await send(draft.url, "/requests/EVT-0001/approve");
    const draftAfterGet = await send(draft.url, "/requests/EVT-0001");
    const realGetApprove = await send(real.url, "/requests/EVT-0001/approve");
    const realAfterGet = await send(real.url, "/requests/EVT-0001");

    // Claim 4: does the draft keep its insides secret when it fails?
    const draftBroken = await send(draft.url, "/requests/EVT-9999");

    // Claim 5: is DELETE safe, like GET?
    const before = (await send(real.url, "/requests/EVT-0001")).status;
    const deleted = await send(real.url, "/requests/EVT-0001", { method: "DELETE" });
    const after = (await send(real.url, "/requests/EVT-0001")).status;

    // Claim 6: does posting the same body twice make two requests?
    const first = await send(real.url, "/requests", { method: "POST", body: newRequest });
    const second = await send(real.url, "/requests", { method: "POST", body: newRequest });

    return {
      draftCreateStatus: draftCreate.status,
      realCreateStatus: realCreate.status,
      realLocation: realCreate.headers.get("location"),
      draftLocation: draftCreate.headers.get("location"),
      draftEmptyStatus: draftEmpty.status,
      draftEmptyStored: draftEmpty.body.requestNo !== undefined,
      realEmptyStatus: realEmpty.status,
      realMissing: realEmpty.body.error.missing,
      draftStatusAfterGet: draftAfterGet.body.status,
      realGetApproveStatus: realGetApprove.status,
      realStatusAfterGet: realAfterGet.body.status,
      draftBrokenStatus: draftBroken.status,
      draftLeaksStack: typeof draftBroken.body.stack === "string" && draftBroken.body.stack.includes("flawed-app.js"),
      deleteBefore: before,
      deleteStatus: deleted.status,
      deleteAfter: after,
      postedTwice: [first.status, second.status],
      twoNumbers: first.body.requestNo !== second.body.requestNo,
    };
  } finally {
    await draft.close();
    await real.close();
  }
}
