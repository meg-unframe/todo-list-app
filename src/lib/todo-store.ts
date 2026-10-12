"use client";

import { useSyncExternalStore } from "react";

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
};

const STORAGE_KEY = "todo-list-app:todos";

const listeners = new Set<() => void>();
let cache: Todo[] | null = null;

function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.done === "boolean" &&
    typeof v.createdAt === "number"
  );
}

function load(): Todo[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTodo) : [];
  } catch {
    return [];
  }
}

function getSnapshot(): Todo[] {
  if (cache === null) cache = load();
  return cache;
}

// サーバー側では localStorage が無いため「未読み込み」を表す null を返す
function getServerSnapshot(): null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // 別タブでの変更も反映する
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cache = load();
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function save(next: Todo[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 容量超過やプライベートモードでも画面上の操作は継続できるようにする
  }
  listeners.forEach((l) => l());
}

export const todoActions = {
  add(title: string) {
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      done: false,
      createdAt: Date.now(),
    };
    save([todo, ...getSnapshot()]);
  },
  toggle(id: string) {
    save(getSnapshot().map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  },
  remove(id: string) {
    save(getSnapshot().filter((t) => t.id !== id));
  },
  restore(todo: Todo, index: number) {
    const next = [...getSnapshot()];
    next.splice(Math.min(index, next.length), 0, todo);
    save(next);
  },
  clearCompleted() {
    save(getSnapshot().filter((t) => !t.done));
  },
};

/** 読み込み前（SSR・ハイドレーション中）は null を返す */
export function useTodos(): Todo[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
