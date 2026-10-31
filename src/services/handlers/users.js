import ApiError from "../../data/ApiError.js";
import { ROLES, touch } from "../../data/db.js";
import { assertValid, str, normalizeEmail, isEmail, mustFind, newestFirst, paginate, publicUser } from "./utils.js";

// GET /users
export function list({ db, query }) {
  return paginate(newestFirst(db.users), query, publicUser);
}

// PUT /users/:id
export function update({ db, params, body, user: currentUser }) {
  const user = mustFind(db.users, params.id, "User not found");
  const { name, email, role, isActive } = body;
  const isSelf = user._id === currentUser._id;

  assertValid([
    [name === undefined || str(name), "name", "Name is required"],
    [email === undefined || isEmail(normalizeEmail(email)), "email", "Invalid email format"],
    [role === undefined || ROLES.includes(role), "role", "Invalid role"],
    [isActive === undefined || typeof isActive === "boolean", "isActive", "Invalid status"],
  ]);

  // Guard against an admin locking themselves out
  if (isSelf && isActive === false) throw new ApiError(400, "You cannot deactivate your own account");
  if (isSelf && role !== undefined && role !== user.role) throw new ApiError(400, "You cannot change your own role");

  if (email !== undefined) {
    const normalized = normalizeEmail(email);
    if (db.users.some((u) => u.email === normalized && u._id !== user._id)) {
      throw new ApiError(400, "Email already registered");
    }
    user.email = normalized;
  }
  if (name !== undefined) user.name = str(name);
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) {
    user.isActive = isActive;
    if (!isActive) db.sessions = db.sessions.filter((s) => s.user !== user._id);
  }

  touch(user);
  return publicUser(user);
}

// DELETE /users/:id — soft delete (deactivate) with dependency check
export function remove({ db, params, user: currentUser }) {
  if (params.id === currentUser._id) {
    throw new ApiError(400, "Cannot delete your own account");
  }
  const user = mustFind(db.users, params.id, "User not found");

  const activeOrders = db.orders.filter(
    (o) => o.createdBy === user._id && ["Draft", "Confirmed", "Packed", "Shipped"].includes(o.status)
  ).length;
  if (activeOrders > 0) {
    throw new ApiError(400, `Cannot delete user — they have ${activeOrders} active order(s). Deactivate instead.`);
  }

  user.isActive = false;
  db.sessions = db.sessions.filter((s) => s.user !== user._id);
  touch(user);
  return { message: "User deactivated" };
}
