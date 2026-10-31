import ApiError from "../../data/ApiError.js";
import { newId } from "../../data/crypto.js";
import { stamp, touch } from "../../data/db.js";
import { assertValid, str, normalizeEmail, isEmail, mustFind, contains, newestFirst, paginate } from "./utils.js";

const FIELDS = ["name", "email", "phone", "address", "city"];

function validate(body, partial) {
  const email = normalizeEmail(body.email);
  assertValid([
    [(partial && body.name === undefined) || str(body.name), "name", "Customer name is required"],
    [!email || isEmail(email), "email", "Valid email required"],
  ]);
}

// GET /customers
export function list({ db, query }) {
  let items = db.customers;
  if (query.search) {
    const s = query.search.toLowerCase();
    items = items.filter((c) => contains(c.name, s) || contains(c.email, s) || contains(c.phone, s));
  }
  return paginate(newestFirst(items), query);
}

// GET /customers/:id
export function get({ db, params }) {
  return mustFind(db.customers, params.id, "Customer not found");
}

// POST /customers
export function create({ db, body, user }) {
  validate(body, false);
  const customer = stamp({
    _id: newId(),
    name: str(body.name),
    email: normalizeEmail(body.email),
    phone: str(body.phone),
    address: str(body.address),
    city: str(body.city),
    createdBy: user._id,
  });
  db.customers.push(customer);
  return customer;
}

// PUT /customers/:id
export function update({ db, params, body }) {
  const customer = mustFind(db.customers, params.id, "Customer not found");
  validate(body, true);
  for (const f of FIELDS) {
    if (body[f] !== undefined) customer[f] = f === "email" ? normalizeEmail(body[f]) : str(body[f]);
  }
  touch(customer);
  return customer;
}

// DELETE /customers/:id — blocked if the customer has orders
export function remove({ db, params }) {
  const customer = mustFind(db.customers, params.id, "Customer not found");
  const orderCount = db.orders.filter((o) => o.customer === customer._id).length;
  if (orderCount > 0) {
    throw new ApiError(400, `Cannot delete customer — they have ${orderCount} associated order(s).`);
  }
  db.customers = db.customers.filter((c) => c._id !== customer._id);
  return { message: "Customer deleted" };
}
