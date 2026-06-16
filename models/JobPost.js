const mongoose = require("mongoose");

const jobPostSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    focus: { type: String, required: true, trim: true },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

jobPostSchema.index({ published: 1, createdAt: -1 });
jobPostSchema.index({ jobId: 1, published: 1 });
jobPostSchema.index({ type: 1, location: 1, createdAt: -1 });

module.exports = mongoose.model("JobPost", jobPostSchema);
