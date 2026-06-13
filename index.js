const fs = require("fs");
const path = require("path");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const submissionRoutes = require("./routes/submissions");
const adminRoutes = require("./routes/admin");
const contentRoutes = require("./routes/content");

const loadEnv = () => {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnv();

const normalizeMongoUri = (uri) => {
  const trimmedUri = String(uri || "").trim();
  const schemeMatch = trimmedUri.match(/^mongodb(\+srv)?:\/\//);

  if (!schemeMatch) {
    return trimmedUri;
  }

  const schemeEndIndex = trimmedUri.indexOf("://") + 3;
  const slashAfterHostIndex = trimmedUri.indexOf("/", schemeEndIndex);
  const authorityEndIndex = slashAfterHostIndex === -1 ? trimmedUri.length : slashAfterHostIndex;
  const authority = trimmedUri.slice(schemeEndIndex, authorityEndIndex);
  const lastAtIndex = authority.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return trimmedUri;
  }

  const credentials = authority.slice(0, lastAtIndex);
  const host = authority.slice(lastAtIndex + 1);
  const normalizedCredentials = credentials.replace(/@/g, "%40");

  return `${trimmedUri.slice(0, schemeEndIndex)}${normalizedCredentials}@${host}${trimmedUri.slice(authorityEndIndex)}`;
};

const app = express();
const port = process.env.PORT || 5001;
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const devOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];
const allowedOrigins = new Set([...clientOrigins, ...devOrigins]);
const mongoUri = normalizeMongoUri(process.env.MONGODB_URI);

if (!mongoUri) {
  console.error("MongoDB connection failed: MONGODB_URI is missing in backend/.env");
  process.exit(1);
}

if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  console.error("MongoDB connection failed: MONGODB_URI must start with mongodb:// or mongodb+srv://");
  process.exit(1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "NexDiff API" });
});

app.use("/api", submissionRoutes);
app.use("/api", contentRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong.",
  });
});

mongoose
  .connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    app.listen(port, () => {
      console.log(`NexDiff API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });

module.exports = { app };
