const mongoose = require("mongoose");

const markupSettingSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["deposit", "exchange", "payment"],
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
  },
});

module.exports = mongoose.model("MarkupSetting", markupSettingSchema);
