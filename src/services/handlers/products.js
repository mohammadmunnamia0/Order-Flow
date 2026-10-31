import ApiError from "../../data/ApiError.js";
import { newId } from "../../data/crypto.js";
import { stamp, touch } from "../../data/db.js";
import { DEFAULT_WAREHOUSE } from "../../data/seed.js";
import {
  assertValid, str, isBlank, isNonNegative, isInt, mustFind, contains, newestFirst, paginate, logMovement, findInventory,
} from "./utils.js";

// GET /products
export function list({ db, query }) {
  let items = db.products;
  if (query.archived !== "true") items = items.filter((p) => !p.isArchived);
  if (query.category) items = items.filter((p) => p.category === query.category);
  if (query.search) {
    const s = query.search.toLowerCase();
    items = items.filter((p) => contains(p.name, s) || contains(p.sku, s));
  }
  return paginate(newestFirst(items), query);
}

// GET /products/:id
export function get({ db, params }) {
  return mustFind(db.products, params.id, "Product not found");
}

// POST /products
export function create({ db, body, user }) {
  const name = str(body.name);
  const sku = str(body.sku).toUpperCase();
  const category = str(body.category);
  assertValid([
    [name, "name", "Product name is required"],
    [sku, "sku", "SKU is required"],
    [category, "category", "Category is required"],
    [isNonNegative(body.unitPrice), "unitPrice", "Unit price must be non-negative"],
    [isNonNegative(body.reorderLevel), "reorderLevel", "Reorder level must be non-negative"],
    [isBlank(body.initialStock) || isInt(body.initialStock, 0), "initialStock", "Initial stock must be a non-negative whole number"],
  ]);

  if (db.products.some((p) => p.sku === sku)) {
    throw new ApiError(400, "SKU already exists");
  }

  const product = stamp({
    _id: newId(),
    name,
    sku,
    category,
    unitPrice: Number(body.unitPrice),
    reorderLevel: Number(body.reorderLevel),
    description: str(body.description),
    isArchived: false,
    createdBy: user._id,
  });
  db.products.push(product);

  // Create inventory record
  const warehouse = str(body.warehouse) || DEFAULT_WAREHOUSE;
  const stock = isBlank(body.initialStock) ? 0 : Number(body.initialStock);
  if (!findInventory(db, product._id, warehouse)) {
    db.inventory.push(stamp({ _id: newId(), product: product._id, warehouse, totalStock: stock, reservedStock: 0 }));
  }

  if (stock > 0) {
    logMovement(db, {
      product: product._id,
      warehouse,
      type: "INITIAL",
      quantity: stock,
      reason: "Initial stock on product creation",
      performedBy: user._id,
    });
  }

  return product;
}

// PUT /products/:id
export function update({ db, params, body }) {
  const product = mustFind(db.products, params.id, "Product not found");
  const { name, category, unitPrice, reorderLevel, description } = body;
  assertValid([
    [name === undefined || str(name), "name", "Product name is required"],
    [category === undefined || str(category), "category", "Category is required"],
    [unitPrice === undefined || isNonNegative(unitPrice), "unitPrice", "Unit price must be non-negative"],
    [reorderLevel === undefined || isNonNegative(reorderLevel), "reorderLevel", "Reorder level must be non-negative"],
  ]);

  if (name !== undefined) product.name = str(name);
  if (category !== undefined) product.category = str(category);
  if (unitPrice !== undefined) product.unitPrice = Number(unitPrice);
  if (reorderLevel !== undefined) product.reorderLevel = Number(reorderLevel);
  if (description !== undefined) product.description = str(description);
  touch(product);
  return product;
}

// PUT /products/:id/archive
export function archive({ db, params }) {
  const product = mustFind(db.products, params.id, "Product not found");
  product.isArchived = true;
  touch(product);
  return { message: "Product archived", product };
}

// GET /products/categories/list
export function categories({ db }) {
  return [...new Set(db.products.filter((p) => !p.isArchived).map((p) => p.category))].sort();
}
