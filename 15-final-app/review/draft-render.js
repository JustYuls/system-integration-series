// The decision card as an AI assistant drafted it for the web page: it builds HTML from the data with template strings.
export function draftCard({ title, decision, reasons }) {
  return `<h2>${title}</h2><p class="${decision}">${decision}</p><ul>${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>`;
}
// In app.js:   card.innerHTML = draftCard(request);
