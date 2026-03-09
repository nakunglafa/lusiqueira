"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getRestaurantTables,
  createRestaurantTable,
  createRestaurantTablesBulk,
  updateRestaurantTable,
  deleteRestaurantTable,
} from "@/lib/api";
import { toArray } from "@/lib/owner-utils";

const TABLE_TYPES = ["round", "square", "booth", "bar"];

export function TablesTab({ restaurantId, token }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const loadTables = useCallback(() => {
    if (!token || !restaurantId) return;
    setLoading(true);
    setError("");
    getRestaurantTables(token, restaurantId)
      .then((res) => setTables(toArray(res)))
      .catch((err) => {
        setError(err?.data?.message || err?.message || "Failed to load tables");
        setTables([]);
      })
      .finally(() => setLoading(false));
  }, [token, restaurantId]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2">
        <button
          type="button"
          onClick={() => { setShowAdd(true); setShowBulk(false); }}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl bg-owner-action px-5 py-3 text-base md:text-sm font-medium text-white hover:opacity-90 active:scale-[0.98] sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          Add table
        </button>
        <button
          type="button"
          onClick={() => { setShowBulk(true); setShowAdd(false); }}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl border border-owner-border px-5 py-3 text-base md:text-sm font-medium text-owner-charcoal hover:bg-owner-paper active:scale-[0.98]  sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          Bulk create
        </button>
      </div>

      {showAdd && (
        <AddTableForm
          restaurantId={restaurantId}
          token={token}
          onSuccess={() => { setShowAdd(false); loadTables(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
      {showBulk && (
        <BulkCreateForm
          restaurantId={restaurantId}
          token={token}
          onSuccess={() => { setShowBulk(false); loadTables(); }}
          onCancel={() => setShowBulk(false)}
        />
      )}

      {loading ? (
        <p className="py-8 text-owner-muted">Loading tables...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="text-red-600 ">{error}</p>
          <button
            type="button"
            onClick={loadTables}
            className="touch-manipulation mt-2 min-h-[48px] rounded-xl bg-red-100 px-4 py-3 text-base md:text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
          >
            Try again
          </button>
        </div>
      ) : tables.length === 0 ? (
        <p className="py-8 text-owner-muted">No tables yet. Add one above.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => (
            <li
              key={t.id}
              className="owner-card rounded-xl p-4"
            >
              {editingId === t.id ? (
                <EditTableForm
                  table={t}
                  token={token}
                  onSuccess={() => { setEditingId(null); loadTables(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <p className="font-medium text-owner-charcoal">{t.name || `Table ${t.id}`}</p>
                  <p className="text-sm text-owner-muted">
                    {t.type || "table"} · {t.min_capacity ?? 1}–{t.max_capacity ?? 4} seats
                  </p>
                  {t.is_active === false && (
                    <span className="mt-1 inline-block text-xs text-amber-600 dark:text-amber-400">Inactive</span>
                  )}
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(t.id)}
                      className="touch-manipulation min-h-[44px] min-w-[80px] rounded-lg border border-owner-border px-4 py-2.5 text-base font-medium text-owner-charcoal hover:bg-owner-paper"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Delete this table?")) return;
                        try {
                          await deleteRestaurantTable(token, t.id);
                          loadTables();
                        } catch (err) {
                          setError(err?.data?.message || err?.message || "Failed to delete");
                        }
                      }}
                      className="touch-manipulation min-h-[44px] min-w-[80px] rounded-lg border border-red-300 px-4 py-2.5 text-base font-medium text-red-700 hover:bg-red-50 dark:border-red-800  dark:hover:bg-red-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddTableForm({ restaurantId, token, onSuccess, onCancel }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("square");
  const [minCap, setMinCap] = useState(2);
  const [maxCap, setMaxCap] = useState(4);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await createRestaurantTable(token, restaurantId, {
        name: name || undefined,
        type,
        min_capacity: minCap,
        max_capacity: maxCap,
        is_active: true,
      });
      onSuccess();
    } catch (error) {
      setErr(error?.data?.message || error?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="owner-card rounded-xl p-4">
      <h3 className="mb-3 font-medium text-owner-charcoal">Add table</h3>
      {err && <p className="mb-2 text-sm text-red-600 ">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm text-owner-muted">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Table 1"
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          />
        </label>
        <label>
          <span className="text-sm text-owner-muted">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          >
            {TABLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm text-owner-muted">Min capacity</span>
          <input
            type="number"
            min={1}
            value={minCap}
            onChange={(e) => setMinCap(Number(e.target.value) || 1)}
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          />
        </label>
        <label>
          <span className="text-sm text-owner-muted">Max capacity</span>
          <input
            type="number"
            min={1}
            value={maxCap}
            onChange={(e) => setMaxCap(Number(e.target.value) || 1)}
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          type="submit"
          disabled={saving}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl bg-owner-action px-5 py-3 text-base font-medium text-white hover:opacity-90 disabled:opacity-50 sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          {saving ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl border border-owner-border px-5 py-3 text-base font-medium text-owner-charcoal hover:bg-owner-paper  sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function BulkCreateForm({ restaurantId, token, onSuccess, onCancel }) {
  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState("Table ");
  const [type, setType] = useState("square");
  const [minCap, setMinCap] = useState(2);
  const [maxCap, setMaxCap] = useState(4);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await createRestaurantTablesBulk(token, restaurantId, {
        count: Math.min(50, Math.max(1, count)),
        name_prefix: prefix || "Table ",
        type,
        min_capacity: minCap,
        max_capacity: maxCap,
        is_active: true,
      });
      onSuccess();
    } catch (error) {
      setErr(error?.data?.message || error?.message || "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="owner-card rounded-xl p-4">
      <h3 className="mb-3 font-medium text-owner-charcoal">Bulk create tables</h3>
      {err && <p className="mb-2 text-sm text-red-600 ">{err}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-sm text-owner-muted">Count (1–50)</span>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          />
        </label>
        <label>
          <span className="text-sm text-owner-muted">Name prefix</span>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Table "
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          />
        </label>
        <label>
          <span className="text-sm text-owner-muted">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
          >
            {TABLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm text-owner-muted">Capacity</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={1}
              value={minCap}
              onChange={(e) => setMinCap(Number(e.target.value) || 1)}
              placeholder="Min"
              className="w-20 rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
            />
            <span className="self-center text-owner-muted">–</span>
            <input
              type="number"
              min={1}
              value={maxCap}
              onChange={(e) => setMaxCap(Number(e.target.value) || 1)}
              placeholder="Max"
              className="w-20 rounded-lg border border-owner-border bg-owner-card px-3 py-2 text-owner-charcoal"
            />
          </div>
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          type="submit"
          disabled={saving}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl bg-owner-action px-5 py-3 text-base font-medium text-white hover:opacity-90 disabled:opacity-50 sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          {saving ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="touch-manipulation min-h-[48px] flex-1 rounded-xl border border-owner-border px-5 py-3 text-base font-medium text-owner-charcoal hover:bg-owner-paper  sm:flex-none sm:rounded-lg sm:py-2 sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditTableForm({ table, token, onSuccess, onCancel }) {
  const [name, setName] = useState(table.name || "");
  const [type, setType] = useState(table.type || "square");
  const [minCap, setMinCap] = useState(table.min_capacity ?? 2);
  const [maxCap, setMaxCap] = useState(table.max_capacity ?? 4);
  const [active, setActive] = useState(table.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      await updateRestaurantTable(token, table.id, {
        name: name || undefined,
        type,
        min_capacity: minCap,
        max_capacity: maxCap,
        is_active: active,
      });
      onSuccess();
    } catch (error) {
      setErr(error?.data?.message || error?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {err && <p className="mb-2 text-sm text-red-600 ">{err}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className="text-xs text-owner-muted">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 block w-full rounded border border-owner-border px-2 py-1.5 text-sm bg-owner-card text-owner-charcoal"
          />
        </label>
        <label>
          <span className="text-xs text-owner-muted">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-0.5 block w-full rounded border border-owner-border px-2 py-1.5 text-sm bg-owner-card text-owner-charcoal"
          >
            {TABLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-owner-muted">Min / Max</span>
          <div className="mt-0.5 flex gap-1">
            <input
              type="number"
              min={1}
              value={minCap}
              onChange={(e) => setMinCap(Number(e.target.value) || 1)}
              className="w-16 rounded border border-owner-border px-2 py-1.5 text-sm bg-owner-card text-owner-charcoal"
            />
            <input
              type="number"
              min={1}
              value={maxCap}
              onChange={(e) => setMaxCap(Number(e.target.value) || 1)}
              className="w-16 rounded border border-owner-border px-2 py-1.5 text-sm bg-owner-card text-owner-charcoal"
            />
          </div>
        </label>
        <label className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-owner-border"
          />
          <span className="text-sm text-owner-muted">Active</span>
        </label>
      </div>
      <div className="mt-3 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="touch-manipulation min-h-[44px] min-w-[100px] rounded-lg bg-owner-action px-4 py-2.5 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="touch-manipulation min-h-[44px] min-w-[100px] rounded-lg border border-owner-border px-4 py-2.5 text-base font-medium text-owner-charcoal hover:bg-owner-paper"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
