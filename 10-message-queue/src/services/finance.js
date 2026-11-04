// Finance service: the deposit of each request, and the payments that reduce it.
//   GET  /deposits/:requestNo                 the balance still unpaid (0 = paid), or 404
//   GET  /deposits/:requestNo/payments        the payments made so far
//   GET  /deposits/:requestNo/payments/:id    one payment
//   POST /deposits/:requestNo/payments        { "amountPhp": 100 }: 201, 400, 409 (paid already), 422 (too much)
import { checkFields, createJsonApp, finishApp, hasProblems, sendError, sendValidation } from "../http.js";
import { seedData } from "../seed.js";
import { isPesos } from "../validate.js";

const centavos = (pesos) => Math.round(pesos * 100) / 100;

export function createFinanceApp(data = seedData(), { log } = {}) {
  const deposits = structuredClone(data.deposits);
  const payments = []; // { id, requestNo, amountPhp, balancePhp }
  const find = (requestNo) => deposits.find((d) => d.requestNo === requestNo);
  const noDeposit = (res, requestNo) => sendError(res, 404, "NOT_FOUND", `No deposit record for ${requestNo}`);
  const paymentsOf = (requestNo) => payments.filter((p) => p.requestNo === requestNo);
  const app = createJsonApp("finance");

  app.get("/deposits/:requestNo", (req, res) => {
    const deposit = find(req.params.requestNo);
    if (!deposit) return noDeposit(res, req.params.requestNo);
    res.json(deposit);
  });

  app.get("/deposits/:requestNo/payments", (req, res) => {
    if (!find(req.params.requestNo)) return noDeposit(res, req.params.requestNo);
    res.json(paymentsOf(req.params.requestNo));
  });

  app.get("/deposits/:requestNo/payments/:id", (req, res) => {
    const payment = paymentsOf(req.params.requestNo).find((p) => p.id === Number(req.params.id));
    if (!payment) return sendError(res, 404, "NOT_FOUND", `No payment ${req.params.id} for ${req.params.requestNo}`);
    res.json(payment);
  });

  app.post("/deposits/:requestNo/payments", (req, res) => {
    const deposit = find(req.params.requestNo);
    if (!deposit) return noDeposit(res, req.params.requestNo);
    const body = req.body ?? {};
    const problems = checkFields(body, { amountPhp: isPesos });
    if (hasProblems(problems)) return sendValidation(res, problems);
    // The JSON is fine, but the rule of the business says no: 409 (state) and 422 (the amount).
    if (deposit.balancePhp === 0) return sendError(res, 409, "ALREADY_PAID", `The deposit of ${deposit.requestNo} is already paid`);
    if (body.amountPhp > deposit.balancePhp) {
      return sendError(res, 422, "OVERPAYMENT", `The payment is more than the balance of ${deposit.balancePhp} PHP`);
    }
    deposit.balancePhp = centavos(deposit.balancePhp - body.amountPhp);
    const payment = { id: paymentsOf(deposit.requestNo).length + 1, requestNo: deposit.requestNo, amountPhp: body.amountPhp, balancePhp: deposit.balancePhp };
    payments.push(payment);
    res.status(201).location(`/deposits/${deposit.requestNo}/payments/${payment.id}`).json(payment);
  });

  return finishApp(app, log);
}
