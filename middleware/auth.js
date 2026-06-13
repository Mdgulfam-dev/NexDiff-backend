const crypto = require("crypto");

const base64Url = (value) =>
  Buffer.from(value).toString("base64url");

const signToken = (payload) => {
  const secret = process.env.ADMIN_TOKEN_SECRET || "change-this-secret";
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
};

const verifyToken = (token) => {
  const secret = process.env.ADMIN_TOKEN_SECRET || "change-this-secret";
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

  if (payload.exp && Date.now() > payload.exp) {
    return null;
  }

  return payload;
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  try {
    const payload = verifyToken(token);

    if (!payload?.admin) {
      return res.status(401).json({ message: "Admin login required." });
    }

    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Admin login required." });
  }
};

const requireRoles = (roles) => (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  try {
    const payload = verifyToken(token);

    if (!payload?.admin) {
      return res.status(401).json({ message: "Admin login required." });
    }

    if (!roles.includes(payload.role)) {
      return res.status(403).json({ message: "You do not have access to this section." });
    }

    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Admin login required." });
  }
};

module.exports = { requireAdmin, requireRoles, signToken };
