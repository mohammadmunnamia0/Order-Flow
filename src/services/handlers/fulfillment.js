import ApiError from "../../data/ApiError.js";
import { touch, nowIso } from "../../data/db.js";
import { str, mustFind, newestFirst, paginate, findInventory, logMovement } from "./utils.js";
import { populateOrder } from "./orders.js";

// GET /fulfillment — orders ready for fulfillment (Confirmed, Packed, Shipped)
export function list({ db, query }) {
  const statuses = query.status ? [query.status] : ["Confirmed", "Packed", "Shipped"];
  const items = db.orders.filter((o) => statuses.includes(o.status));
  return paginate(newestFirst(items), query, (o) => populateOrder(db, o, ["name", "email", "phone", "address", "city"]));
}

// PUT /fulfillment/:id/pack
export function pack({ db, params }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  if (order.status !== "Confirmed") throw new ApiError(400, "Only Confirmed orders can be packed");

  order.status = "Packed";
  order.packedAt = nowIso();
  touch(order);
  return populateOrder(db, order);
}

// PUT /fulfillment/:id/ship — ship & deduct reserved stock
export function ship({ db, params, body, user }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  if (order.status !== "Packed") throw new ApiError(400, "Only Packed orders can be shipped");

  // Validate every line before changing anything
  const records = order.items.map((item) => {
    const inv = findInventory(db, item.product, order.warehouse);
    if (!inv) throw new ApiError(400, `Inventory record not found for ${item.productName} (${item.sku})`);
    if (inv.totalStock < item.quantity) {
      throw new ApiError(400, `Insufficient stock to ship ${item.productName} (${item.sku}). In stock: ${inv.totalStock}`);
    }
    return inv;
  });

  order.items.forEach((item, i) => {
    const inv = records[i];
    inv.totalStock -= item.quantity;
    inv.reservedStock = Math.max(0, inv.reservedStock - item.quantity);
    touch(inv);
    logMovement(db, {
      product: item.product,
      warehouse: order.warehouse,
      type: "SALE_DEDUCT",
      quantity: -item.quantity,
      reference: order.orderNumber,
      reason: `Stock deducted on shipment of order ${order.orderNumber}`,
      performedBy: user._id,
    });
  });

  const now = nowIso();
  order.status = "Shipped";
  order.shippedAt = now;
  order.dispatchDate = now;
  order.carrierName = str(body.carrierName);
  order.trackingNumber = str(body.trackingNumber);
  touch(order);
  return populateOrder(db, order);
}

// PUT /fulfillment/:id/deliver
export function deliver({ db, params }) {
  const order = mustFind(db.orders, params.id, "Order not found");
  if (order.status !== "Shipped") throw new ApiError(400, "Only Shipped orders can be delivered");

  const now = nowIso();
  order.status = "Delivered";
  order.deliveredAt = now;
  order.deliveryDate = now;
  touch(order);
  return populateOrder(db, order);
}
