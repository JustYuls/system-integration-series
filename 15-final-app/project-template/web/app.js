// The page: send the form to the gateway, show the decision. User text goes in with textContent, never innerHTML.
const $ = (id) => document.getElementById(id);

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = { customerId: $("customerId").value, itemId: $("itemId").value, quantity: Number($("quantity").value), date: $("date").value };
  const res = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  const lines = res.status === 201 ? data.reasons : [data.error?.message ?? "Something went wrong.", ...(data.error?.missing ?? []).map((f) => `missing: ${f}`)];
  $("decision").textContent = res.status === 201 ? data.decision : `Error ${res.status}`;
  $("card").className = `card ${res.status === 201 ? data.decision : "error"}`;
  $("reasons").replaceChildren(...lines.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
  $("card").hidden = false;
});
