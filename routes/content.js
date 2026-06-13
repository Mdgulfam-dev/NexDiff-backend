const express = require("express");
const { requireRoles } = require("../middleware/auth");
const BlogPost = require("../models/BlogPost");
const JobPost = require("../models/JobPost");
const Testimonial = require("../models/Testimonial");

const router = express.Router();

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createUniqueSlug = async (title, currentId = null) => {
  const baseSlug = slugify(title);
  let slug = baseSlug || `post-${Date.now()}`;
  let index = 2;

  while (await BlogPost.exists({ slug, _id: { $ne: currentId } })) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  return slug;
};

const createUniqueJobId = async () => {
  const year = new Date().getFullYear();
  const prefix = `JOB-${year}-`;
  const latestJob = await JobPost.findOne({ jobId: new RegExp(`^${prefix}`) })
    .sort({ jobId: -1 })
    .lean();
  const latestNumber = latestJob?.jobId
    ? Number(latestJob.jobId.replace(prefix, ""))
    : 0;
  let nextNumber = Number.isNaN(latestNumber) ? 1 : latestNumber + 1;
  let jobId = `${prefix}${String(nextNumber).padStart(4, "0")}`;

  while (await JobPost.exists({ jobId })) {
    nextNumber += 1;
    jobId = `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }

  return jobId;
};

const requiredFields = (body, fields) =>
  fields.filter((field) => !String(body[field] || "").trim());

router.get("/blogs", async (req, res, next) => {
  try {
    const posts = await BlogPost.find({ published: true }).sort({ createdAt: -1 }).lean();
    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

router.get("/blogs/:slug", async (req, res, next) => {
  try {
    const post = await BlogPost.findOne({
      slug: req.params.slug,
      published: true,
    }).lean();

    if (!post) {
      return res.status(404).json({ message: "Blog post not found." });
    }

    return res.json({ post });
  } catch (error) {
    return next(error);
  }
});

router.get("/jobs", async (req, res, next) => {
  try {
    const jobs = await JobPost.find({ published: true }).sort({ createdAt: -1 }).lean();
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

router.get("/testimonials", async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(9)
      .lean();
    res.json({ testimonials });
  } catch (error) {
    next(error);
  }
});

router.post("/testimonials", async (req, res, next) => {
  try {
    const missing = requiredFields(req.body, ["name", "role", "service", "feedback"]);
    const rating = Number(req.body.rating);

    if (!rating || rating < 1 || rating > 5) {
      missing.push("rating");
    }

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all review fields.", missing });
    }

    const testimonial = await Testimonial.create({
      name: req.body.name,
      role: req.body.role,
      service: req.body.service,
      rating,
      feedback: req.body.feedback,
    });

    return res.status(201).json({
      message: "Review submitted. It will appear after approval.",
      testimonial,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/blogs", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 }).lean();
    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/blogs", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const missing = requiredFields(req.body, ["title", "category", "image", "desc", "content"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all blog fields.", missing });
    }

    const post = await BlogPost.create({
      title: req.body.title,
      slug: await createUniqueSlug(req.body.title),
      category: req.body.category,
      image: req.body.image,
      desc: req.body.desc,
      content: req.body.content,
      published: req.body.published !== false,
    });

    return res.status(201).json({ post });
  } catch (error) {
    return next(error);
  }
});

router.delete("/admin/blogs/:id", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Blog post not found." });
    }

    return res.json({ message: "Blog post deleted." });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/jobs", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const jobsWithoutIds = await JobPost.find({
      $or: [{ jobId: { $exists: false } }, { jobId: "" }, { jobId: null }],
    });

    for (const job of jobsWithoutIds) {
      job.jobId = await createUniqueJobId();
      await job.save();
    }

    const jobs = await JobPost.find().sort({ createdAt: -1 }).lean();
    res.json({ jobs });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/testimonials", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 }).lean();
    res.json({ testimonials });
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/testimonials/:id/status", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid testimonial status." });
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!testimonial) {
      return res.status(404).json({ message: "Review not found." });
    }

    return res.json({ testimonial });
  } catch (error) {
    return next(error);
  }
});

router.delete("/admin/testimonials/:id", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({ message: "Review not found." });
    }

    return res.json({ message: "Review deleted." });
  } catch (error) {
    return next(error);
  }
});

router.post("/admin/jobs", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const missing = requiredFields(req.body, ["title", "type", "location", "focus"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all job fields.", missing });
    }

    const job = await JobPost.create({
      jobId: await createUniqueJobId(),
      title: req.body.title,
      type: req.body.type,
      location: req.body.location,
      focus: req.body.focus,
      published: req.body.published !== false,
    });

    return res.status(201).json({ job });
  } catch (error) {
    return next(error);
  }
});

router.delete("/admin/jobs/:id", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const job = await JobPost.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job post not found." });
    }

    return res.json({ message: "Job post deleted." });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
