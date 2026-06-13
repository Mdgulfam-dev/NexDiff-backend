const mongoose = require("mongoose");

const jobPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    focus: { type: String, required: true, trim: true },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("JobPost", jobPostSchema);
