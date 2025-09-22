// src/utils/rapyd.js
const crypto = require("crypto");
const axios = require("axios");

// Always trim env vars (Render sometimes injects whitespace)
const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY?.trim();
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY?.trim();
const RAPYD_BASE_URL = "https://sandboxapi.rapyd.net/v1";

// 🔐 Generate Signature (100% aligned with Rapyd docs)
function generateSignature(httpMethod, urlPath, salt, timestamp, body) {
  const bodyString =
    body && Object.keys(body).length ? JSON.stringify(body) : "";

  const toSign =
    httpMethod.toLowerCase() +
    urlPath +
    salt +
    timestamp +
    RAPYD_ACCESS_KEY +
    RAPYD_SECRET_KEY +
    bodyString;

  const signature = crypto
    .createHmac("sha256", RAPYD_SECRET_KEY)
    .update(toSign)
    .digest("hex"); // Rapyd expects HEX, not base64

  // 🐞 Debug Logs
  console.log("🔑 ToSign:", toSign);
  console.log("🖊️ Signature:", signature);

  return signature;
}

// 🌍 Universal Rapyd Request
async function rapydRequest(method, path, body = null) {
  const salt = crypto.randomBytes(12).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(method, path, salt, timestamp, body);

  try {
    const res = await axios({
      method,
      url: `${RAPYD_BASE_URL}${path}`,
      headers: {
        "Content-Type": "application/json",
        access_key: RAPYD_ACCESS_KEY,
        salt,
        timestamp,
        signature,
      },
      data: body || null,
    });

    return res.data;
  } catch (err) {
    console.error("❌ Error in rapydRequest:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

module.exports = { rapydRequest };
