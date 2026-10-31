// Shared helpers for the local API handlers (ported from the old server's
// middleware / utils).
import ApiError from "../../data/ApiError.js";
import { newId } from "../../data/crypto.js";
import { stamp } from "../../data/db.js";

// ─── Validation ───

export const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
export const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";
export const isEmail = (v) => /^\S+@\S+\.\S+$/.test(v);
export const normalizeEmail = (v) => str(v).toLowerCase();
export const isNumber = (v) => !isBlank(v) && Number.isFinite(Number(v));
export const isNonNegative = (v) => isNumber(v) && Number(v) >= 0;
export const isInt = (v, min = -Infinity) => isNumber(v) && Number.isInteger(Number(v)) && Number(v) >= min;

// checks: [[condition, field, message], ...] — throws on the first failing check
export function assertValid(checks) {
  const errors = checks.filter(([ok]) => !ok).map(([, field, message]) => ({ field, message }));
  if (errors.length > 0) throw new ApiError(400, errors[0].message, errors);
}

// ─── Lookup / shaping ───

export const findById = (list, id) => list.find((d) => d._id === id) || null;

export function mustFind(list, id, message) {
  const doc = findById(list, id);
  if (!doc) throw new ApiError(404, message);
  return doc;
}

export function pick(doc, fields) {
  if (!doc) return null;
  const out = { _id: doc._id };
  for (const f of fields) if (doc[f] !== undefined) out[f] = doc[f];
  return out;
}

// Equivalent of mongoose populate(): returns the referenced doc (or selected fields) or null
export const ref = (list, id, fields) => {
  const doc = findById(list, id);
  return fields ? pick(doc, fields) : doc;
};

export function publicUser(user) {
  if (!user) return null;
  const { salt, passwordHash, ...rest } = user;
  return rest;
}

export const userRef = (db, id, fields = ["name"]) => pick(publicUser(findById(db.users, id)), fields);

export const contains = (value, needle) => String(value ?? "").toLowerCase().includes(needle);

export const newestFirst = (list, field = "createdAt") =>
  [...list].sort((a, b) => String(b[field] ?? "").localeCompare(String(a[field] ?? "")));

// Standard pagination — same response shape as the old REST API
export function paginate(list, query, map = (x) => x) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const skip = (page - 1) * limit;
  return {
    data: list.slice(skip, skip + limit).map(map),
    total: list.length,
    page,
    pages: Math.ceil(list.length / limit),
  };
}

export const round2 = (n) => Math.round(n * 100) / 100;

// ─── Stock ───

export const findInventory = (db, product, warehouse) =>
  db.inventory.find((i) => i.product === product && i.warehouse === warehouse) || null;

export function logMovement(db, { product, warehouse, type, quantity, reference = "", reason = "", performedBy }) {
  const movement = stamp({ _id: newId(), product, warehouse, type, quantity, reference, reason, performedBy });
  db.stockMovements.push(movement);
  return movement;
}
