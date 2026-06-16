const express = require("express");
const { requireRoles } = require("../middleware/auth");
const BlogPost = require("../models/BlogPost");
const JobPost = require("../models/JobPost");
const Testimonial = require("../models/Testimonial");
const { createPaginationMeta, getPagination } = require("../utils/pagination");

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

const blogListProjection = "title slug category image desc published createdAt updatedAt";
const adminBlogProjection = "title slug category image desc content published createdAt updatedAt";
const jobListProjection = "jobId title type location focus published createdAt updatedAt";

router.get("/blogs", async (req, res, next) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 12, maxLimit: 50 });
    const [posts, total] = await Promise.all([
      BlogPost.find({ published: true })
        .select(blogListProjection)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      BlogPost.countDocuments({ published: true }),
    ]);

    res.json({
      posts,
      pagination: createPaginationMeta({ ...pagination, total }),
    });
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
    const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const [jobs, total] = await Promise.all([
      JobPost.find({ published: true })
        .select(jobListProjection)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      JobPost.countDocuments({ published: true }),
    ]);

    res.json({
      jobs,
      pagination: createPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/jobs/:jobId", async (req, res, next) => {
  try {
    const jobId = decodeURIComponent(req.params.jobId || "");
    const jobConditions = [{ jobId }];

    if (/^[a-f\d]{24}$/i.test(jobId)) {
      jobConditions.push({ _id: jobId });
    }

    const job = await JobPost.findOne({
      published: true,
      $or: jobConditions,
    }).lean();

    if (!job) {
      return res.status(404).json({ message: "Job opening not found." });
    }

    const relatedJobs = await JobPost.find({
      published: true,
      _id: { $ne: job._id },
    })
      .select(jobListProjection)
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    return res.json({ job, relatedJobs });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/blogs/:id", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const post = await BlogPost.findById(req.params.id).lean();

    if (!post) {
      return res.status(404).json({ message: "Blog post not found." });
    }

    return res.json({ post });
  } catch (error) {
    return next(error);
  }
});

router.get("/testimonials", async (req, res, next) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 9, maxLimit: 30 });
    const [testimonials, total] = await Promise.all([
      Testimonial.find({ status: "approved" })
        .select("name role service rating feedback status createdAt")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Testimonial.countDocuments({ status: "approved" }),
    ]);

    res.json({
      testimonials,
      pagination: createPaginationMeta({ ...pagination, total }),
    });
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
    const pagination = getPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const [posts, total] = await Promise.all([
      BlogPost.find()
        .select(adminBlogProjection)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      BlogPost.countDocuments(),
    ]);

    res.json({
      posts,
      pagination: createPaginationMeta({ ...pagination, total }),
    });
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

router.patch("/admin/blogs/:id", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const missing = requiredFields(req.body, ["title", "category", "image", "desc", "content"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all blog fields.", missing });
    }

    const post = await BlogPost.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        slug: await createUniqueSlug(req.body.title, req.params.id),
        category: req.body.category,
        image: req.body.image,
        desc: req.body.desc,
        content: req.body.content,
        published: req.body.published !== false,
      },
      { new: true },
    );

    if (!post) {
      return res.status(404).json({ message: "Blog post not found." });
    }

    return res.json({ post });
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

    const pagination = getPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const [jobs, total] = await Promise.all([
      JobPost.find()
        .select(jobListProjection)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      JobPost.countDocuments(),
    ]);

    res.json({
      jobs,
      pagination: createPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/testimonials", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const [testimonials, total] = await Promise.all([
      Testimonial.find()
        .select("name role service rating feedback status createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Testimonial.countDocuments(),
    ]);

    res.json({
      testimonials,
      pagination: createPaginationMeta({ ...pagination, total }),
    });
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

router.patch("/admin/jobs/:id", requireRoles(["admin", "executive"]), async (req, res, next) => {
  try {
    const missing = requiredFields(req.body, ["title", "type", "location", "focus"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all job fields.", missing });
    }

    const job = await JobPost.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title,
        type: req.body.type,
        location: req.body.location,
        focus: req.body.focus,
        published: req.body.published !== false,
      },
      { new: true },
    );

    if (!job) {
      return res.status(404).json({ message: "Job post not found." });
    }

    return res.json({ job });
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
