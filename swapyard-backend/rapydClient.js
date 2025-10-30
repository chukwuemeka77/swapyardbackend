// rapydClient.js (CommonJS)
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const accessKey = process.env.RAPYD_ACCESS_KEY;
const secretKey = process.env.RAPYD_SECRET_KEY;
const baseUrl = 'https://sandboxapi.rapyd.net/v1';

/**
 * Generate Rapyd signature for request
 * @param {string} method GET/POST/etc
 * @param {string} endpoint API endpoint (without baseUrl)
 * @param {object|null} body Request body
 */
function generateSignature(method, endpoint, body = null) {
  const salt = crypto.randomBytes(8).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);

  // GET must be empty string, POST must be compact JSON with numbers as strings
  const bodyString =
    method.toLowerCase() === 'get'
      ? ''
      : JSON.stringify(body, (k, v) => (typeof v === 'number' ? v.toString() : v));

  const toSign =
    method.toLowerCase() + '/' + endpoint + salt + timestamp + accessKey + secretKey + bodyString;

  const signature = crypto.createHash('sha256').update(toSign).digest('hex');
  return { salt, timestamp, signature };
}

/**
 * Make a signed request to Rapyd
 * @param {string} method
 * @param {string} endpoint
 * @param {object|null} body
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
        'Content-Type': 'application/json',
      },
      data: method.toLowerCase() === 'get' ? undefined : body,
    });
    return res.data;
  } catch (err) {
    console.error('❌ Rapyd request failed:', err.response?.data || err.message);
    return null;
  }
}

module.exports = { rapydRequest };
