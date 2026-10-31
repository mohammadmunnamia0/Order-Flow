import ApiError from "../../data/ApiError.js";
import { newId } from "../../data/crypto.js";
import { stamp, touch, nowIso } from "../../data/db.js";
import { DEFAULT_WAREHOUSE } from "../../data/seed.js";
import {
  assertValid, str, isInt, isNonNegative, findById, mustFind, ref, userRef, contains, newestFirst, paginate,
  round2, findInventory, logMovement,
} from "./utils.js";

// Populated order shape returned by list / mutation endpoints
export const populateOrder = (db, order, customerFields = ["name", "email", "phone"]) => ({
  ...order,
  customer: ref(db.customers, order.customer, customerFields),
  createdBy: userRef(db, order.createdBy),
});

// Order number: ORD-YYYYMMDD-0001 (sequential per day, collision-free)
function generateOrderNumber(db, meta) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const key = `order_${datePart}`;
  const existing = new Set(db.orders.map((o) => o.orderNumber));
  let orderNumber;
  do {
    meta.counters[key] = (meta.counters[key] || 0) + 1;
    orderNumber = `ORD-${datePart}-${String(meta.counters[key]).padStart(4, "0")}`;
  } while (existing.has(orderNumber));
  return orderNumber;
}

// Validates items and builds order lines + total
function buildItems(db, items) {
  assertValid([[Array.isArray(items) && items.length > 0, "items", "At least one item is required"]]);

  const productIds = items.map((i) => i?.product);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(400, "Duplicate products found. Combine quantities instead.");
  }

  let totalAmount = 0;
  const lines = items.map((item) => {
    assertValid([
      [item?.product, "items.product", "Product ID is required for each item"],
      [isInt(item.quantity, 1), "items.quantity", "All item quantities must be at least 1"],
      [isNonNegative(item.unitPrice), "items.unitPrice", "Unit price must be non-negative"],
    ]);
    const product = findById(db.products, item.product);
    if (!product) throw new ApiError(400, "One or more products no longer exist");
    if (product.isArchived) throw new ApiError(400, `${product.name} is archived and cannot be ordered`);

    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const total = round2(quantity * unitPrice);
    totalAmount += total;
    return { _id: newId(), product: product._id, productName: product.name, sku: product.sku, quantity, unitPrice, total };
  });

  return { lines, totalAmount: round2(totalAmount) };
}

function assertCustomer(db, id) {
  assertValid([[id, "customer", "Customer is required"]]);
  if (!findById(db.customers, id)) throw new ApiError(400, "Customer not found");
}

// GET /orders
export function list({ db, query }) {
  let items = db.orders;
  if (query.status) items = items.filter((o) => o.status === query.status);
  if (query.search) {
    const s = query.search.toLowerCase();
    items = items.filter((o) => contains(o.orderNumber, s));
  }
  return paginate(newestFirst(items), query, (o) => populateOrder(db, o));
}

// GET /orders/:id
export function get({ db, params }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  return {
    ...order,
    customer: ref(db.customers, order.customer),
    createdBy: userRef(db, order.createdBy, ["name", "email"]),
    items: order.items.map((i) => ({ ...i, product: ref(db.products, i.product, ["name", "sku"]) })),
  };
}

// POST /orders — create Draft order
export function create({ db, meta, body, user }) {
  assertCustomer(db, body.customer);
  const { lines, totalAmount } = buildItems(db, body.items);

  const order = stamp({
    _id: newId(),
    orderNumber: generateOrderNumber(db, meta),
    customer: body.customer,
    items: lines,
    totalAmount,
    status: "Draft",
    warehouse: str(body.warehouse) || DEFAULT_WAREHOUSE,
    carrierName: "",
    trackingNumber: "",
    notes: str(body.notes),
    createdBy: user._id,
  });
  db.orders.push(order);
  return populateOrder(db, order);
}

// PUT /orders/:id — edit Draft order
export function update({ db, params, body }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  if (order.status !== "Draft") throw new ApiError(400, "Only Draft orders can be edited");

  const { customer, items, warehouse, notes } = body;
  if (items && items.length > 0) {
    const { lines, totalAmount } = buildItems(db, items);
    order.items = lines;
    order.totalAmount = totalAmount;
  }
  if (customer) {
    assertCustomer(db, customer);
    order.customer = customer;
  }
  if (str(warehouse)) order.warehouse = str(warehouse);
  if (notes !== undefined) order.notes = str(notes);

  touch(order);
  return populateOrder(db, order);
}

// PUT /orders/:id/confirm — confirm & reserve stock
export function confirm({ db, params, user }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  if (order.status !== "Draft") throw new ApiError(400, "Only Draft orders can be confirmed");

  // Validate every line first so nothing is reserved if one fails
  const records = order.items.map((item) => {
    const inv = findInventory(db, item.product, order.warehouse);
    if (!inv) throw new ApiError(400, `No inventory record for ${item.productName} (${item.sku})`);
    const available = inv.totalStock - inv.reservedStock;
    if (available < item.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for ${item.productName} (${item.sku}). Available: ${available}, Requested: ${item.quantity}`
      );
    }
    return inv;
  });

  order.items.forEach((item, i) => {
    records[i].reservedStock += item.quantity;
    touch(records[i]);
    logMovement(db, {
      product: item.product,
      warehouse: order.warehouse,
      type: "SALE_RESERVE",
      quantity: -item.quantity,
      reference: order.orderNumber,
      reason: `Stock reserved for order ${order.orderNumber}`,
      performedBy: user._id,
    });
  });

  order.status = "Confirmed";
  order.confirmedAt = nowIso();
  touch(order);
  return populateOrder(db, order);
}

// PUT /orders/:id/cancel — cancel & release reserved stock
export function cancel({ db, params, user }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  if (!["Draft", "Confirmed"].includes(order.status)) {
    throw new ApiError(400, "Only Draft or Confirmed orders can be cancelled");
  }

  if (order.status === "Confirmed") {
    for (const item of order.items) {
      const inv = findInventory(db, item.product, order.warehouse);
      if (inv) {
        inv.reservedStock = Math.max(0, inv.reservedStock - item.quantity);
        touch(inv);
      }
      logMovement(db, {
        product: item.product,
        warehouse: order.warehouse,
        type: "CANCEL_RESTORE",
        quantity: item.quantity,
        reference: order.orderNumber,
        reason: `Stock restored from cancelled order ${order.orderNumber}`,
        performedBy: user._id,
      });
    }
  }

  order.status = "Cancelled";
  order.cancelledAt = nowIso();
  touch(order);
  return populateOrder(db, order);
}

// GET /orders/export/csv
export function exportCsv({ db, query }) {
  const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let items = db.orders;
  if (query.status) items = items.filter((o) => o.status === query.status);

  const header = "Order Number,Customer,Items,Total Amount,Status,Warehouse,Created Date,Created By";
  const rows = newestFirst(items).map((o) =>
    [
      o.orderNumber,
      csvCell(findById(db.customers, o.customer)?.name),
      o.items.length,
      o.totalAmount.toFixed(2),
      o.status,
      csvCell(o.warehouse),
      o.createdAt,
      csvCell(findById(db.users, o.createdBy)?.name),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}
