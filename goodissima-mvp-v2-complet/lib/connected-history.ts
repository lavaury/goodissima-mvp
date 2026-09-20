export type HistoryEntry = { key: string; index: number };
export type HistoryAvailability = { back: boolean; forward: boolean };
export const noHistory: HistoryAvailability = { back: false, forward: false };

// A set of observed native entry keys, not an application history stack.
// No URLs, titles, tokens, History.state writes or persistent storage.
export function createConnectedHistory() {
  const known = new Set<string>();
  return {
    observe(entries: HistoryEntry[], current: HistoryEntry | null, connected: boolean): HistoryAvailability {
      const live = new Set(entries.map(entry => entry.key));
      for (const key of known) if (!live.has(key)) known.delete(key);
      if (!connected || !current) { known.clear(); return noHistory; }
      known.add(current.key);
      const index = entries.findIndex(entry => entry.key === current.key);
      return {
        back: index > 0 && entries[index - 1].index === current.index - 1 && known.has(entries[index - 1].key),
        forward: index >= 0 && index + 1 < entries.length && entries[index + 1].index === current.index + 1 && known.has(entries[index + 1].key),
      };
    },
  };
}
