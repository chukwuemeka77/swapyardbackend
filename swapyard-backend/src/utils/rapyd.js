// src/utils/rapyd.js
import axios from "axios";
import crypto from "crypto";

// Load .env variables
import dotenv from "dotenv";
dotenv.config();

const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;

if (!RAPYD_ACCESS_KEY || !RAPYD_SECRET_KEY) {
  throw new Error(
    "🚨 Rapyd keys are missing! Please add RAPYD_ACCESS_KEY and RAPYD_SECRET_KEY to your .env file"
  );
}

// Generate Rapyd headers
function generateRapydHeaders(method, path, body = "") {
  const salt = crypto.randomBytes(8).toString("hex"); // 16-char random
  const timestamp = Math.floor(Date.now() / 1000); // seconds

  // Ensure body is an empty string for GET requests
  const bodyString = method.toUpperCase() === "GET" ? "" : JSON.stringify(body);

  // Construct string to sign exactly as Rapyd expects
  const toSign = method.toLowerCase() + path + salt + timestamp + RAPYD_ACCESS_KEY + RAPYD_SECRET_KEY + bodyString;

  const signature = crypto.createHash("sha256").update(toSign).digest("hex");

  return {
    "access_key": RAPYD_ACCESS_KEY,
    "salt": salt,
    "timestamp": timestamp,
    "signature": signature,
    "Content-Type": "application/json",
  };
}

// Main request function
export async function rapydRequest(method, path, body = "") {
  try {
    const headers = generateRapydHeaders(method, path, body);
    const url = `https://sandboxapi.rapyd.net${path}`;

    const response = await axios({
      method,
      url,
      headers,
      data: body, // empty string for GET
    });

    return response.data;
  } catch (error) {
    console.error("❌ Rapyd request failed:", error.response?.data || error.message);
    throw error;
  }
}
