const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    desc: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BlogPost", blogPostSchema);
