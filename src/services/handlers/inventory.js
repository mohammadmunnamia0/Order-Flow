import ApiError from "../../data/ApiError.js";
import { touch } from "../../data/db.js";
import { assertValid, str, isNumber, mustFind, ref, newestFirst, paginate, logMovement } from "./utils.js";

const PRODUCT_FIELDS = ["name", "sku", "category", "unitPrice", "reorderLevel", "isArchived"];

// Equivalent of the old `availableStock` mongoose virtual + product populate
export const withProduct = (db, inv) => ({
  ...inv,
  product: ref(db.products, inv.product, PRODUCT_FIELDS),
  availableStock: inv.totalStock - inv.reservedStock,
});

// GET /inventory
export function list({ db, query }) {
  let items = db.inventory;
  if (query.warehouse) items = items.filter((i) => i.warehouse === query.warehouse);

  // Hide archived / missing products
  items = newestFirst(items, "updatedAt")
    .map((i) => withProduct(db, i))
    .filter((i) => i.product && !i.product.isArchived);

  if (query.lowStock === "true") {
    items = items.filter((i) => i.totalStock <= i.product.reorderLevel);
  }
  return paginate(items, query);
}

// GET /inventory/:id
export function get({ db, params }) {
  return withProduct(db, mustFind(db.inventory, params.id, "Inventory record not found"));
}

// PUT /inventory/:id/adjust — manual stock adjustment
export function adjust({ db, params, body, user }) {
  const { quantity, type, reason } = body;
  assertValid([
    [isNumber(quantity) && Number(quantity) > 0, "quantity", "Quantity must be a positive number"],
    [["MANUAL_ADD", "MANUAL_REMOVE"].includes(type), "type", "Type must be MANUAL_ADD or MANUAL_REMOVE"],
  ]);

  const inv = mustFind(db.inventory, params.id, "Inventory record not found");
  const qty = Math.abs(Number(quantity));

  if (type === "MANUAL_ADD") {
    inv.totalStock += qty;
  } else {
    if (inv.totalStock - inv.reservedStock < qty) {
      throw new ApiError(400, "Cannot remove more than available stock");
    }
    inv.totalStock -= qty;
  }
  touch(inv);

  logMovement(db, {
    product: inv.product,
    warehouse: inv.warehouse,
    type,
    quantity: type === "MANUAL_ADD" ? qty : -qty,
    reason: str(reason) || "Manual adjustment",
    performedBy: user._id,
  });

  return withProduct(db, inv);
}

// GET /inventory/warehouses/list
export function warehouses({ db }) {
  return [...new Set(db.inventory.map((i) => i.warehouse))].sort();
}
