require("dotenv").config(); // Always first

console.log("===== ENV DEBUG =====");
console.log("RAPYD_ACCESS_KEY:", process.env.RAPYD_ACCESS_KEY);
console.log("RAPYD_SECRET_KEY:", process.env.RAPYD_SECRET_KEY);
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("=====================");
