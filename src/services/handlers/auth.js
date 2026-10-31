import ApiError from "../../data/ApiError.js";
import { randomHex, verifyPassword, hashPassword } from "../../data/crypto.js";
import { nowIso, touch } from "../../data/db.js";
import { createUserRecord } from "../../data/seed.js";
import { assertValid, str, normalizeEmail, isEmail, publicUser, findById } from "./utils.js";

const SESSION_DAYS = 7;

function createSession(db, userId) {
  const now = Date.now();
  // Drop expired sessions so the list doesn't grow forever
  db.sessions = db.sessions.filter((s) => Date.parse(s.expiresAt) > now);
  const token = randomHex(24);
  db.sessions.push({
    _id: token,
    user: userId,
    createdAt: nowIso(),
    expiresAt: new Date(now + SESSION_DAYS * 86400000).toISOString(),
  });
  return token;
}

// Resolves the logged-in user from a session token (replaces JWT `protect` middleware)
export function authenticate(db, token) {
  if (!token) throw new ApiError(401, "Not authorized, no token");
  const session = findById(db.sessions, token);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    throw new ApiError(401, "Session expired, please log in again");
  }
  const user = findById(db.users, session.user);
  if (!user) throw new ApiError(401, "User not found");
  if (user.isActive === false) throw new ApiError(401, "Account deactivated");
  return user;
}

// POST /auth/register
export async function register({ db, body }) {
  const name = str(body.name);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  assertValid([
    [name, "name", "Name is required"],
    [isEmail(email), "email", "Valid email is required"],
    [password.length >= 6, "password", "Password must be at least 6 characters"],
  ]);

  if (db.users.some((u) => u.email === email)) {
    throw new ApiError(400, "Email already registered");
  }

  // Public registration is always "viewer" — only admins can assign roles
  const user = await createUserRecord({ name, email, password, role: "viewer" });
  db.users.push(user);
  const token = createSession(db, user._id);
  return { user: publicUser(user), token };
}

// POST /auth/login
export async function login({ db, body }) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  assertValid([
    [isEmail(email), "email", "Valid email is required"],
    [password, "password", "Password is required"],
  ]);

  const user = db.users.find((u) => u.email === email);
  if (!user || !(await verifyPassword(password, user.salt, user.passwordHash))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (user.isActive === false) {
    throw new ApiError(401, "Account deactivated. Contact administrator.");
  }

  const token = createSession(db, user._id);
  return { user: publicUser(user), token };
}

// POST /auth/logout
export function logout({ db, body, token }) {
  const sessionToken = body.token || token;
  db.sessions = db.sessions.filter((s) => s._id !== sessionToken);
  return { message: "Logged out" };
}

// GET /auth/me
export function me({ user }) {
  return { user: publicUser(user) };
}

// PUT /auth/change-password
export async function changePassword({ user, body }) {
  const { currentPassword, newPassword } = body;
  assertValid([
    [currentPassword, "currentPassword", "Current password is required"],
    [typeof newPassword === "string" && newPassword.length >= 6, "newPassword", "New password must be at least 6 characters"],
  ]);

  if (!(await verifyPassword(currentPassword, user.salt, user.passwordHash))) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.salt = randomHex(16);
  user.passwordHash = await hashPassword(newPassword, user.salt);
  touch(user);
  return { message: "Password changed successfully" };
}
