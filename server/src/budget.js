// Per-user spending guardrail. A user's agent can never spend beyond this
// session cap (on top of the hard on-chain wallet-balance limit).
const state = {};
const DEFAULT_CAP = 1.0; // HBAR per session

export function getBudget(user) {
  const id = (user || "guest").toLowerCase();
  if (!state[id]) state[id] = { cap: DEFAULT_CAP, spent: 0 };
  return state[id];
}
export function setCap(user, cap) {
  const b = getBudget(user);
  b.cap = Math.max(0, Number(cap) || 0);
  return b;
}
export function canSpend(user, amount) {
  const b = getBudget(user);
  return b.spent + amount <= b.cap + 1e-9;
}
export function record(user, amount) {
  getBudget(user).spent += amount;
}
