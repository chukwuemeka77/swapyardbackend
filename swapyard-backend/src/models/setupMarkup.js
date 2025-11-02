const mongoose = require("mongoose");
const MarkupSetting = require("./models/markupSetting");

async function setupMarkup() {
  await mongoose.connect(process.env.MONGO_URI);

  const settings = [
    { type: "deposit", percentage: 1.5 },   // 1.5% markup on deposits
    { type: "exchange", percentage: 2 },    // 2% on currency exchanges
    { type: "payment", percentage: 0.5 },   // 0.5% on payments
  ];

  for (const s of settings) {
    await MarkupSetting.findOneAndUpdate(
      { type: s.type },
      { $set: { percentage: s.percentage } },
      { upsert: true }
    );
  }

  console.log("✅ Markup settings configured");
  process.exit(0);
}

setupMarkup();
