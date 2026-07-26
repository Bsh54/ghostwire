// Server-side conversation storage (persisted to disk, per user).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../data/conversations.json");

let convos = {};
try { convos = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (_) {}
const save = () => { try { fs.writeFileSync(FILE, JSON.stringify(convos)); } catch (_) {} };

const titleFrom = (text) => {
  const t = (text || "New chat").replace(/\s+/g, " ").trim();
  return t.length > 46 ? t.slice(0, 46) + "…" : t;
};

export function getOrCreate(id, userId, firstText) {
  if (id && convos[id]) return convos[id];
  const conv = {
    id: crypto.randomUUID(),
    userId: (userId || "guest").toLowerCase(),
    title: titleFrom(firstText),
    created: Date.now(),
    updated: Date.now(),
    messages: [],
  };
  convos[conv.id] = conv;
  save();
  return conv;
}

export function appendTurn(id, userMsg, assistantMsg) {
  const c = convos[id];
  if (!c) return;
  c.messages.push(userMsg, assistantMsg);
  c.updated = Date.now();
  save();
}

export function list(userId) {
  const uid = (userId || "guest").toLowerCase();
  return Object.values(convos)
    .filter((c) => c.userId === uid)
    .sort((a, b) => b.updated - a.updated)
    .map((c) => ({ id: c.id, title: c.title, updated: c.updated }));
}

export function get(id) {
  return convos[id] || null;
}

export function remove(id) {
  delete convos[id];
  save();
}
