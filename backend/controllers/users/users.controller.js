const User = require("../../models/user/user.model");
const Organization = require("../../models/organization/organization.model");
const OrgInvitation = require("../../models/orgInvitation/orgInvitation.model");
const Notification = require("../../models/notification/notification.model");
const { addUserToOrganization } = require("../../utils/membership");
const { successResponse, errorResponse, generateToken } = require("../../utils/response");

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(req.user._id);
    let query = {};

    if (currentUser.role !== 'super') {
      if (!currentUser.organization) {
        return errorResponse(res, 403, "User not associated with any organization");
      }
      query = { organization: currentUser.organization };
    }

    const users = await User.find(query).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments(query);

    return successResponse(res, 200, "Users retrieved successfully", {
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

// Get users by organization
exports.getUsersByOrganization = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get the current user's organization
    const user = await User.findById(req.user._id);
    if (!user.organization) {
      return errorResponse(res, 400, "User is not associated with any organization");
    }

    const orgDoc = await Organization.findById(user.organization).lean();

    // Find all users in the same organization
    const users = await User.find({
      organization: user.organization 
    })
    .select('-password')
    .skip(skip)
    .limit(limit)
    .lean();

    const usersWithOrgRole = users.map((u) => {
      let organizationRole = null;
      if (orgDoc && orgDoc.members) {
        const m = orgDoc.members.find(
          (mem) => mem.user.toString() === u._id.toString()
        );
        organizationRole = m ? m.role : null;
      }
      return { ...u, organizationRole };
    });

    const totalUsers = await User.countDocuments({ organization: user.organization });

    successResponse(res, 200, "Organization users retrieved successfully", {
      users: usersWithOrgRole,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get current user's profile with organization info and org role
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('organization', 'name _id visibility');

    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    let organizationRole = null;
    let joinedAt = null;

    if (user.organization) {
      const org = await Organization.findById(user.organization._id);
      if (org) {
        const member = org.members.find((m) => m.user.toString() === user._id.toString());
        if (member) {
          organizationRole = member.role;
          joinedAt = member.joinedAt;
        }
      }
    }

    const memberships = await User.findById(req.user._id)
      .populate('memberships.organization', 'name description visibility')
      .select('memberships')
      .lean();

    const needsOnboarding =
      user.role !== 'super' && user.onboardingCompleted === false;

    const needsWorkspaceChoice =
      user.role !== 'super' &&
      !user.isGuest &&
      !(memberships.memberships && memberships.memberships.length > 0) &&
      !user.organization;

    const profile = {
      _id: user._id,
      fullName: user.fullName,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      isGuest: Boolean(user.isGuest),
      createdAt: user.createdAt,
      organization: user.organization,
      memberships: memberships.memberships || [],
      organizationRole,
      joinedAt,
      needsOnboarding,
      needsWorkspaceChoice,
    };

    return successResponse(res, 200, 'Profile retrieved successfully', profile);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }
    return successResponse(res, 200, "User retrieved successfully", user);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }
    
    const currentUser = await User.findById(req.user._id);
    
    if (req.user._id.toString() !== id) {
      if (currentUser.role !== 'super') {
        if (currentUser.role !== 'admin' || !currentUser.organization || user.organization?.toString() !== currentUser.organization.toString()) {
          return errorResponse(res, 403, "Not authorized to update this user");
        }
      }
    }
    
    const updateData = {};
    if (email) updateData.email = email;
    
    if (role && (currentUser.role === 'admin' || currentUser.role === 'super') && req.user._id.toString() !== id) {
      updateData.role = role;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      id, updateData, { new: true, runValidators: true }
    );
    
    return successResponse(res, 200, "User updated successfully", updatedUser);
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse(res, 400, "Email already exists");
    }
    return errorResponse(res, 500, error.message);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }
    
    if (id === req.user._id.toString()) {
      return errorResponse(res, 400, "You cannot delete your own account");
    }

    const currentUser = await User.findById(req.user._id);
    if (currentUser.role !== 'super') {
      if (currentUser.role !== 'admin' || !currentUser.organization || user.organization?.toString() !== currentUser.organization.toString()) {
        return errorResponse(res, 403, "Not authorized to delete this user");
      }
    }
    
    await User.findByIdAndDelete(id);
    
    return successResponse(res, 200, "User deleted successfully");
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

/**
 * First-time setup: profile fields + personal workspace (when user has no org).
 */
exports.completeOnboarding = async (req, res) => {
  try {
    const trimmedFull = String(req.body.fullName || '').trim();
    const trimmedDisplay = String(req.body.displayName || '').trim();
    const trimmedWs = String(req.body.workspaceName || '').trim();
    const skipWorkspace = Boolean(req.body.skipWorkspace);

    if (trimmedFull.length < 2) {
      return errorResponse(res, 400, 'Full name must be at least 2 characters');
    }
    if (trimmedDisplay.length < 1) {
      return errorResponse(res, 400, 'Display name is required');
    }
    if (!skipWorkspace && trimmedWs.length < 2) {
      return errorResponse(res, 400, 'Workspace name must be at least 2 characters');
    }

    let user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    if (user.role === "super") {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          fullName: trimmedFull,
          displayName: trimmedDisplay,
          onboardingCompleted: true,
        },
      });
      const updated = await User.findById(user._id).populate("organization", "name");
      const token = generateToken(updated);
      return successResponse(res, 200, "Profile saved", {
        token,
        expiresIn: 3600,
        user: {
          _id: updated._id,
          email: updated.email,
          role: updated.role,
          organization:
            updated.organization && updated.organization._id
              ? {
                  id: updated.organization._id,
                  name: updated.organization.name,
                }
              : null,
        },
      });
    }

    if (user.organization) {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          fullName: trimmedFull,
          displayName: trimmedDisplay,
          onboardingCompleted: true,
        },
      });
      const updated = await User.findById(user._id).populate("organization", "name");
      const token = generateToken(updated);
      return successResponse(res, 200, "Profile saved", {
        token,
        expiresIn: 3600,
        user: {
          _id: updated._id,
          email: updated.email,
          role: updated.role,
          organization: {
            id: updated.organization._id,
            name: updated.organization.name,
          },
        },
      });
    }

    if (skipWorkspace) {
      await User.findByIdAndUpdate(user._id, {
        $set: {
          fullName: trimmedFull,
          displayName: trimmedDisplay,
          onboardingCompleted: true,
          isGuest: false,
        },
      });
      const updated = await User.findById(user._id).populate('organization', 'name');
      const token = generateToken(updated);
      return successResponse(res, 200, 'Profile saved', {
        token,
        expiresIn: 3600,
        user: {
          _id: updated._id,
          email: updated.email,
          role: updated.role,
          organization:
            updated.organization && updated.organization._id
              ? {
                  id: updated.organization._id,
                  name: updated.organization.name,
                }
              : null,
        },
      });
    }

    let name = trimmedWs;
    let n = 0;
    while (await Organization.findOne({ name }).lean()) {
      n += 1;
      name = `${trimmedWs} (${n})`;
    }

    const org = await Organization.create({
      name,
      description: `${trimmedDisplay}'s workspace on Syncora`,
      owner: user._id,
      members: [{ user: user._id, role: "admin" }],
      visibility: 'private',
    });

    await addUserToOrganization(user._id, org._id, 'admin', true);

    const updated = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          fullName: trimmedFull,
          displayName: trimmedDisplay,
          role: "admin",
          onboardingCompleted: true,
          isGuest: false,
        },
      },
      { new: true }
    ).populate("organization", "name");

    const token = generateToken(updated);
    return successResponse(res, 200, "Onboarding complete", {
      token,
      expiresIn: 3600,
      user: {
        _id: updated._id,
        email: updated.email,
        role: updated.role,
        organization: {
          id: updated.organization._id,
          name: updated.organization.name,
        },
      },
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

/**
 * Invite an existing user by email into the inviter's current organization.
 */
exports.inviteMemberByEmail = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .toLowerCase()
      .trim();
    const role = req.body.role === "admin" ? "admin" : "member";

    if (!email) {
      return errorResponse(res, 400, "Email is required");
    }

    const currentUser = await User.findById(req.user._id);
    if (currentUser.isGuest) {
      return errorResponse(res, 403, 'Guests cannot invite members');
    }
    if (!currentUser.organization) {
      return errorResponse(res, 400, "You are not part of a workspace yet");
    }

    const org = await Organization.findById(currentUser.organization);
    if (!org) {
      return errorResponse(res, 404, "Organization not found");
    }

    const memberRecord = org.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );
    const isOwner = org.owner.toString() === req.user._id.toString();
    const canInvite =
      currentUser.role === "super" ||
      isOwner ||
      (memberRecord && memberRecord.role === "admin");

    if (!canInvite) {
      return errorResponse(res, 403, "Not authorized to invite members");
    }

    const invitee = await User.findOne({ email });
    if (!invitee) {
      return errorResponse(res, 404, "User not found");
    }

    const already = org.members.some(
      (m) => m.user.toString() === invitee._id.toString()
    );
    if (already) {
      return errorResponse(res, 400, "User is already a member of this workspace");
    }

    const setActive = !invitee.organization;

    await addUserToOrganization(invitee._id, org._id, role, setActive);

    await OrgInvitation.create({
      organization: org._id,
      email,
      inviteeUser: invitee._id,
      invitedBy: req.user._id,
      role,
      status: 'accepted',
    });

    return successResponse(res, 200, "Member added successfully", {
      userId: invitee._id,
      email: invitee.email,
      organizationRole: role,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.switchWorkspace = async (req, res) => {
  try {
    const organizationId = String(req.body.organizationId || '').trim();
    if (!organizationId) {
      return errorResponse(res, 400, 'organizationId is required');
    }

    const user = await User.findById(req.user._id).select('memberships organization').lean();
    const allowed = (user.memberships || []).some(
      (m) => m.organization.toString() === organizationId
    );
    if (!allowed) {
      return errorResponse(res, 403, 'You are not a member of this organization');
    }

    await User.findByIdAndUpdate(req.user._id, { $set: { organization: organizationId } });

    const updated = await User.findById(req.user._id).populate('organization', 'name visibility');

    const token = generateToken(updated);
    return successResponse(res, 200, 'Workspace switched', {
      token,
      expiresIn: 3600,
      organization:
        updated.organization && updated.organization._id
          ? {
              id: updated.organization._id,
              name: updated.organization.name,
            }
          : null,
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.becomeGuest = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { isGuest: true, onboardingCompleted: true },
      $unset: { organization: 1, memberships: 1 },
    });

    const updated = await User.findById(req.user._id).populate('organization', 'name');

    const token = generateToken(updated);
    return successResponse(res, 200, 'Continuing as guest', {
      token,
      expiresIn: 3600,
      user: {
        _id: updated._id,
        email: updated.email,
        role: updated.role,
        isGuest: true,
        organization: null,
      },
    });
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.listNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return successResponse(res, 200, 'Notifications retrieved successfully', notifications);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipient: req.user._id },
      { $set: { read: true } },
      { new: true }
    );

    if (!updated) {
      return errorResponse(res, 404, 'Notification not found');
    }

    return successResponse(res, 200, 'Notification updated', updated);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};
