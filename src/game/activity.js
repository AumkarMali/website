import { useEffect, useState } from 'react';

// One shared flag for "Block Dodge is open". Background effects subscribe to it and pause.
let active = false;
const listeners = new Set();

export const isGameActive = () => active;

export function setGameActive(value) {
  if (active === value) return;
  active = value;
  document.body.classList.toggle('blockdodge-active', active);
  for (const fn of listeners) {
    try {
      fn(active);
    } catch {
      /* one bad listener must not break the rest */
    }
  }
}

export function onGameActive(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useGameActive() {
  const [value, setValue] = useState(active);
  useEffect(() => onGameActive(setValue), []);
  return value;
}
