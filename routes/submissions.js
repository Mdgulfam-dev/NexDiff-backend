const express = require("express");
const CareerApplication = require("../models/CareerApplication");
const ContactRequest = require("../models/ContactRequest");
const PricingRequest = require("../models/PricingRequest");

const router = express.Router();

const requireFields = (body, fields) =>
  fields.filter((field) => {
    const value = body[field];
    return Array.isArray(value) ? value.length === 0 : !String(value || "").trim();
  });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[6-9]\d{9}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const isValidPastDate = (value) => {
  if (!datePattern.test(String(value || ""))) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  return date <= today;
};

const validatePricingRequest = (body) => {
  const errors = requireFields(body, [
    "planId",
    "planName",
    "name",
    "phone",
    "email",
    "businessName",
    "niche",
    "accountStartDate",
    "platform",
    "contentType",
    "goal",
    "issue",
    "requirement",
  ]);

  const phone = String(body.phone || "").replace(/\D/g, "");
  if (body.phone && !phonePattern.test(phone)) {
    errors.push("phone");
  }

  if (body.email && !emailPattern.test(String(body.email).trim())) {
    errors.push("email");
  }

  if (body.accountStartDate && !isValidPastDate(body.accountStartDate)) {
    errors.push("accountStartDate");
  }

  if (body.name && String(body.name).trim().length < 2) {
    errors.push("name");
  }

  if (body.businessName && String(body.businessName).trim().length < 2) {
    errors.push("businessName");
  }

  if (body.niche && String(body.niche).trim().length < 2) {
    errors.push("niche");
  }

  if (body.issue && String(body.issue).trim().length < 10) {
    errors.push("issue");
  }

  if (body.requirement && String(body.requirement).trim().length < 10) {
    errors.push("requirement");
  }

  if (Array.isArray(body.platform)) {
    body.platform.forEach((platform) => {
      const link = body.profileLinks?.[platform];
      if (!link || !isValidUrl(link)) {
        errors.push(`profileLinks.${platform}`);
      }
    });
  }

  return [...new Set(errors)];
};

router.post("/contact", async (req, res, next) => {
  try {
    const missing = requireFields(req.body, ["name", "email", "service"]);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all required fields.", missing });
    }

    const submission = await ContactRequest.create({
      data: req.body,
    });

    return res.status(201).json({
      message: "Contact request saved.",
      submission: { ...submission.toObject(), type: "contact" },
    });
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

    const submission = await CareerApplication.create({
      data: req.body,
    });

    return res.status(201).json({
      message: "Career application saved.",
      submission: { ...submission.toObject(), type: "career" },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/pricing-requests", async (req, res, next) => {
  try {
    const missing = validatePricingRequest(req.body);

    if (missing.length) {
      return res.status(400).json({ message: "Please complete all required fields correctly.", missing });
    }

    const submission = await PricingRequest.create({
      data: req.body,
    });

    return res.status(201).json({
      message: "Pricing request saved.",
      submission: { ...submission.toObject(), type: "pricing" },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
