const mongoose = require("mongoose");
const { submissionStatuses } = require("./Submission");

const careerApplicationSchema = new mongoose.Schema(
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

careerApplicationSchema.index({ createdAt: -1 });
careerApplicationSchema.index({ status: 1, createdAt: -1 });
careerApplicationSchema.index({ "data.jobId": 1, createdAt: -1 });
careerApplicationSchema.index({ "data.email": 1 });
careerApplicationSchema.index({ "data.phone": 1 });

module.exports = mongoose.model("CareerApplication", careerApplicationSchema);
