import { newestFirst, round2 } from "./utils.js";
import { populateOrder } from "./orders.js";
import { withProduct } from "./inventory.js";

// GET /dashboard
export function get({ db }) {
  const orders = db.orders;
  const count = (pred) => orders.filter(pred).length;

  const totalOrders = orders.length;
  const pendingOrders = count((o) => ["Draft", "Confirmed", "Packed"].includes(o.status));
  const deliveredOrders = count((o) => o.status === "Delivered");
  const cancelledOrders = count((o) => o.status === "Cancelled");

  const statusCounts = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  const statusBreakdown = Object.entries(statusCounts).map(([_id, c]) => ({ _id, count: c }));

  const recentOrders = newestFirst(orders).slice(0, 10).map((o) => populateOrder(db, o, ["name"]));

  // Orders per day (UTC date) for the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const trend = {};
  for (const o of orders) {
    if (new Date(o.createdAt) < sevenDaysAgo) continue;
    const day = new Date(o.createdAt).toISOString().slice(0, 10);
    trend[day] ??= { _id: day, count: 0, totalAmount: 0 };
    trend[day].count += 1;
    trend[day].totalAmount = round2(trend[day].totalAmount + o.totalAmount);
  }
  const orderTrend = Object.values(trend).sort((a, b) => a._id.localeCompare(b._id));

  // Average confirm → deliver time, in hours
  const processing = orders
    .filter((o) => o.status === "Delivered" && o.confirmedAt && o.deliveredAt)
    .map((o) => Date.parse(o.deliveredAt) - Date.parse(o.confirmedAt))
    .filter(Number.isFinite);
  const avgProcessingTime = processing.length
    ? Math.round(processing.reduce((a, b) => a + b, 0) / processing.length / 3600000)
    : 0;

  const activeInventory = db.inventory.map((i) => withProduct(db, i)).filter((i) => i.product && !i.product.isArchived);
  const lowStock = activeInventory.filter((i) => i.totalStock <= i.product.reorderLevel);
  const outOfStockItems = activeInventory.filter((i) => i.totalStock === 0).length;
  const healthyStock = activeInventory.length - lowStock.length;
  const inventoryAccuracy = activeInventory.length > 0 ? Math.round((healthyStock / activeInventory.length) * 100) : 100;
  const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

  const stockAlerts = lowStock.map((i) => ({
    product: i.product.name,
    sku: i.product.sku,
    currentStock: i.totalStock,
    reorderLevel: i.product.reorderLevel,
    warehouse: i.warehouse,
  }));

  return {
    kpis: {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      lowStockItems: lowStock.length,
      outOfStockItems,
      inventoryAccuracy,
      fulfillmentRate,
      avgProcessingTime,
    },
    statusBreakdown,
    recentOrders,
    orderTrend,
    stockAlerts,
  };
}
