import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import countryRoutes from "./routes/countryRoutes.js";

dotenv.config();

const app = express();
app.use(express.json());

// Security middleware
app.use(cors({ origin: "http://localhost:5500" })); // change if frontend URL differs
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // allow Tailwind inline styles
      imgSrc: ["'self'", "data:"],
    },
  })
);

// Routes
app.use("/auth", authRoutes);
app.use("/countries", countryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
