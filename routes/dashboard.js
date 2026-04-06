const express = require("express");
const { getDb } = require("../db/database");
const { authenticate, requireRole } = require("../middleware/authMiddleware");
const router = express.Router();

// GET /api/dashboard/summary
router.get("/summary", authenticate, async (req, res) => {
  const db = await getDb();

  const result = await db
    .collection("transactions")
    .aggregate([
      { $match: { is_deleted: false } },
      {
        $group: {
          _id: null,
          total_income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          total_expenses: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          total_transactions: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const data = result[0] || {
    total_income: 0,
    total_expenses: 0,
    total_transactions: 0,
  };

  return res.json({
    summary: {
      total_income: data.total_income,
      total_expenses: data.total_expenses,
      net_balance: data.total_income - data.total_expenses,
      total_transactions: data.total_transactions,
    },
  });
});

// GET /api/dashboard/by-category (analyst, admin)
router.get(
  "/by-category",
  authenticate,
  requireRole("analyst", "admin"),
  async (req, res) => {
    const db = await getDb();

    const categories = await db
      .collection("transactions")
      .aggregate([
        { $match: { is_deleted: false } },
        {
          $group: {
            _id: { category: "$category", type: "$type" },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id.category",
            type: "$_id.type",
            total: 1,
            count: 1,
          },
        },
        { $sort: { total: -1 } },
      ])
      .toArray();

    return res.json({ categories });
  },
);

// GET /api/dashboard/monthly-trends?months=6 (analyst, admin)
router.get(
  "/monthly-trends",
  authenticate,
  requireRole("analyst", "admin"),
  async (req, res) => {
    const months = parseInt(req.query.months) || 6;

    // calculate the start date cutoff
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

    const db = await getDb();

    const trends = await db
      .collection("transactions")
      .aggregate([
        { $match: { is_deleted: false, date: { $gte: cutoffStr } } },
        {
          $group: {
            _id: { month: { $substr: ["$date", 0, 7] } }, // group by YYYY-MM
            income: {
              $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
            },
            expenses: {
              $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
            },
          },
        },
        {
          $project: { _id: 0, month: "$_id.month", income: 1, expenses: 1 },
        },
        { $sort: { month: 1 } },
      ])
      .toArray();

    return res.json({ trends });
  },
);

// GET /api/dashboard/recent?limit=10
router.get("/recent", authenticate, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  const db = await getDb();
  const recent = await db
    .collection("transactions")
    .find({ is_deleted: false })
    .sort({ date: -1, created_at: -1 })
    .limit(limit)
    .project({ is_deleted: 0 })
    .toArray();

  return res.json({ recent });
});

module.exports = router;
