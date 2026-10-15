"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { PRIORITIES, todoActions, useTodos, type Priority, type Todo } from "@/lib/todo-store";

const MAX_LENGTH = 100;
const UNDO_MS = 5000;

type Deleted = { todos: Todo[]; indexes: number[]; label: string };

type Filter = "all" | "active" | "completed";

const FILTER_LABELS: Record<Filter, string> = {
  all: "すべて",
  active: "未完了",
  completed: "完了済み",
};

type Sort = "added" | "priority" | "dueDate";

const SORT_LABELS: Record<Sort, string> = {
  added: "追加順（新しい順）",
  priority: "優先度順（高→低）",
  dueDate: "期限順（近い順）",
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function comparePriority(a: Todo, b: Todo) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

// 期限なしは最後に並べる。"YYYY-MM-DD" は文字列比較で日付順になる
function compareDueDate(a: Todo, b: Todo) {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 表示用に並べ替える（保存されている順番は変えない）。同順位は追加順のまま */
function sortTodos(todos: Todo[], sort: Sort) {
  if (sort === "added") return todos;
  const primary = sort === "priority" ? comparePriority : compareDueDate;
  const secondary = sort === "priority" ? compareDueDate : comparePriority;
  return [...todos].sort((a, b) => primary(a, b) || secondary(a, b));
}

const PRIORITY_LABELS: Record<Priority, string> = { high: "高", medium: "中", low: "低" };

const PRIORITY_BADGE_STYLES: Record<Priority, string> = {
  high: "bg-red-50 text-red-800 ring-red-200",
  medium: "bg-amber-50 text-amber-900 ring-amber-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
};

const PRIORITY_CHECKED_STYLES: Record<Priority, string> = {
  high: "has-checked:border-red-600 has-checked:bg-red-50 has-checked:text-red-800",
  medium: "has-checked:border-amber-600 has-checked:bg-amber-50 has-checked:text-amber-900",
  low: "has-checked:border-slate-600 has-checked:bg-slate-100 has-checked:text-slate-900",
};

export default function TodoApp() {
  const todos = useTodos();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("added");
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const counts: Record<Filter, number> = {
    all: todos?.length ?? 0,
    active: remaining,
    completed,
  };
  const visibleTodos = sortTodos(
    todos?.filter((t) => (filter === "all" ? true : filter === "active" ? !t.done : t.done)) ?? [],
    sort,
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    todoActions.add({ title: trimmed, priority, dueDate: dueDate || null });
    setTitle("");
    setPriority("medium");
    setDueDate("");
    inputRef.current?.focus();
  }

  function handleDelete(todo: Todo) {
    // 絞り込み中でも元の並び順に戻せるよう、全体での位置を記録する
    const index = todos?.findIndex((t) => t.id === todo.id) ?? -1;
    if (index === -1) return;
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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PriorityPicker value={priority} onChange={setPriority} />
          <DueDateField id="new-todo-due" label="期限" value={dueDate} onChange={setDueDate} />
        </div>
      </form>

      {todos === null ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : todos.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <FilterTabs filter={filter} counts={counts} onChange={setFilter} />

          <div className="mb-3 flex items-center justify-end gap-2">
            <label htmlFor="sort" className="shrink-0 text-sm font-semibold text-slate-800">
              並び順
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            >
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {visibleTodos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-base text-slate-600">
              {filter === "active" ? "未完了のタスクはありません" : "完了済みのタスクはありません"}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {visibleTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  editing={editingId === todo.id}
                  onToggle={() => todoActions.toggle(todo.id)}
                  onEdit={() => setEditingId(todo.id)}
                  onCloseEdit={() => setEditingId(null)}
                  onDelete={() => handleDelete(todo)}
                />
              ))}
            </ul>
          )}

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
  editing,
  onToggle,
  onEdit,
  onCloseEdit,
  onDelete,
}: {
  todo: Todo;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onCloseEdit: () => void;
  onDelete: () => void;
}) {
  const checkboxId = `todo-${todo.id}`;
  const panelId = `todo-edit-${todo.id}`;
  const editButtonRef = useRef<HTMLButtonElement>(null);

  // 編集を閉じたら編集ボタンにフォーカスを戻す
  function closeEdit() {
    onCloseEdit();
    editButtonRef.current?.focus();
  }

  return (
    <li className={editing ? "bg-slate-50 pb-4" : "transition-colors hover:bg-slate-50"}>
      <div className="flex items-center gap-1 pr-2">
        {/* ラベル全体をクリック可能にしてタップ領域を広げる */}
        <label
          htmlFor={checkboxId}
          className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 pl-4"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={todo.done}
            onChange={onToggle}
            className="size-5 shrink-0 cursor-pointer accent-blue-600"
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span
              className={`break-all text-base ${
                todo.done ? "text-slate-500 line-through" : "text-slate-900"
              }`}
            >
              {todo.title}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PRIORITY_BADGE_STYLES[todo.priority]}`}
              >
                優先度 {PRIORITY_LABELS[todo.priority]}
              </span>
              {todo.dueDate && <DueDate dueDate={todo.dueDate} done={todo.done} />}
            </span>
          </span>
        </label>
        <button
          ref={editButtonRef}
          type="button"
          onClick={editing ? closeEdit : onEdit}
          aria-label={`「${todo.title}」の優先度と期限を編集`}
          aria-expanded={editing}
          aria-controls={editing ? panelId : undefined}
          title="編集"
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 ${
            editing ? "bg-blue-50 text-blue-700" : "text-slate-500"
          }`}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`「${todo.title}」を削除`}
          title="削除"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <TrashIcon />
        </button>
      </div>

      {editing && <EditPanel id={panelId} todo={todo} onClose={closeEdit} />}
    </li>
  );
}

function EditPanel({ id, todo, onClose }: { id: string; todo: Todo; onClose: () => void }) {
  const [priority, setPriority] = useState(todo.priority);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  // 開いたら選択中の優先度にフォーカスし、キーボードですぐ操作できるようにする
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    todoActions.update(todo.id, { priority, dueDate: dueDate || null });
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <form
      ref={formRef}
      id={id}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      aria-label={`「${todo.title}」の編集`}
      className="mx-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PriorityPicker value={priority} onChange={setPriority} />
        <DueDateField id={`${id}-due`} label="期限" value={dueDate} onChange={setDueDate} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-lg px-4 text-base font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="h-11 rounded-lg bg-blue-600 px-5 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          保存
        </button>
      </div>
    </form>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  // 追加フォームと編集欄が同時に表示されるため、ラジオボタンのグループ名を個別にする
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-slate-800">優先度</legend>
      <div className="grid grid-cols-3 gap-2">
        {PRIORITIES.map((p) => (
          <label
            key={p}
            className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600 ${PRIORITY_CHECKED_STYLES[p]}`}
          >
            <input
              type="radio"
              name={name}
              value={p}
              checked={value === p}
              onChange={() => onChange(p)}
              className="sr-only"
            />
            {PRIORITY_LABELS[p]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DueDateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-800">
        {label} <span className="font-normal text-slate-600">（任意）</span>
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            クリア
          </button>
        )}
      </div>
    </div>
  );
}

function DueDate({ dueDate, done }: { dueDate: string; done: boolean }) {
  const today = toDateString(new Date());
  const label = formatDate(dueDate);
  if (!done && dueDate < today) {
    return <span className="font-semibold text-red-700">期限切れ：{label}</span>;
  }
  if (!done && dueDate === today) {
    return <span className="font-semibold text-amber-800">今日まで：{label}</span>;
  }
  return <span className="text-slate-600">期限：{label}</span>;
}

function FilterTabs({
  filter,
  counts,
  onChange,
}: {
  filter: Filter;
  counts: Record<Filter, number>;
  onChange: (filter: Filter) => void;
}) {
  return (
    <div role="group" aria-label="表示するタスク" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
      {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => onChange(f)}
          className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
            filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-700 hover:bg-white/60"
          }`}
        >
          {FILTER_LABELS[f]}
          <span className="ml-1 font-normal text-slate-600">
            {counts[f]}
            <span className="sr-only">件</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** ローカル時刻での "YYYY-MM-DD" */
function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-10-20" → "10/20(火)"（今年以外は年も表示） */
function formatDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const weekday = "日月火水木金土"[new Date(y, m - 1, d).getDay()];
  const prefix = y === new Date().getFullYear() ? "" : `${y}/`;
  return `${prefix}${m}/${d}(${weekday})`;
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

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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
