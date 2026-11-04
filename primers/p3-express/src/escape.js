// Turn text into HTML-safe text. The browser page does not need it (it uses textContent),
// but it shows what "safe" means, and the AI check uses it.
export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
