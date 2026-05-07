const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../../models/user/user.model");
const Organization = require("../../models/organization/organization.model");
const { generateToken, successResponse, errorResponse } = require("../../utils/response");
const {
  isEmailAllowed,
  getRegisterPasswordError,
} = require("../../middleware/validate.middleware");
const { sendPasswordResetEmail } = require("../../utils/email");
const { ensurePersonalWorkspace } = require("../../utils/userOrganization");
const { addUserToOrganization } = require("../../utils/membership");

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT authentication token
 *         expiresIn:
 *           type: integer
 *           description: Token expiration in seconds
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               description: User ID
 *             email:
 *               type: string
 *               description: User email
 *             role:
 *               type: string
 *               description: User role
 *             organization:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Organization ID
 *                 name:
 *                   type: string
 *                   description: Organization name
 *                 role:
 *                   type: string
 *                   description: User's role in the organization
 *         success:
 *           type: boolean
 *           description: Success status
 *         message:
 *           type: string
 *           description: Response message
 */

// Register a new user
exports.register = async (req, res) => {
  try {
    const { email, password, organization, createOrg } = req.body;
    if (!email || !password) {
      return errorResponse(res, 400, "Email and password are required");
    }

    if (!isEmailAllowed(email)) {
      return res.status(403).json({
        message:
          "This email is not authorized to create an account. Contact admin.",
      });
    }

    const pwdErr = getRegisterPasswordError(password);
    if (pwdErr) {
      return errorResponse(res, 400, pwdErr);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, "User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      password: hashedPassword,
      role: 'user',
      onboardingCompleted: false,
    });
    await newUser.save();

    let onboardingCompleted = false;

    if (organization && createOrg) {
      const existingOrg = await Organization.findOne({ name: organization });
      if (existingOrg) {
        return res.status(400).json({
          message: "This organization already exists. Please join as a member instead.",
          suggestRole: 'member'
        });
      }

      const newOrg = await Organization.create({
        name: organization,
        owner: newUser._id,
        members: [{ user: newUser._id, role: 'admin' }],
        visibility: 'private',
      });

      await addUserToOrganization(newUser._id, newOrg._id, 'admin', true);

      await User.findByIdAndUpdate(newUser._id, {
        $set: { role: 'admin', onboardingCompleted: true, isGuest: false },
      });
      onboardingCompleted = true;
    } else if (organization) {
      const existingOrg = await Organization.findOne({ name: organization });
      if (existingOrg) {
        await addUserToOrganization(newUser._id, existingOrg._id, 'member', true);

        await User.findByIdAndUpdate(newUser._id, {
          $set: { onboardingCompleted: true, isGuest: false },
        });
        onboardingCompleted = true;
      }
    }

    if (!onboardingCompleted) {
      await User.findByIdAndUpdate(newUser._id, {
        $set: { onboardingCompleted: false },
      });
    }

    let userForToken = await User.findById(newUser._id).populate('organization', 'name');
    const deliberatelyPendingWorkspace =
      userForToken.onboardingCompleted === true &&
      !userForToken.isGuest &&
      userForToken.role !== 'super' &&
      !userForToken.organization &&
      !(userForToken.memberships?.length);

    if (
      !userForToken.organization &&
      userForToken.role !== 'super' &&
      userForToken.onboardingCompleted !== false &&
      !userForToken.isGuest &&
      !deliberatelyPendingWorkspace
    ) {
      userForToken = await ensurePersonalWorkspace(newUser._id);
    }

    const token = generateToken(userForToken);

    const resolvedOrg =
      userForToken.organization && userForToken.organization._id
        ? {
            id: userForToken.organization._id,
            name: userForToken.organization.name,
          }
        : null;

    res
      .status(201)
      .json({
        token,
        expiresIn: 3600,
        user: {
          _id: userForToken._id,
          email: userForToken.email,
          role: userForToken.role,
          organization: resolvedOrg
        },
        needsOnboarding:
          userForToken.role !== 'super' &&
          userForToken.onboardingCompleted === false,
        success: true,
        message: 'User registered successfully'
      });
  } catch (error) {
    res.status(500).json({ message: error.message, success: false });
  }
};

// User login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    let loginUser = await User.findOne({ email }).select('+password').populate('organization', 'name');
    if (!loginUser) {
      return errorResponse(res, 404, "User not found");
    }
    if (!loginUser.password) {
      return errorResponse(res, 401, "Please sign in with Google");
    }
    const isValidPassword = await bcrypt.compare(password, loginUser.password);
    if (!isValidPassword) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    const deliberatelyPendingWorkspace =
      loginUser.onboardingCompleted === true &&
      !loginUser.isGuest &&
      loginUser.role !== 'super' &&
      !loginUser.organization &&
      !(loginUser.memberships?.length);

    if (
      !loginUser.organization &&
      loginUser.role !== 'super' &&
      loginUser.onboardingCompleted !== false &&
      !loginUser.isGuest &&
      !deliberatelyPendingWorkspace
    ) {
      loginUser = await ensurePersonalWorkspace(loginUser._id);
    }

    const token = generateToken(loginUser);
    res.status(200).json({
      token,
      expiresIn: 3600,
      user: {
        _id: loginUser._id,
        email: loginUser.email,
        role: loginUser.role,
        organization: loginUser.organization ? {
          id: loginUser.organization._id,
          name: loginUser.organization.name,
        } : null,
      },
      needsOnboarding:
        loginUser.role !== 'super' &&
        loginUser.onboardingCompleted === false,
      success: true,
      message: 'Login successful'
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.logout = (req, res) => {
  successResponse(res, 200, "User logged out");
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    successResponse(res, 200, "Users retrieved successfully", users);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, 400, "Email is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return successResponse(res, 200, "If an account with that email exists, a reset link has been sent");
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateModifiedOnly: true });

    await sendPasswordResetEmail(email, resetToken);

    successResponse(res, 200, "If an account with that email exists, a reset link has been sent");
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return errorResponse(res, 400, "Token and password are required");
    }

    if (password.length < 8) {
      return errorResponse(res, 400, "Password must be at least 8 characters");
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return errorResponse(res, 400, "Invalid or expired reset token");
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateModifiedOnly: true });

    successResponse(res, 200, "Password has been reset successfully");
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};
