const mongoose = require("mongoose");

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
      enum: ["new", "reviewed", "closed"],
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
