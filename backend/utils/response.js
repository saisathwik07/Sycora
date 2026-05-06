require("dotenv").config();
const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set");
  process.exit(1);
}

const createResponse = (res, status, message, data = null) => {
  const response = { status: status >= 200 && status < 300 ? "success" : "error", message };
  if (data) response.data = data;
  res.status(status).json(response);
};

const successResponse = (res, status, message, data) =>
  createResponse(res, status, message, data);

const errorResponse = (res, status, message) =>
  createResponse(res, status, message);

const generateToken = (user) => {
  const payload = {
    _id: user._id,
    role: user.role,
    isGuest: Boolean(user.isGuest),
  };
  const orgRef = user.organization;
  if (orgRef) {
    payload.organizationId =
      typeof orgRef === "object" && orgRef._id != null
        ? String(orgRef._id)
        : String(orgRef);
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

module.exports = { successResponse, errorResponse, generateToken };
