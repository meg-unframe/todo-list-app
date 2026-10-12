"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { todoActions, useTodos, type Todo } from "@/lib/todo-store";

const MAX_LENGTH = 100;
const UNDO_MS = 5000;

type Deleted = { todos: Todo[]; indexes: number[]; label: string };

export default function TodoApp() {
  const todos = useTodos();
  const [title, setTitle] = useState("");
  const [deleted, setDeleted] = useState<Deleted | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 「元に戻す」は一定時間で自動的に消える
  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [deleted]);

  const trimmed = title.trim();
  const remaining = todos?.filter((t) => !t.done).length ?? 0;
  const completed = (todos?.length ?? 0) - remaining;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    todoActions.add(trimmed);
    setTitle("");
    inputRef.current?.focus();
  }

  function handleDelete(todo: Todo, index: number) {
    todoActions.remove(todo.id);
    setDeleted({ todos: [todo], indexes: [index], label: `「${todo.title}」を削除しました` });
    inputRef.current?.focus();
  }

  function handleClearCompleted() {
    if (!todos) return;
    const indexes: number[] = [];
    const removed = todos.filter((t, i) => {
      if (t.done) indexes.push(i);
      return t.done;
    });
    todoActions.clearCompleted();
    setDeleted({ todos: removed, indexes, label: `完了済み ${removed.length} 件を削除しました` });
  }

  function handleUndo() {
    if (!deleted) return;
    deleted.todos.forEach((t, i) => todoActions.restore(t, deleted.indexes[i]));
    setDeleted(null);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">ToDo リスト</h1>
        <p className="mt-2 text-base text-slate-600" aria-live="polite">
          {todos === null
            ? "読み込み中…"
            : todos.length === 0
              ? "タスクはまだありません"
              : `残り ${remaining} 件 ／ 全 ${todos.length} 件`}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-6">
        <label htmlFor="new-todo" className="mb-2 block text-sm font-semibold text-slate-800">
          新しいタスク
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="new-todo"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_LENGTH}
            placeholder="例：牛乳を買う"
            autoComplete="off"
            autoFocus
            className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
          <button
            type="submit"
            disabled={!trimmed}
            className="h-12 shrink-0 rounded-lg bg-blue-600 px-5 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            追加
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">Enter キーでも追加できます</p>
      </form>

      {todos === null ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : todos.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {todos.map((todo, index) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => todoActions.toggle(todo.id)}
                onDelete={() => handleDelete(todo, index)}
              />
            ))}
          </ul>

          {completed > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleClearCompleted}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-700 underline-offset-4 hover:bg-slate-100 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                完了済みをまとめて削除（{completed} 件）
              </button>
            </div>
          )}
        </>
      )}

      <UndoToast deleted={deleted} onUndo={handleUndo} onClose={() => setDeleted(null)} />
    </main>
  );
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const checkboxId = `todo-${todo.id}`;
  return (
    <li className="group flex items-center gap-1 pr-2 transition-colors hover:bg-slate-50">
      {/* ラベル全体をクリック可能にしてタップ領域を広げる */}
      <label
        htmlFor={checkboxId}
        className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 py-3 pl-4"
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={todo.done}
          onChange={onToggle}
          className="size-5 shrink-0 cursor-pointer accent-blue-600"
        />
        <span
          className={`break-all text-base ${
            todo.done ? "text-slate-500 line-through" : "text-slate-900"
          }`}
        >
          {todo.title}
        </span>
      </label>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`「${todo.title}」を削除`}
        title="削除"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <TrashIcon />
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-800">やることを追加してみましょう</p>
      <p className="mt-2 text-sm text-slate-600">
        上の入力欄にタスクを書いて「追加」を押してください。
        <br />
        データはこのブラウザに保存され、閉じても残ります。
      </p>
    </div>
  );
}

function UndoToast({
  deleted,
  onUndo,
  onClose,
}: {
  deleted: Deleted | null;
  onUndo: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
    >
      {deleted && (
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl bg-slate-900 py-2 pl-4 pr-2 text-white shadow-lg">
          <span className="truncate text-sm">{deleted.label}</span>
          <button
            type="button"
            onClick={onUndo}
            className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-sky-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            元に戻す
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
