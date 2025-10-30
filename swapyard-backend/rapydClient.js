// src/services/rapydService.js
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const accessKey = process.env.RAPYD_ACCESS_KEY;
const secretKey = process.env.RAPYD_SECRET_KEY;
const baseUrl = "https://sandboxapi.rapyd.net/v1";

/**
 * Generate Rapyd signature
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} endpoint - API endpoint
 * @param {object|null} body - Request body for POST/PUT
 */
function generateSignature(method, endpoint, body = null) {
  const salt = crypto.randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);

  const bodyString =
    method.toLowerCase() === "get"
      ? ""
      : JSON.stringify(body, (k, v) => (typeof v === "number" ? v.toString() : v));

  const toSign =
    method.toLowerCase() +
    "/" +
    endpoint +
    salt +
    timestamp +
    accessKey +
    secretKey +
    bodyString;

  const signature = crypto.createHash("sha256").update(toSign).digest("hex");
  return { salt, timestamp, signature };
}

/**
 * Make Rapyd API request
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint
 * @param {object|null} body - Request body
 */
async function rapydRequest(method, endpoint, body = null) {
  const { salt, timestamp, signature } = generateSignature(method, endpoint, body);

  try {
    const res = await axios({
      method,
      url: `${baseUrl}/${endpoint}`,
      headers: {
        access_key: accessKey,
        salt,
        timestamp,
        signature,
        "Content-Type": "application/json",
      },
      data: method.toLowerCase() === "get" ? undefined : body,
    });
    return res.data;
  } catch (err) {
    console.error("❌ Rapyd request failed:", err.response?.data || err.message);
    return null;
  }
}

module.exports = {
  generateSignature,
  rapydRequest,
};
