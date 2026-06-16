const crypto = require("crypto");
const express = require("express");
const { requireRoles, signToken } = require("../middleware/auth");
const { AdminUser, adminRoles } = require("../models/AdminUser");
const CareerApplication = require("../models/CareerApplication");
const ContactRequest = require("../models/ContactRequest");
const PricingRequest = require("../models/PricingRequest");
const Submission = require("../models/Submission");
const { submissionStatuses } = require("../models/Submission");
const { createPaginationMeta, getPagination } = require("../utils/pagination");

const router = express.Router();

const isSame = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getEnvUsers = () =>
  [
    {
      role: "admin",
      username: String(process.env.ADMIN_USERNAME || "admin").trim(),
      password: String(process.env.ADMIN_PASSWORD || "admin123").trim(),
    },
    {
      role: "executive",
      username: String(process.env.EXECUTIVE_USERNAME || "").trim(),
      password: String(process.env.EXECUTIVE_PASSWORD || "").trim(),
    },
    {
      role: "manager",
      username: String(process.env.MANAGER_USERNAME || "").trim(),
      password: String(process.env.MANAGER_PASSWORD || "").trim(),
    },
  ].filter((user) => user.username && user.password);

const sanitizeUser = (user) => ({
  _id: user._id,
  username: user.username,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const submissionSources = {
  contact: ContactRequest,
  career: CareerApplication,
  pricing: PricingRequest,
};

const attachType = (type) => (submission) => ({
  ...submission,
  type,
});

const getSubmissionCounts = async () => {
  const [contact, career, pricing, legacyCounts] = await Promise.all([
    ContactRequest.countDocuments(),
    CareerApplication.countDocuments(),
    PricingRequest.countDocuments(),
    Submission.aggregate([{ $group: { _id: "$type", total: { $sum: 1 } } }]),
  ]);

  return legacyCounts.reduce(
    (acc, item) => ({
      ...acc,
      [item._id]: (acc[item._id] || 0) + item.total,
    }),
    { contact, career, pricing },
  );
};

const getTypedSubmissions = async (type, pagination) => {
  const Model = submissionSources[type];
  const projection = "status data createdAt updatedAt";
  const perSourceLimit = pagination.skip + pagination.limit;
  const [items, legacyItems, total, legacyTotal] = await Promise.all([
    Model.find()
      .select(projection)
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .lean(),
    Submission.find({ type })
      .select("type status data createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .lean(),
    Model.countDocuments(),
    Submission.countDocuments({ type }),
  ]);
  const mergedItems = [
    ...items.map(attachType(type)),
    ...legacyItems,
  ]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(pagination.skip, pagination.skip + pagination.limit);

  return {
    submissions: mergedItems,
    total: total + legacyTotal,
  };
};

const getAllSubmissions = async (pagination) => {
  const projection = "status data createdAt updatedAt";
  const perSourceLimit = pagination.skip + pagination.limit;
  const [contacts, careers, pricing, legacyItems, counts] = await Promise.all([
    ContactRequest.find()
      .select(projection)
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .lean(),
    CareerApplication.find()
      .select(projection)
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .lean(),
    PricingRequest.find()
      .select(projection)
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .lean(),
    Submission.find()
      .select("type status data createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(perSourceLimit)
      .lean(),
    getSubmissionCounts(),
  ]);

  const mergedItems = [
    ...contacts.map(attachType("contact")),
    ...careers.map(attachType("career")),
    ...pricing.map(attachType("pricing")),
    ...legacyItems,
  ]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(pagination.skip, pagination.skip + pagination.limit);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return { submissions: mergedItems, total, counts };
};

router.post("/login", async (req, res, next) => {
  const { username, password } = req.body;
  const submittedUsername = String(username || "").trim();
  const submittedPassword = String(password || "").trim();

  try {
    const dbUser = await AdminUser.findOne({
      usernameKey: submittedUsername.toLowerCase(),
    });

    if (dbUser && dbUser.active && AdminUser.verifyPassword(submittedPassword, dbUser)) {
      const token = signToken({
        admin: true,
        role: dbUser.role,
        username: dbUser.username,
        userId: dbUser._id.toString(),
        exp: Date.now() + 1000 * 60 * 60 * 8,
      });

      return res.json({
        token,
        user: { username: dbUser.username, role: dbUser.role, userId: dbUser._id },
      });
    }

    if (dbUser) {
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const envUser = getEnvUsers().find(
      (item) =>
        isSame(submittedUsername.toLowerCase(), item.username.toLowerCase()) &&
        isSame(submittedPassword, item.password),
    );

    if (!envUser) {
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const token = signToken({
      admin: true,
      role: envUser.role,
      username: envUser.username,
      source: "env",
      exp: Date.now() + 1000 * 60 * 60 * 8,
    });

    return res.json({ token, user: { username: envUser.username, role: envUser.role } });
  } catch (error) {
    return next(error);
  }
});

router.get("/users", requireRoles(["admin"]), async (req, res, next) => {
  try {
    const users = await AdminUser.find().sort({ role: 1, username: 1 }).lean();

    return res.json({ users: users.map(sanitizeUser), roles: adminRoles });
  } catch (error) {
    return next(error);
  }
});

router.post("/users", requireRoles(["admin"]), async (req, res, next) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = String(req.body.role || "").trim();
    const active = req.body.active !== false;

    if (!username || !password || !role) {
      return res.status(400).json({ message: "Username, password, and role are required." });
    }

    if (!adminRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid user role." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await AdminUser.findOne({ usernameKey: username.toLowerCase() });

    if (existing) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const passwordParts = AdminUser.buildPassword(password);
    const user = await AdminUser.create({
      username,
      usernameKey: username.toLowerCase(),
      role,
      active,
      passwordHash: passwordParts.hash,
      passwordSalt: passwordParts.salt,
    });

    return res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:id", requireRoles(["admin"]), async (req, res, next) => {
  try {
    const updates = {};
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = String(req.body.role || "").trim();

    if (username) {
      const existing = await AdminUser.findOne({
        usernameKey: username.toLowerCase(),
        _id: { $ne: req.params.id },
      });

      if (existing) {
        return res.status(409).json({ message: "Username already exists." });
      }

      updates.username = username;
      updates.usernameKey = username.toLowerCase();
    }

    if (role) {
      if (!adminRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid user role." });
      }

      updates.role = role;
    }

    if (typeof req.body.active === "boolean") {
      updates.active = req.body.active;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }

      const passwordParts = AdminUser.buildPassword(password);
      updates.passwordHash = passwordParts.hash;
      updates.passwordSalt = passwordParts.salt;
    }

    const user = await AdminUser.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.delete("/users/:id", requireRoles(["admin"]), async (req, res, next) => {
  try {
    const user = await AdminUser.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ message: "User deleted." });
  } catch (error) {
    return next(error);
  }
});

router.get("/submissions", requireRoles(["admin", "manager"]), async (req, res, next) => {
  try {
    const requestedType = String(req.query.type || "all");
    const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    if (requestedType !== "all" && !submissionSources[requestedType]) {
      return res.status(400).json({ message: "Invalid submission type." });
    }

    const result =
      requestedType === "all"
        ? await getAllSubmissions(pagination)
        : await getTypedSubmissions(requestedType, pagination);
    const counts = result.counts || (await getSubmissionCounts());

    return res.json({
      submissions: result.submissions,
      counts,
      pagination: createPaginationMeta({
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/submissions/:id/status", requireRoles(["admin", "manager"]), async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!submissionStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    let updatedType = "";
    let submission = null;

    for (const [type, Model] of Object.entries(submissionSources)) {
      submission = await Model.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();

      if (submission) {
        updatedType = type;
        break;
      }
    }

    if (!submission) {
      submission = await Submission.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true },
      ).lean();
      updatedType = submission?.type || "";
    }

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    return res.json({ submission: { ...submission, type: updatedType } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
