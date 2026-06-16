const mongoose = require("mongoose");
const { submissionStatuses } = require("./Submission");

const contactRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: submissionStatuses,
      default: "new",
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

contactRequestSchema.index({ createdAt: -1 });
contactRequestSchema.index({ status: 1, createdAt: -1 });
contactRequestSchema.index({ "data.email": 1 });
contactRequestSchema.index({ "data.phone": 1 });

module.exports = mongoose.model("ContactRequest", contactRequestSchema);
