const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "finance_db";

let db;

async function connectDb() {
  if (db) return db;

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);

  await setupIndexes();
  await seedAdmin();

  console.log(`Connected to MongoDB: ${DB_NAME}`);
  return db;
}

async function getDb() {
  if (!db) await connectDb();
  return db;
}

async function setupIndexes() {
  // unique email for users
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  // common query patterns on transactions
  await db.collection("transactions").createIndex({ date: -1 });
  await db.collection("transactions").createIndex({ type: 1 });
  await db.collection("transactions").createIndex({ category: 1 });
}

async function seedAdmin() {
  const existing = await db.collection("users").findOne({ email: "admin@finance.com" });
  if (!existing) {
    const hash = bcrypt.hashSync("admin123", 10);
    await db.collection("users").insertOne({
      name: "Admin User",
      email: "admin@finance.com",
      password: hash,
      role: "admin",
      status: "active",
      created_at: new Date(),
    });
    console.log("Seeded default admin: admin@finance.com / admin123");
  }
}

module.exports = { getDb, connectDb };
