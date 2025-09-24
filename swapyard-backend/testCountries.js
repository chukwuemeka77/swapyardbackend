const fetch = require("node-fetch");
const crypto = require("crypto");

const access_key = process.env.RAPYD_ACCESS_KEY;
const secret_key = process.env.RAPYD_SECRET_KEY;

async function getCountries() {
  const path = "/v1/data/countries";
  const method = "get";

  // Use your local timestamp (you can also fetch from Rapyd server for exact match)
  const timestamp = Math.floor(Date.now() / 1000); 
  const salt = crypto.randomBytes(8).toString("hex");

  const toSign = method + path + salt + timestamp + access_key + secret_key;
  const signature = crypto.createHash("sha256").update(toSign).digest("hex");

  const headers = {
    access_key,
    salt,
    timestamp,
    signature,
    "Content-Type": "application/json",
  };

  const res = await fetch("https://sandboxapi.rapyd.net" + path, { method, headers });
  const data = await res.json();
  console.log(data);
}

getCountries();
