// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/user");

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user; // full Mongo user, includes rapydId
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
