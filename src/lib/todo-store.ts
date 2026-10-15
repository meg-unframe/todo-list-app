"use client";

import { useSyncExternalStore } from "react";

export type Priority = "high" | "medium" | "low";

export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  priority: Priority;
  /** 締切日（"YYYY-MM-DD"）。未設定は null */
  dueDate: string | null;
};

export type NewTodo = Pick<Todo, "title" | "priority" | "dueDate">;

const STORAGE_KEY = "todo-list-app:todos";

const listeners = new Set<() => void>();
let cache: Todo[] | null = null;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 優先度・期限が追加される前に保存されたタスクも、既定値を補って読み込む
function toTodo(value: unknown): Todo | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    typeof v.title !== "string" ||
    typeof v.done !== "boolean" ||
    typeof v.createdAt !== "number"
  ) {
    return null;
  }
  return {
    id: v.id,
    title: v.title,
    done: v.done,
    createdAt: v.createdAt,
    priority: PRIORITIES.includes(v.priority as Priority) ? (v.priority as Priority) : "medium",
    dueDate: typeof v.dueDate === "string" && DATE_PATTERN.test(v.dueDate) ? v.dueDate : null,
  };
}

function load(): Todo[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toTodo).filter((t): t is Todo => t !== null);
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
  add({ title, priority, dueDate }: NewTodo) {
    const todo: Todo = {
      id: crypto.randomUUID(),
      title,
      done: false,
      createdAt: Date.now(),
      priority,
      dueDate,
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
