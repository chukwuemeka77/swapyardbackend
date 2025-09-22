function generateSignature(httpMethod, urlPath, salt, timestamp, body) {
  const bodyString = body ? JSON.stringify(body) : "";
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
    .digest("base64");

  console.log("🔑 ToSign:", toSign);
  console.log("🖊️ Signature:", signature);

  return signature;
}

