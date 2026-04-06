const express = require("express");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db/database");
const { authenticate, requireRole } = require("../middleware/authMiddleware");
const router = express.Router();

const VALID_ROLES = ["viewer", "analyst", "admin"];
const VALID_STATUSES = ["active", "inactive"];

// GET /api/users (admin only)
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const db = await getDb();
  const users = await db
    .collection("users")
    .find({}, { projection: { password: 0 } })
    .sort({ created_at: -1 })
    .toArray();

  return res.json({ users });
});

// POST /api/users (admin only)
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  const { name, email, password, role = "viewer" } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "name, email, password are required" });
  }

  if (!VALID_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }

  try {
    const db = await getDb();
    const hash = bcrypt.hashSync(password, 10);

    const result = await db.collection("users").insertOne({
      name,
      email,
      password: hash,
      role,
      status: "active",
      created_at: new Date(),
    });

    return res
      .status(201)
      .json({ message: "User created", userId: result.insertedId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already in use" });
    }
    throw err;
  }
});

// PATCH /api/users/:id (admin only)
router.patch("/:id", authenticate, requireRole("admin"), async (req, res) => {
  const { role, status } = req.body;

  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const userId = new ObjectId(req.params.id);

  if (req.params.id === req.user.id && status === "inactive") {
    return res
      .status(400)
      .json({ error: "You cannot deactivate your own account" });
  }

  if (role && !VALID_ROLES.includes(role)) {
    return res
      .status(400)
      .json({ error: `Invalid role. Must be: ${VALID_ROLES.join(", ")}` });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ error: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` });
  }

  const updates = {};
  if (role) updates.role = role;
  if (status) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const db = await getDb();
  const result = await db
    .collection("users")
    .updateOne({ _id: userId }, { $set: updates });

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ message: "User updated" });
});

// DELETE /api/users/:id (admin only)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const db = await getDb();
  const result = await db
    .collection("users")
    .deleteOne({ _id: new ObjectId(req.params.id) });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ message: "User deleted" });
});

module.exports = router;
