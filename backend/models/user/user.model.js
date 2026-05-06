const mongoose = require("mongoose");

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated ID
 *         email:
 *           type: string
 *           description: User's email address
 *         password:
 *           type: string
 *           description: User's hashed password
 *         organization:
 *           type: string
 *           description: ID of the organization the user belongs to
 *         role:
 *           type: string
 *           enum: [user, admin, super]
 *           description: User's role
 *       example:
 *         _id: 60d21b4667d0d8992e610c85
 *         email: user@example.com
 *         password: $2a$10$XCJgJ7Qy3i6TKoKBDmN3AO5CTUVe
 *         organization: 60d21b4667d0d8992e610c86
 *         role: user
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function requiresPassword() {
      return !this.googleId;
    },
    select: false,
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true,
    select: false,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
  },
  role: { type: String, enum: ["user", "admin", "super"], default: "user" },
  isGuest: {
    type: Boolean,
    default: false,
    index: true,
  },
  memberships: [
    {
      organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
      },
      role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member',
      },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  fullName: {
    type: String,
    trim: true,
  },
  displayName: {
    type: String,
    trim: true,
  },
  /** When false, user must complete onboarding (profile + workspace) before using the app. */
  onboardingCompleted: {
    type: Boolean,
  },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
