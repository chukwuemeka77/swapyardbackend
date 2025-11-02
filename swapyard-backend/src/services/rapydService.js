const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;
const RAPYD_BASE_URL = process.env.RAPYD_BASE_URL;

function getSignature(httpMethod, urlPath, body = "") {
  const salt = crypto.randomBytes(4).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = body ? JSON.stringify(body) : "";
  const toSign = `${httpMethod}${urlPath}${salt}${timestamp}${RAPYD_ACCESS_KEY}${RAPYD_SECRET_KEY}${bodyString}`;
  const signature = crypto.createHash("sha256").update(toSign).digest("base64");
  return { signature, salt, timestamp };
}

async function rapydRequest(method, path, data = null) {
  const url = `${RAPYD_BASE_URL}${path}`;
  const { signature, salt, timestamp } = getSignature(method, path, data);

  const headers = {
    "Content-Type": "application/json",
    "access_key": RAPYD_ACCESS_KEY,
    "salt": salt,
    "timestamp": timestamp,
    "signature": signature,
  };

  try {
    const res = await axios({ method, url, headers, data });
    return res.data;
  } catch (err) {
    console.error("Rapyd API error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { rapydRequest };
