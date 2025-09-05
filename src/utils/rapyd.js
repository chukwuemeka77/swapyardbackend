const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const RAPYD_BASE = 'https://sandboxapi.rapyd.net'; // change to production when ready

const accessKey = process.env.RAPYD_ACCESS_KEY;
const secretKey = process.env.RAPYD_SECRET_KEY;

function signRapyd(method, path, body = {}) {
  const httpMethod = method.toUpperCase();
  const salt = uuidv4();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = Object.keys(body).length ? JSON.stringify(body) : '';
  const toSign = `${httpMethod}${path}${salt}${timestamp}${accessKey}${secretKey}${bodyString}`;
  const hmac = crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
  const signature = Buffer.from(hmac).toString('base64');
  return { salt, timestamp, signature };
}

async function rapydRequest(method, path, body = {}) {
  const { salt, timestamp, signature } = signRapyd(method, path, body);
  const headers = {
    'Content-Type': 'application/json',
    'access_key': accessKey,
    'salt': salt,
    'timestamp': timestamp,
    'signature': signature
  };
  const url = `${RAPYD_BASE}${path}`;
  const config = { method, url, headers, data: Object.keys(body).length ? body : undefined };
  const res = await axios(config);
  return res.data;
}

module.exports = { rapydRequest };
