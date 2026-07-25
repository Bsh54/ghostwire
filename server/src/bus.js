// Simple in-process event bus + rolling history for the live feed.
import { EventEmitter } from "events";

export const bus = new EventEmitter();
bus.setMaxListeners(100);

const history = [];
const MAX = 100;

export function emitEvent(evt) {
  const withTime = { ...evt, ts: Date.now() };
  history.push(withTime);
  if (history.length > MAX) history.shift();
  bus.emit("event", withTime);
  return withTime;
}

export function recentEvents() {
  return history.slice(-40);
}
