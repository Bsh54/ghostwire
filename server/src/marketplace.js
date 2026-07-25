// The service catalogue. Each service is offered by one agent and priced
// per call. Prices are tiny HBAR amounts to showcase real micro-payments.
export const SERVICES = [
  { id: "scrape",   name: "Headless scrape",     provider: "SC", priceHbar: 0.02, description: "Render a JS-heavy page and return clean HTML" },
  { id: "verify",   name: "Fact check",          provider: "VF", priceHbar: 0.03, description: "Cross-check a claim against public data" },
  { id: "translate",name: "Context translation", provider: "LX", priceHbar: 0.02, description: "Adapt text to a regional language variant" },
  { id: "enrich",   name: "Data enrichment",     provider: "DA", priceHbar: 0.04, description: "Clean and structure a raw document" },
];

export function getService(id) {
  return SERVICES.find((s) => s.id === id);
}
