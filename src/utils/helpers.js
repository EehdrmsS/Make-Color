export function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
