const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const helmet = require("helmet");

const app = express();

// Middleware
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net"], 
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],  
    },
  })
);

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./src/routes/auth");
app.use("/api/auth", authRoutes);

// Example: protected route
const authMiddleware = require("./src/middleware/auth");
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// DB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
