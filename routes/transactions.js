const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../db/database");
const { authenticate, requireRole } = require("../middleware/authMiddleware");
const router = express.Router();

const VALID_TYPES = ["income", "expense"];

// GET /api/transactions — filters: type, category, from, to, page, limit
router.get("/", authenticate, async (req, res) => {
  const { type, category, from, to, page = 1, limit = 20 } = req.query;

  const filter = { is_deleted: false };

  if (type) {
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "type must be income or expense" });
    }
    filter.type = type;
  }

  if (category) {
    // case-insensitive match
    filter.category = { $regex: new RegExp(`^${category}$`, "i") };
  }

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  const db = await getDb();
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [transactions, total] = await Promise.all([
    db
      .collection("transactions")
      .find(filter)
      .sort({ date: -1, created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray(),
    db.collection("transactions").countDocuments(filter),
  ]);

  return res.json({
    transactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// GET /api/transactions/:id
router.get("/:id", authenticate, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const db = await getDb();
  const tx = await db.collection("transactions").findOne({
    _id: new ObjectId(req.params.id),
    is_deleted: false,
  });

  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  return res.json({ transaction: tx });
});

// POST /api/transactions (analyst, admin)
router.post(
  "/",
  authenticate,
  requireRole("analyst", "admin"),
  async (req, res) => {
    const { amount, type, category, date, notes } = req.body;

    if (!amount || !type || !category || !date) {
      return res
        .status(400)
        .json({ error: "amount, type, category, and date are required" });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "type must be income or expense" });
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res
        .status(400)
        .json({ error: "amount must be a positive number" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    const db = await getDb();
    const result = await db.collection("transactions").insertOne({
      amount: parseFloat(amount),
      type,
      category,
      date,
      notes: notes || null,
      created_by: req.user.id,
      created_by_name: req.user.name,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res
      .status(201)
      .json({
        message: "Transaction created",
        transactionId: result.insertedId,
      });
  },
);

// PUT /api/transactions/:id (admin only)
router.put("/:id", authenticate, requireRole("admin"), async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const { amount, type, category, date, notes } = req.body;

  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "type must be income or expense" });
  }

  if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const updates = { updated_at: new Date() };
  if (amount !== undefined) updates.amount = parseFloat(amount);
  if (type !== undefined) updates.type = type;
  if (category !== undefined) updates.category = category;
  if (date !== undefined) updates.date = date;
  if (notes !== undefined) updates.notes = notes;

  const db = await getDb();
  const result = await db
    .collection("transactions")
    .updateOne(
      { _id: new ObjectId(req.params.id), is_deleted: false },
      { $set: updates },
    );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.json({ message: "Transaction updated" });
});

// DELETE /api/transactions/:id — soft delete (admin only)
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const db = await getDb();
  const result = await db
    .collection("transactions")
    .updateOne(
      { _id: new ObjectId(req.params.id), is_deleted: false },
      { $set: { is_deleted: true, updated_at: new Date() } },
    );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.json({ message: "Transaction deleted" });
});

module.exports = router;
