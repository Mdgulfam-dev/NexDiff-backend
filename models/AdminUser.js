const crypto = require("crypto");
const mongoose = require("mongoose");

const adminRoles = ["admin", "executive", "manager"];

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, "sha512")
    .toString("hex");

  return { salt, hash };
};

const verifyPassword = (password, user) => {
  const { hash } = hashPassword(password, user.passwordSalt);
  const hashBuffer = Buffer.from(hash);
  const storedBuffer = Buffer.from(user.passwordHash || "");

  return (
    hashBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(hashBuffer, storedBuffer)
  );
};

const adminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    usernameKey: { type: String, required: true, unique: true, lowercase: true, index: true },
    role: { type: String, required: true, enum: adminRoles, index: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

adminUserSchema.statics.buildPassword = hashPassword;
adminUserSchema.statics.verifyPassword = verifyPassword;

module.exports = {
  AdminUser: mongoose.model("AdminUser", adminUserSchema),
  adminRoles,
};
