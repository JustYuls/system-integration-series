// The draft of an AI assistant for "a Student Affairs service in Express". It runs, and it looks fine,
// but it breaks the rules of REST. review/rest-review.js proves how. Do not copy this file.
import express from "express";

export function createFlawedApp() {
  const requests = [{ requestNo: "EVT-0001", title: "Orientation Day", status: "Pending" }];
  const app = express();
  app.use(express.json());

  app.post("/requests", (req, res) => {
    const number = `EVT-${1000 + requests.length}`;
    const request = { requestNo: number, status: "Pending", ...req.body };
    requests.push(request);
    res.json(request);
  });

  app.get("/requests/:requestNo/approve", (req, res) => {
    const request = requests.find((r) => r.requestNo === req.params.requestNo);
    request.status = "Approved";
    res.json(request);
  });

  app.get("/requests/:requestNo", (req, res) => {
    try {
      const request = requests.find((r) => r.requestNo === req.params.requestNo);
      res.json({ requestNo: request.requestNo, title: request.title, status: request.status });
    } catch (err) {
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  return app;
}
