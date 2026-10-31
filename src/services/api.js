// Local, browser-only replacement for the former REST API.
//
// Exposes the same axios-like interface the pages already use
// (API.get / post / put / delete → `{ data }`, errors with
// `err.response.data.message`), but requests are routed to in-browser
// handlers that read and write the localStorage-backed store.
import ApiError from "../data/ApiError.js";
import { loadDb, saveDb, resetDb, consumeNotices, readItem, writeItem, removeItem, TOKEN_KEY } from "../data/db.js";
import * as auth from "./handlers/auth.js";
import * as users from "./handlers/users.js";
import * as products from "./handlers/products.js";
import * as inventory from "./handlers/inventory.js";
import * as customers from "./handlers/customers.js";
import * as orders from "./handlers/orders.js";
import * as fulfillment from "./handlers/fulfillment.js";
import * as reconciliation from "./handlers/reconciliation.js";
import * as stockMovements from "./handlers/stockMovements.js";
import * as dashboard from "./handlers/dashboard.js";

const ADMIN = ["admin"];
const ADMIN_SALES = ["admin", "sales"];
const ADMIN_WAREHOUSE = ["admin", "warehouse"];

// [method, path, handler, options] — more specific paths must come first
const ROUTES = [
  ["POST", "/auth/register", auth.register, { public: true }],
  ["POST", "/auth/login", auth.login, { public: true }],
  ["POST", "/auth/logout", auth.logout, { public: true }],
  ["GET", "/auth/me", auth.me],
  ["PUT", "/auth/change-password", auth.changePassword],

  ["GET", "/users", users.list, { roles: ADMIN }],
  ["PUT", "/users/:id", users.update, { roles: ADMIN }],
  ["DELETE", "/users/:id", users.remove, { roles: ADMIN }],

  ["GET", "/products/categories/list", products.categories],
  ["GET", "/products", products.list],
  ["GET", "/products/:id", products.get],
  ["POST", "/products", products.create, { roles: ADMIN }],
  ["PUT", "/products/:id", products.update, { roles: ADMIN }],
  ["PUT", "/products/:id/archive", products.archive, { roles: ADMIN }],

  ["GET", "/inventory/warehouses/list", inventory.warehouses],
  ["GET", "/inventory", inventory.list],
  ["GET", "/inventory/:id", inventory.get],
  ["PUT", "/inventory/:id/adjust", inventory.adjust, { roles: ADMIN_WAREHOUSE }],

  ["GET", "/customers", customers.list],
  ["GET", "/customers/:id", customers.get],
  ["POST", "/customers", customers.create, { roles: ADMIN_SALES }],
  ["PUT", "/customers/:id", customers.update, { roles: ADMIN_SALES }],
  ["DELETE", "/customers/:id", customers.remove, { roles: ADMIN }],

  ["GET", "/orders/export/csv", orders.exportCsv, { roles: ADMIN }],
  ["GET", "/orders", orders.list],
  ["GET", "/orders/:id", orders.get],
  ["POST", "/orders", orders.create, { roles: ADMIN_SALES }],
  ["PUT", "/orders/:id", orders.update, { roles: ADMIN_SALES }],
  ["PUT", "/orders/:id/confirm", orders.confirm, { roles: ADMIN_SALES }],
  ["PUT", "/orders/:id/cancel", orders.cancel, { roles: ADMIN_SALES }],

  ["GET", "/fulfillment", fulfillment.list, { roles: ADMIN_WAREHOUSE }],
  ["PUT", "/fulfillment/:id/pack", fulfillment.pack, { roles: ADMIN_WAREHOUSE }],
  ["PUT", "/fulfillment/:id/ship", fulfillment.ship, { roles: ADMIN_WAREHOUSE }],
  ["PUT", "/fulfillment/:id/deliver", fulfillment.deliver, { roles: ADMIN_WAREHOUSE }],

  ["GET", "/reconciliation", reconciliation.list, { roles: ADMIN_WAREHOUSE }],
  ["POST", "/reconciliation", reconciliation.create, { roles: ADMIN_WAREHOUSE }],
  ["PUT", "/reconciliation/:id/approve", reconciliation.approve, { roles: ADMIN }],
  ["PUT", "/reconciliation/:id/reject", reconciliation.reject, { roles: ADMIN }],

  ["GET", "/dashboard", dashboard.get],
  ["GET", "/stock-movements", stockMovements.list],
].map(([method, path, handler, options = {}]) => {
  const keys = [];
  const pattern = new RegExp(
    "^" + path.replace(/:(\w+)/g, (_, key) => (keys.push(key), "([^/]+)")) + "/?$"
  );
  return { method, pattern, keys, handler, ...options };
});

function matchRoute(method, path) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const m = path.match(route.pattern);
    if (m) {
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return { route, params };
    }
  }
  return null;
}

// ─── Session token ───

export const tokenStore = {
  get: () => {
    try {
      return readItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => writeItem(TOKEN_KEY, token),
  clear: () => {
    try {
      removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

// ─── Request pipeline ───

// Requests run one at a time so concurrent calls can't overwrite each other's changes
let queue = Promise.resolve();
const enqueue = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

function buildQuery(url, params) {
  const [path, qs = ""] = url.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) query[k] = String(v);
  }
  return { path, query };
}

async function handle(method, url, body, config = {}) {
  const { path, query } = buildQuery(url, config.params);
  const match = matchRoute(method, path);
  if (!match) throw new ApiError(404, `Route not found: ${method} ${path}`);
  const { route, params } = match;

  const db = await loadDb();
  const token = tokenStore.get();
  const ctx = {
    db: db.data,
    meta: db.meta,
    params,
    query,
    body: body && typeof body === "object" ? body : {},
    token,
  };

  if (!route.public) {
    ctx.user = auth.authenticate(db.data, token);
    if (route.roles && !route.roles.includes(ctx.user.role)) {
      throw new ApiError(403, `Role '${ctx.user.role}' is not authorized to access this resource`);
    }
  }

  const result = await route.handler(ctx);

  // Persist only after the handler succeeded — failed requests change nothing
  if (method !== "GET") saveDb(db);

  // Hand back a detached copy so callers can never mutate stored data
  return { data: result === undefined ? null : JSON.parse(JSON.stringify(result)), status: 200 };
}

function request(method, url, body, config) {
  return enqueue(async () => {
    try {
      return await handle(method, url, body, config);
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError(500, `Unexpected error: ${err?.message || err}`);
      if (!(err instanceof ApiError)) console.error(err);

      // Expired / invalid session on a protected page → back to login
      if (error.status === 401 && !url.startsWith("/auth/") && tokenStore.get()) {
        tokenStore.clear();
        if (typeof window !== "undefined") window.location.assign("/login");
      }
      throw error;
    }
  });
}

const API = {
  get: (url, config) => request("GET", url, undefined, config),
  delete: (url, config) => request("DELETE", url, undefined, config),
  post: (url, data, config) => request("POST", url, data, config),
  put: (url, data, config) => request("PUT", url, data, config),
};

export default API;

// Loads (and on first visit seeds) the local data store.
// Returns any repair / storage warnings that should be shown to the user.
export function initializeData() {
  return enqueue(async () => {
    await loadDb();
    return consumeNotices();
  });
}

// Replaces all saved data with the default sample data and signs out.
export function resetData() {
  return enqueue(async () => {
    await resetDb();
    tokenStore.clear();
  });
}
