// src/utils/rapyd.js
const crypto = require("crypto");
const axios = require("axios");

const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;
const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_BASE_URL = "https://sandboxapi.rapyd.net/v1";

function generateSignature(httpMethod, urlPath, salt, timestamp, body) {
  // For GET requests, body must be empty string
  const bodyString =
    body && Object.keys(body).length > 0 && httpMethod !== "GET"
      ? JSON.stringify(body)
      : "";

  const toSign =
    httpMethod.toLowerCase() +
    urlPath +
    salt +
    timestamp +
    RAPYD_ACCESS_KEY +
    RAPYD_SECRET_KEY +
    bodyString;

  return crypto
    .createHmac("sha256", RAPYD_SECRET_KEY)
    .update(toSign)
    .digest("base64");
}

async function rapydRequest(method, path, body = null) {
  const salt = crypto.randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = generateSignature(method, path, salt, timestamp, body || {});

  const options = {
    method,
    url: `${RAPYD_BASE_URL}${path}`,
    headers: {
      "Content-Type": "application/json",
      access_key: RAPYD_ACCESS_KEY,
      salt,
      timestamp,
      signature,
    },
  };

  // Only send body if it's POST/PUT
  if (body && (method === "POST" || method === "PUT")) {
    options.data = body;
  }

  const res = await axios(options);
  return res.data;
}

module.exports = { rapydRequest };
