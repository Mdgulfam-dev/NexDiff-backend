const express = require("express");
const Submission = require("../models/Submission");

const router = express.Router();

const requireFields = (body, fields) =>
  fields.filter((field) => {
    const value = body[field];
    return Array.isArray(value) ? value.length === 0 : !String(value || "").trim();
  });

router.post("/contact", async (req, res, next) => {
  try {
    const missing = requireFields(req.body, ["name", "email", "service"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all required fields.", missing });
    }

    const submission = await Submission.create({
      type: "contact",
      data: req.body,
    });

    return res.status(201).json({ message: "Contact request saved.", submission });
  } catch (error) {
    return next(error);
  }
});

router.post("/careers", async (req, res, next) => {
  try {
    const missing = requireFields(req.body, ["name", "phone", "jobId", "role", "experience"]);

    if (!req.body.resume?.dataUrl || !req.body.resume?.name) {
      missing.push("resume");
    }

    if (req.body.acceptedTerms !== true) {
      missing.push("acceptedTerms");
    }

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all required fields.", missing });
    }

    const submission = await Submission.create({
      type: "career",
      data: req.body,
    });

    return res.status(201).json({ message: "Career application saved.", submission });
  } catch (error) {
    return next(error);
  }
});

router.post("/pricing-requests", async (req, res, next) => {
  try {
    const missing = requireFields(req.body, ["planId", "planName", "name", "phone", "businessName"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all required fields.", missing });
    }

    const submission = await Submission.create({
      type: "pricing",
      data: req.body,
    });

    return res.status(201).json({ message: "Pricing request saved.", submission });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
