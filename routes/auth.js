const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDb } = require("../db/database");
const { JWT_SECRET, authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

// POST /api/auth/register — here i've implemented self-registration, always gets viewer role
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "name, email, and password are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  try {
    const db = await getDb();
    const hash = bcrypt.hashSync(password, 10);

    await db.collection("users").insertOne({
      name,
      email,
      password: hash,
      role: "viewer",
      status: "active",
      created_at: new Date(),
    });

    return res.status(201).json({ message: "User created" });
  } catch (err) {
    // MongoDB throws code 11000 on duplicate key
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    throw err;
  }
});

// POST /api/auth/login- here we check if the user exists and if the password is correct, then we generate a JWT token that includes the user's id, name, email, and role. We also check if the user's account is active before allowing them to log in.
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ email });

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.status === "inactive") {
    return res.status(403).json({ error: "Account is deactivated" });
  }

  const token = jwt.sign(
    {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );

  return res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// GET /api/auth/me - this endpoint is protected by the authenticate middleware, which verifies the JWT token and attaches the user info to the request object. If the token is valid, we return the user's information in the response.
router.get("/me", authenticate, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
