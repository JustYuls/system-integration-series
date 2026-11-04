// Browser JavaScript: talks to the Express API with fetch.
const rows = document.querySelector("#venue-rows");
const select = document.querySelector("#venue");
const status = document.querySelector("#status");

async function loadVenues(minCapacity = 0) {
  const res = await fetch(`/api/venues?minCapacity=${minCapacity}`);
  const venues = await res.json();
  rows.replaceChildren();
  for (const v of venues) {
    const tr = document.createElement("tr");
    for (const text of [v.name, v.capacity, v.outdoor ? "yes" : "no", v.penaltyPhp]) {
      const td = document.createElement("td");
      td.textContent = text; // textContent shows text as text, never as HTML
      tr.append(td);
    }
    rows.append(tr);
  }
  return venues;
}

function fillSelect(venues) {
  select.replaceChildren();
  for (const v of venues) {
    const option = document.createElement("option");
    option.value = v.id;
    option.textContent = v.name;
    select.append(option);
  }
}

function showStatus(text, kind) {
  status.textContent = text;
  status.className = kind;
}

document.querySelector("#min-capacity").addEventListener("input", (event) => {
  loadVenues(event.target.value || 0);
});

document.querySelector("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const body = {
    title: form.get("title"),
    date: form.get("date"),
    venue: form.get("venue"),
    attendees: Number(form.get("attendees")),
  };
  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.status === 201) {
    showStatus(`Sent! Your request number is ${data.requestNo}.`, "ok");
    event.target.reset();
  } else {
    showStatus((data.error.problems ?? [data.error.message]).join(". "), "error");
  }
});

fillSelect(await loadVenues());
