const crypto = require("crypto");
const express = require("express");
const { requireRoles, signToken } = require("../middleware/auth");
const Submission = require("../models/Submission");
const { submissionStatuses } = require("../models/Submission");

const router = express.Router();

const isSame = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const submittedUsername = String(username || "").trim();
  const submittedPassword = String(password || "").trim();
  const users = [
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

  const user = users.find(
    (item) =>
      isSame(submittedUsername.toLowerCase(), item.username.toLowerCase()) &&
      isSame(submittedPassword, item.password),
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid admin credentials." });
  }

  const token = signToken({
    admin: true,
    role: user.role,
    username: user.username,
    exp: Date.now() + 1000 * 60 * 60 * 8,
  });

  return res.json({ token, user: { username: user.username, role: user.role } });
});

router.get("/submissions", requireRoles(["admin", "manager"]), async (req, res, next) => {
  try {
    const filter = req.query.type ? { type: req.query.type } : {};
    const submissions = await Submission.find(filter).sort({ createdAt: -1 }).lean();
    const counts = await Submission.aggregate([
      { $group: { _id: "$type", total: { $sum: 1 } } },
    ]);

    return res.json({
      submissions,
      counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.total }), {}),
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

    const submission = await Submission.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    return res.json({ submission });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
