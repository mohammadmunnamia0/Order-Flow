// Browser-persisted data store (replaces the former MongoDB backend).
//
// All collections live in ONE localStorage entry and are loaded / saved as a
// single snapshot. The API layer loads a fresh snapshot per request and only
// writes it back if the handler succeeds, so every operation is atomic: a
// failed request never leaves partially applied changes behind.
//
// Sample data is written only when no saved data exists. Existing data is
// never replaced by the defaults, except when the user explicitly resets or
// when the saved entry is unreadable (it is then backed up before reseeding).
import ApiError from "./ApiError.js";
import { buildSeedData, buildSeedUsers } from "./seed.js";

export const STORAGE_KEY = "orderflow:db";
export const BACKUP_KEY = "orderflow:db:corrupt-backup";
export const TOKEN_KEY = "orderflow:token";
export const SCHEMA_VERSION = 1;

export const ROLES = ["admin", "sales", "warehouse", "viewer"];
export const ORDER_STATUSES = ["Draft", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"];
export const RECONCILIATION_STATUSES = ["Pending", "Approved", "Rejected"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Minimal shape checks per collection — records failing these are dropped on load
const RECORD_VALIDATORS = {
  users: (r) => isStr(r.name) && isStr(r.email) && ROLES.includes(r.role) && isStr(r.salt) && isStr(r.passwordHash),
  products: (r) => isStr(r.name) && isStr(r.sku) && isStr(r.category) && isNum(r.unitPrice) && isNum(r.reorderLevel),
  inventory: (r) => isStr(r.product) && isStr(r.warehouse) && isNum(r.totalStock) && isNum(r.reservedStock),
  customers: (r) => isStr(r.name),
  orders: (r) =>
    isStr(r.orderNumber) && isStr(r.customer) && Array.isArray(r.items) && isNum(r.totalAmount) && ORDER_STATUSES.includes(r.status),
  stockMovements: (r) => isStr(r.product) && isStr(r.type) && isNum(r.quantity),
  reconciliations: (r) => isStr(r.warehouse) && Array.isArray(r.items) && RECONCILIATION_STATUSES.includes(r.status),
  sessions: (r) => isStr(r.user) && isStr(r.expiresAt),
};

export const COLLECTIONS = Object.keys(RECORD_VALIDATORS);

// ─── Storage access (falls back to memory if localStorage is unavailable) ───

let memoryStore = {};
let storageWarned = false;
const notices = [];

function getStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = "orderflow:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function warnNoStorage() {
  if (storageWarned) return;
  storageWarned = true;
  notices.push("Browser storage is unavailable (private mode or blocked). Changes will be lost when the page is closed.");
}

export function readItem(key) {
  const s = getStorage();
  if (!s) {
    warnNoStorage();
    return memoryStore[key] ?? null;
  }
  return s.getItem(key);
}

export function writeItem(key, value) {
  const s = getStorage();
  if (!s) {
    warnNoStorage();
    memoryStore[key] = value;
    return;
  }
  try {
    s.setItem(key, value);
  } catch (err) {
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      throw new ApiError(507, "Browser storage is full. Delete some records or reset the data.");
    }
    throw err;
  }
}

export function removeItem(key) {
  const s = getStorage();
  if (!s) {
    delete memoryStore[key];
    return;
  }
  s.removeItem(key);
}

// Messages about data repairs / storage problems, shown once by the UI
export function consumeNotices() {
  return notices.splice(0, notices.length);
}

// ─── Load / save ───

async function createFreshDb() {
  return {
    version: SCHEMA_VERSION,
    meta: { createdAt: new Date().toISOString(), counters: {} },
    data: await buildSeedData(),
  };
}

function backupCorrupt(raw) {
  try {
    writeItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), raw }));
  } catch {
    // backup is best-effort
  }
}

// Repairs a parsed snapshot in place; returns true if anything was changed
async function repair(db) {
  let changed = false;
  let dropped = 0;

  if (db.version !== SCHEMA_VERSION) {
    db.version = SCHEMA_VERSION;
    changed = true;
  }
  if (!isObj(db.meta)) {
    db.meta = { createdAt: new Date().toISOString(), counters: {} };
    changed = true;
  }
  if (!isObj(db.meta.counters)) {
    db.meta.counters = {};
    changed = true;
  }

  for (const name of COLLECTIONS) {
    const list = db.data[name];
    if (!Array.isArray(list)) {
      db.data[name] = [];
      changed = true;
      if (list !== undefined) dropped++;
      continue;
    }
    const seen = new Set();
    const valid = list.filter((r) => {
      const ok = isObj(r) && isStr(r._id) && !seen.has(r._id) && RECORD_VALIDATORS[name](r);
      if (ok) seen.add(r._id);
      return ok;
    });
    if (valid.length !== list.length) {
      dropped += list.length - valid.length;
      db.data[name] = valid;
      changed = true;
    }
  }

  // Without any active admin nobody could manage the app — restore demo accounts
  if (!db.data.users.some((u) => u.role === "admin" && u.isActive !== false)) {
    const existingEmails = new Set(db.data.users.map((u) => u.email));
    const seedUsers = (await buildSeedUsers()).filter((u) => !existingEmails.has(u.email));
    const seedAdmin = db.data.users.find((u) => u.email === "admin@orderflow.com");
    if (seedAdmin) {
      seedAdmin.role = "admin";
      seedAdmin.isActive = true;
    }
    db.data.users.push(...seedUsers);
    notices.push("No active admin account was found, so the demo accounts were restored.");
    changed = true;
  }

  if (dropped > 0) {
    notices.push(`${dropped} invalid saved record(s) were found and removed.`);
  }
  return changed;
}

export async function loadDb() {
  const raw = readItem(STORAGE_KEY);

  // First visit: initialise with sample data
  if (raw === null) {
    const db = await createFreshDb();
    saveDb(db);
    return db;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }

  if (!isObj(parsed) || !isObj(parsed.data)) {
    backupCorrupt(raw);
    notices.push("Saved data could not be read and was restored to the sample data. A backup was kept in browser storage.");
    const db = await createFreshDb();
    saveDb(db);
    return db;
  }

  if (await repair(parsed)) saveDb(parsed);
  return parsed;
}

export function saveDb(db) {
  writeItem(STORAGE_KEY, JSON.stringify(db));
}

export async function resetDb() {
  const db = await createFreshDb();
  saveDb(db);
  removeItem(TOKEN_KEY);
  return db;
}

// ─── Helpers shared by handlers ───

export const nowIso = () => new Date().toISOString();

export function stamp(doc) {
  const now = nowIso();
  return { ...doc, createdAt: now, updatedAt: now };
}

export function touch(doc) {
  doc.updatedAt = nowIso();
  return doc;
}
