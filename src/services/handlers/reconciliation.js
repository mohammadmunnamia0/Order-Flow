import ApiError from "../../data/ApiError.js";
import { newId } from "../../data/crypto.js";
import { stamp, touch, nowIso } from "../../data/db.js";
import {
  assertValid, str, isInt, findById, mustFind, ref, userRef, newestFirst, paginate, findInventory, logMovement,
} from "./utils.js";

const populate = (db, rec) => ({
  ...rec,
  conductedBy: userRef(db, rec.conductedBy),
  approvedBy: userRef(db, rec.approvedBy),
  items: rec.items.map((i) => ({ ...i, product: ref(db.products, i.product, ["name", "sku"]) })),
});

// GET /reconciliation
export function list({ db, query }) {
  let items = db.reconciliations;
  if (query.status) items = items.filter((r) => r.status === query.status);
  return paginate(newestFirst(items), query, (r) => populate(db, r));
}

// POST /reconciliation — submit a physical count
export function create({ db, body, user }) {
  const warehouse = str(body.warehouse);
  const { items } = body;
  assertValid([
    [warehouse, "warehouse", "Warehouse is required"],
    [Array.isArray(items) && items.length > 0, "items", "At least one item is required"],
  ]);

  const reconItems = items.map((item) => {
    assertValid([
      [item?.product, "items.product", "Product is required for each item"],
      [isInt(item.physicalStock, 0), "items.physicalStock", "Physical stock must be a non-negative whole number"],
    ]);
    if (!findById(db.products, item.product)) throw new ApiError(400, "One or more products no longer exist");

    const physicalStock = Number(item.physicalStock);
    const systemStock = findInventory(db, item.product, warehouse)?.totalStock ?? 0;
    return { _id: newId(), product: item.product, systemStock, physicalStock, variance: physicalStock - systemStock };
  });

  const rec = stamp({
    _id: newId(),
    warehouse,
    items: reconItems,
    status: "Pending",
    notes: str(body.notes),
    conductedBy: user._id,
  });
  db.reconciliations.push(rec);
  return populate(db, rec);
}

// PUT /reconciliation/:id/approve — apply the counted stock levels
export function approve({ db, params, user }) {
  const rec = mustFind(db.reconciliations, params.id, "Reconciliation not found");
  if (rec.status !== "Pending") throw new ApiError(400, "Only Pending reconciliations can be approved");

  for (const item of rec.items) {
    if (item.variance === 0) continue;
    let inv = findInventory(db, item.product, rec.warehouse);
    if (!inv) {
      inv = stamp({ _id: newId(), product: item.product, warehouse: rec.warehouse, totalStock: 0, reservedStock: 0 });
      db.inventory.push(inv);
    }
    inv.totalStock = item.physicalStock;
    touch(inv);

    logMovement(db, {
      product: item.product,
      warehouse: rec.warehouse,
      type: item.variance > 0 ? "POSITIVE_ADJUSTMENT" : "NEGATIVE_ADJUSTMENT",
      quantity: item.variance,
      reference: rec._id,
      reason: "Stock reconciliation adjustment",
      performedBy: user._id,
    });
  }

  rec.status = "Approved";
  rec.approvedBy = user._id;
  rec.approvedAt = nowIso();
  touch(rec);
  return populate(db, rec);
}

// PUT /reconciliation/:id/reject
export function reject({ db, params }) {
  const rec = mustFind(db.reconciliations, params.id, "Reconciliation not found");
  if (rec.status !== "Pending") throw new ApiError(400, "Only Pending reconciliations can be rejected");

  rec.status = "Rejected";
  touch(rec);
  return populate(db, rec);
}
