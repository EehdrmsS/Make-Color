export function createTimerState() {
  let id = null;

  return {
    get id() {
      return id;
    },
    set id(nextId) {
      id = nextId;
    },
    clear(registry) {
      if (!id) return;
      clearTimeout(id);
      registry?.delete?.(id);
      id = null;
    },
  };
}
