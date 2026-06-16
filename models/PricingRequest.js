const mongoose = require("mongoose");
const { submissionStatuses } = require("./Submission");

const pricingRequestSchema = new mongoose.Schema(
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

pricingRequestSchema.index({ createdAt: -1 });
pricingRequestSchema.index({ status: 1, createdAt: -1 });
pricingRequestSchema.index({ "data.planId": 1, createdAt: -1 });
pricingRequestSchema.index({ "data.phone": 1 });
pricingRequestSchema.index({ "data.email": 1 });

module.exports = mongoose.model("PricingRequest", pricingRequestSchema);
