// utils/rapyd.js
const crypto = require("crypto");
const axios = require("axios");

const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;
const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_BASE_URL = "https://sandboxapi.rapyd.net/v1";

function generateSignature(httpMethod, urlPath, salt, timestamp, body) {
  const bodyString = body ? JSON.stringify(body) : "";
  const toSign = httpMethod + urlPath + salt + timestamp + RAPYD_ACCESS_KEY + RAPYD_SECRET_KEY + bodyString;
  return crypto.createHmac("sha256", RAPYD_SECRET_KEY).update(toSign).digest("hex");
}

async function rapydRequest(method, path, body = null) {
  const salt = crypto.randomBytes(8).toString("hex");
  const timestamp = (Math.floor(Date.now() / 1000) - 10).toString();
  const signature = generateSignature(method, path, salt, timestamp, body);

  const res = await axios({
    method,
    url: `${RAPYD_BASE_URL}${path}`,
    headers: {
      "Content-Type": "application/json",
      "access_key": RAPYD_ACCESS_KEY,
      "salt": salt,
      "timestamp": timestamp,
      "signature": signature,
    },
    data: body,
  });

  return res.data;
}

module.exports = { rapydRequest };

