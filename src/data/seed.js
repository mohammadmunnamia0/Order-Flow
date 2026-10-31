// Default sample dataset, loaded into the browser on first visit (or on reset).
// Ported from the former server-side MongoDB seed script.
import { newId, randomHex, hashPassword } from "./crypto.js";

export const DEFAULT_WAREHOUSE = "Main Warehouse";
export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS = [
  { name: "Admin User", email: "admin@orderflow.com", role: "admin" },
  { name: "Sales Executive", email: "sales@orderflow.com", role: "sales" },
  { name: "Warehouse Manager", email: "warehouse@orderflow.com", role: "warehouse" },
  { name: "Viewer User", email: "viewer@orderflow.com", role: "viewer" },
];

export async function createUserRecord({ name, email, password, role, isActive = true }, at = new Date()) {
  const salt = randomHex(16);
  const iso = at.toISOString();
  return {
    _id: newId(),
    name,
    email,
    role,
    isActive,
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: iso,
    updatedAt: iso,
  };
}

export async function buildSeedUsers() {
  const created = new Date(Date.now() - 30 * 86400000);
  return Promise.all(
    DEMO_ACCOUNTS.map((acc) => createUserRecord({ ...acc, password: DEMO_PASSWORD }, created))
  );
}

export async function buildSeedData() {
  const now = Date.now();
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
  const stamp = (doc, createdAt = daysAgo(30), updatedAt = createdAt) => ({ _id: newId(), ...doc, createdAt, updatedAt });

  // ─── USERS ───
  const users = await buildSeedUsers();
  const [admin, sales, warehouse] = users;

  // ─── PRODUCTS ───
  const products = [
    { name: "Laptop Dell XPS 15", sku: "LAP-DELL-001", category: "Electronics", unitPrice: 1299.99, reorderLevel: 10, description: "Dell XPS 15 laptop with 15.6 inch display" },
    { name: "Wireless Mouse Logitech", sku: "MOU-LOG-001", category: "Accessories", unitPrice: 29.99, reorderLevel: 50, description: "Logitech wireless mouse M720" },
    { name: "USB-C Hub 7-in-1", sku: "HUB-USB-001", category: "Accessories", unitPrice: 49.99, reorderLevel: 25, description: "7-in-1 USB-C hub adapter with HDMI" },
    { name: "Monitor Samsung 27\"", sku: "MON-SAM-001", category: "Electronics", unitPrice: 349.99, reorderLevel: 15, description: "Samsung 27 inch 4K IPS monitor" },
    { name: "Mechanical Keyboard", sku: "KEY-MEC-001", category: "Accessories", unitPrice: 89.99, reorderLevel: 30, description: "RGB mechanical keyboard Cherry MX" },
    { name: "Webcam HD 1080p", sku: "CAM-HD-001", category: "Electronics", unitPrice: 69.99, reorderLevel: 20, description: "HD 1080p webcam with auto-focus" },
    { name: "Ethernet Cable Cat6 3m", sku: "CAB-ETH-001", category: "Cables", unitPrice: 9.99, reorderLevel: 100, description: "Cat6 ethernet cable 3 meters shielded" },
    { name: "Laptop Stand Aluminium", sku: "STD-LAP-001", category: "Accessories", unitPrice: 39.99, reorderLevel: 20, description: "Aluminium ergonomic laptop stand" },
    { name: "Wireless Headset Sony", sku: "HDS-SNY-001", category: "Electronics", unitPrice: 199.99, reorderLevel: 15, description: "Sony WH-1000XM5 wireless headset" },
    { name: "USB Flash Drive 64GB", sku: "USB-FLS-001", category: "Storage", unitPrice: 14.99, reorderLevel: 80, description: "64GB USB 3.0 flash drive" },
    { name: "HDMI Cable 2m", sku: "CAB-HDM-001", category: "Cables", unitPrice: 12.99, reorderLevel: 60, description: "HDMI 2.1 cable 2 meters 8K support" },
    { name: "Desk Organizer Set", sku: "ORG-DSK-001", category: "Accessories", unitPrice: 24.99, reorderLevel: 40, description: "5-piece desk organizer set bamboo" },
  ].map((p) => stamp({ ...p, isArchived: false, createdBy: admin._id }));

  // ─── INVENTORY & INITIAL STOCK MOVEMENTS ───
  const stockLevels = [120, 200, 80, 45, 8, 60, 500, 30, 75, 300, 150, 90];
  const reservedLevels = [5, 10, 3, 2, 0, 4, 20, 0, 5, 15, 8, 3];

  const inventory = products.map((p, i) =>
    stamp({ product: p._id, warehouse: DEFAULT_WAREHOUSE, totalStock: stockLevels[i], reservedStock: reservedLevels[i] })
  );

  const stockMovements = products.map((p, i) =>
    stamp({
      product: p._id,
      warehouse: DEFAULT_WAREHOUSE,
      type: "INITIAL",
      quantity: stockLevels[i],
      reference: "",
      reason: "Initial stock on seed",
      performedBy: admin._id,
    })
  );

  // ─── CUSTOMERS ───
  const customers = [
    { name: "TechCorp Inc.", email: "orders@techcorp.com", phone: "555-0101", address: "123 Tech Street", city: "San Francisco" },
    { name: "Office Solutions Ltd", email: "buy@officesolutions.com", phone: "555-0102", address: "456 Business Ave", city: "New York" },
    { name: "StartupHub", email: "procurement@startuphub.com", phone: "555-0103", address: "789 Innovation Blvd", city: "Austin" },
    { name: "EduTech Academy", email: "supplies@edutech.edu", phone: "555-0104", address: "321 Campus Dr", city: "Boston" },
    { name: "GlobalRetail Corp", email: "sourcing@globalretail.com", phone: "555-0105", address: "555 Market St", city: "Chicago" },
    { name: "MediSupply Inc.", email: "orders@medisupply.com", phone: "555-0106", address: "100 Health Way", city: "Dallas" },
  ].map((c) => stamp({ ...c, createdBy: sales._id }));

  // ─── ORDERS (various statuses for testing fulfillment flow) ───
  const item = (p, quantity) => ({
    _id: newId(),
    product: products[p]._id,
    productName: products[p].name,
    sku: products[p].sku,
    quantity,
    unitPrice: products[p].unitPrice,
    total: Math.round(quantity * products[p].unitPrice * 100) / 100,
  });
  const order = (orderNumber, customer, items, status, createdDaysAgo, extra = {}) => {
    const createdAt = daysAgo(createdDaysAgo);
    return stamp(
      {
        orderNumber,
        customer: customers[customer]._id,
        items,
        totalAmount: Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100,
        status,
        warehouse: DEFAULT_WAREHOUSE,
        carrierName: "",
        trackingNumber: "",
        notes: "",
        createdBy: sales._id,
        ...extra,
      },
      createdAt
    );
  };

  const orders = [
    order("ORD-2026-0001", 0, [item(0, 2), item(1, 5)], "Draft", 1, {
      notes: "Urgent order for new office setup",
    }),
    order("ORD-2026-0002", 1, [item(3, 3), item(4, 10)], "Confirmed", 3, {
      confirmedAt: daysAgo(2),
    }),
    order("ORD-2026-0003", 2, [item(2, 4), item(5, 6), item(7, 4)], "Packed", 6, {
      confirmedAt: daysAgo(5), packedAt: daysAgo(3),
    }),
    order("ORD-2026-0004", 3, [item(0, 1), item(8, 3)], "Shipped", 10, {
      confirmedAt: daysAgo(8), packedAt: daysAgo(6), shippedAt: daysAgo(4), dispatchDate: daysAgo(4),
      carrierName: "FedEx", trackingNumber: "FX-789456123",
    }),
    order("ORD-2026-0005", 0, [item(6, 50), item(10, 20)], "Delivered", 18, {
      confirmedAt: daysAgo(15), packedAt: daysAgo(13), shippedAt: daysAgo(12), deliveredAt: daysAgo(8),
      dispatchDate: daysAgo(12), deliveryDate: daysAgo(8), carrierName: "UPS", trackingNumber: "UPS-321654987",
    }),
    order("ORD-2026-0006", 4, [item(9, 100), item(11, 15)], "Delivered", 25, {
      confirmedAt: daysAgo(22), packedAt: daysAgo(20), shippedAt: daysAgo(18), deliveredAt: daysAgo(14),
      dispatchDate: daysAgo(18), deliveryDate: daysAgo(14), carrierName: "DHL", trackingNumber: "DHL-654321789",
    }),
    order("ORD-2026-0007", 5, [item(0, 5)], "Cancelled", 14, {
      confirmedAt: daysAgo(12), cancelledAt: daysAgo(10),
      notes: "Customer requested cancellation – budget cut",
    }),
    order("ORD-2026-0008", 2, [item(1, 20), item(4, 5), item(8, 5)], "Confirmed", 2, {
      confirmedAt: daysAgo(1),
    }),
  ];

  // Stock movements for fulfilled / cancelled orders plus manual adjustments
  const movement = (p, type, quantity, reference, reason, at) =>
    stamp({ product: products[p]._id, warehouse: DEFAULT_WAREHOUSE, type, quantity, reference, reason, performedBy: warehouse._id }, daysAgo(at));

  stockMovements.push(
    movement(6, "SALE_DEDUCT", -50, orders[4].orderNumber, "Order delivered", 12),
    movement(10, "SALE_DEDUCT", -20, orders[4].orderNumber, "Order delivered", 12),
    movement(9, "SALE_DEDUCT", -100, orders[5].orderNumber, "Order delivered", 18),
    movement(11, "SALE_DEDUCT", -15, orders[5].orderNumber, "Order delivered", 18),
    movement(0, "CANCEL_RESTORE", 5, orders[6].orderNumber, "Order cancelled, stock restored", 10),
    movement(1, "MANUAL_ADD", 50, "", "Restocking from supplier batch B-221", 9),
    movement(6, "MANUAL_ADD", 200, "", "Bulk cable delivery", 7)
  );

  // ─── RECONCILIATION ───
  const reconciliations = [
    stamp(
      {
        warehouse: DEFAULT_WAREHOUSE,
        items: [
          { _id: newId(), product: products[0]._id, systemStock: 120, physicalStock: 118, variance: -2 },
          { _id: newId(), product: products[1]._id, systemStock: 250, physicalStock: 250, variance: 0 },
          { _id: newId(), product: products[6]._id, systemStock: 650, physicalStock: 648, variance: -2 },
        ],
        status: "Approved",
        notes: "Monthly reconciliation. Minor shrinkage on laptops and cables.",
        conductedBy: warehouse._id,
        approvedBy: admin._id,
        approvedAt: daysAgo(5),
      },
      daysAgo(7),
      daysAgo(5)
    ),
    stamp(
      {
        warehouse: DEFAULT_WAREHOUSE,
        items: [
          { _id: newId(), product: products[3]._id, systemStock: 45, physicalStock: 44, variance: -1 },
          { _id: newId(), product: products[4]._id, systemStock: 8, physicalStock: 8, variance: 0 },
          { _id: newId(), product: products[5]._id, systemStock: 60, physicalStock: 62, variance: 2 },
          { _id: newId(), product: products[8]._id, systemStock: 75, physicalStock: 73, variance: -2 },
        ],
        status: "Pending",
        notes: "Weekly spot check – needs manager approval",
        conductedBy: warehouse._id,
      },
      daysAgo(1)
    ),
  ];

  return {
    users,
    products,
    inventory,
    customers,
    orders,
    stockMovements,
    reconciliations,
    sessions: [],
  };
}
