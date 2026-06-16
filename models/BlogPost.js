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

blogPostSchema.index({ published: 1, createdAt: -1 });
blogPostSchema.index({ slug: 1, published: 1 });
blogPostSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("BlogPost", blogPostSchema);
