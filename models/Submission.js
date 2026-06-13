const mongoose = require("mongoose");

const submissionStatuses = [
  "new",
  "reviewed",
  "discussion",
  "followup",
  "proposal_sent",
  "payment_pending",
  "payment_received",
  "in_progress",
  "completed",
  "closed",
  "rejected",
];

const submissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["contact", "career", "pricing"],
      required: true,
      index: true,
    },
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

module.exports = mongoose.model("Submission", submissionSchema);
module.exports.submissionStatuses = submissionStatuses;
