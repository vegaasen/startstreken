import { useState, useCallback } from "react";

const STORAGE_KEY = "loypevaer:mine-ritt";

export type PlannedEntry = {
  date: string;
  startTime: string;
  finishTime: string;
};

type Store = Record<string, PlannedEntry>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

export function useMyRitt() {
  const [store, setStore] = useState<Store>(readStore);

  const save = useCallback((next: Store) => {
    writeStore(next);
    setStore(next);
  }, []);

  const add = useCallback(
    (id: string, entry: PlannedEntry) => {
      save({ ...store, [id]: entry });
    },
    [store, save]
  );

  const remove = useCallback(
    (id: string) => {
      const next = { ...store };
      delete next[id];
      save(next);
    },
    [store, save]
  );

  const isPlanned = useCallback((id: string) => id in store, [store]);

  const getPlanned = useCallback(
    (id: string): PlannedEntry | undefined => store[id],
    [store]
  );

  return {
    plannedIds: Object.keys(store),
    isPlanned,
    getPlanned,
    add,
    remove,
  };
}
