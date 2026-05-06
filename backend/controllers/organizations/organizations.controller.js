const Organization = require('../../models/organization/organization.model');
const User = require('../../models/user/user.model');
const JoinRequest = require('../../models/joinRequest/joinRequest.model');
const Notification = require('../../models/notification/notification.model');
const OrgInvitation = require('../../models/orgInvitation/orgInvitation.model');
const {
  addUserToOrganization,
  removeUserFromOrganization,
  orgRoleForUser,
  userHasMembership,
} = require('../../utils/membership');
const { successResponse, errorResponse } = require('../../utils/response');

async function notifyAdminsJoinRequest(orgDoc, joinRequestDoc, requesterId) {
  const admins = new Set();
  admins.add(String(orgDoc.owner));
  orgDoc.members
    .filter((m) => m.role === 'admin')
    .forEach((m) => admins.add(String(m.user)));
  admins.delete(String(requesterId));

  const rows = [...admins].map((recipient) => ({
    recipient,
    type: 'join_request',
    payload: {
      organizationId: orgDoc._id,
      joinRequestId: joinRequestDoc._id,
      requesterId,
    },
  }));
  if (rows.length) await Notification.insertMany(rows);
}

// Create a new organization
exports.createOrganization = async (req, res) => {
  try {
    const { name, description, visibility } = req.body;

    const vis = visibility === 'public' ? 'public' : 'private';

    const newOrganization = new Organization({
      name,
      description,
      visibility: vis,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }],
    });

    await newOrganization.save();

    await addUserToOrganization(req.user._id, newOrganization._id, 'admin', true);

    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        isGuest: false,
        onboardingCompleted: true,
        role: 'admin',
      },
    });

    const populated = await Organization.findById(newOrganization._id)
      .populate('owner', 'email')
      .populate('members.user', 'email fullName displayName');

    successResponse(res, 201, 'Organization created successfully', populated);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get all organizations for current user
exports.getMyOrganizations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const organizations = await Organization.find({
      'members.user': req.user._id
    })
      .populate('owner', 'email')
      .skip(skip)
      .limit(limit);

    const totalOrganizations = await Organization.countDocuments({
      'members.user': req.user._id
    });

    successResponse(res, 200, "Organizations retrieved successfully", {
      organizations,
      totalOrganizations,
      totalPages: Math.ceil(totalOrganizations / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.getMyOrganization = async (req, res) => {
  try {
    const User = require('../../models/user/user.model');
    const user = await User.findById(req.user._id).populate('organization');
    if (!user || !user.organization) {
      return errorResponse(res, 404, "Organization not found");
    }
    return successResponse(res, 200, "Organization retrieved successfully", user.organization);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

// Get organization by ID
exports.getOrganizationById = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('owner', 'email')
      .populate('members.user', 'email fullName displayName');

    if (!organization) {
      return errorResponse(res, 404, "Organization not found");
    }

    const user = req.currentUser;
    if (user.role === 'super') {
      return successResponse(res, 200, "Organization retrieved successfully", organization);
    }

    // Check if user is a member of the organization
    const isMember = organization.members.some(member =>
      member.user._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return errorResponse(res, 403, "Access denied");
    }

    successResponse(res, 200, "Organization retrieved successfully", organization);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Update organization
exports.updateOrganization = async (req, res) => {
  try {
    const { name, description, visibility } = req.body;

    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    const memberRecord = organization.members.find(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (
      !memberRecord ||
      (memberRecord.role !== 'admin' &&
        organization.owner.toString() !== req.user._id.toString())
    ) {
      return errorResponse(res, 403, 'Not authorized to update organization');
    }

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (visibility === 'public' || visibility === 'private') updatePayload.visibility = visibility;

    const updatedOrganization = await Organization.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );

    successResponse(res, 200, 'Organization updated successfully', updatedOrganization);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Add member to organization
exports.addMember = async (req, res) => {
  try {
    const { userId, role } = req.body;

    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    const memberRecord = organization.members.find(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (
      !memberRecord ||
      (memberRecord.role !== 'admin' &&
        organization.owner.toString() !== req.user._id.toString())
    ) {
      return errorResponse(res, 403, 'Not authorized to add members');
    }

    const already = organization.members.some((member) => member.user.toString() === userId);

    if (already) {
      return errorResponse(res, 400, 'User is already a member of this organization');
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'member';

    await addUserToOrganization(userId, organization._id, normalizedRole, false);

    const updatedOrganization = await Organization.findById(req.params.id).populate(
      'members.user',
      'email'
    );

    successResponse(res, 200, 'Member added successfully', updatedOrganization);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Remove member from organization
exports.removeMember = async (req, res) => {
  try {
    const { userId } = req.body;

    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    const memberRecord = organization.members.find(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (
      !memberRecord ||
      (memberRecord.role !== 'admin' &&
        organization.owner.toString() !== req.user._id.toString())
    ) {
      return errorResponse(res, 403, 'Not authorized to remove members');
    }

    if (organization.owner.toString() === userId) {
      return errorResponse(res, 400, 'Cannot remove the organization owner');
    }

    await removeUserFromOrganization(userId, organization._id);

    const refreshed = await Organization.findById(req.params.id).populate('members.user', 'email');

    successResponse(res, 200, 'Member removed successfully', refreshed);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Delete organization
exports.deleteOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return errorResponse(res, 404, "Organization not found");
    }

    // Only owner or platform super can delete organization
    const reqUser = req.currentUser;
    if (
      organization.owner.toString() !== req.user._id.toString() &&
      reqUser.role !== 'super'
    ) {
      return errorResponse(res, 403, 'Only the organization owner can delete it');
    }

    await Organization.findByIdAndDelete(req.params.id);

    successResponse(res, 200, "Organization deleted successfully");
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get all organizations (admin only)
exports.getAllOrganizations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const organizations = await Organization.find()
      .populate('owner', 'email')
      .skip(skip)
      .limit(limit);

    const totalOrganizations = await Organization.countDocuments();

    successResponse(res, 200, "All organizations retrieved successfully", {
      organizations,
      totalOrganizations,
      totalPages: Math.ceil(totalOrganizations / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get organization members
exports.getOrganizationMembers = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id)
      .populate('members.user', 'email');

    if (!organization) {
      return errorResponse(res, 404, "Organization not found");
    }

    const isMember = organization.members.some(member =>
      member.user._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return errorResponse(res, 403, "Access denied");
    }

    successResponse(res, 200, "Organization members retrieved successfully", organization.members);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.addMemberToOrganization = async (req, res) => {
  try {
    const { userId, role = 'member' } = req.body;

    if (!userId) {
      return errorResponse(res, 400, 'User ID is required');
    }

    const organization = await Organization.findById(req.params.id);

    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    const currentUser = req.currentUser;

    if (currentUser.role !== 'super') {
      const memberRecord = organization.members.find(
        (member) => member.user.toString() === req.user._id.toString()
      );
      if (
        !memberRecord ||
        (memberRecord.role !== 'admin' &&
          organization.owner.toString() !== req.user._id.toString())
      ) {
        return errorResponse(res, 403, 'Not authorized to add members to this organization');
      }
    }

    const already = organization.members.some((member) => member.user.toString() === userId);

    if (already) {
      return errorResponse(res, 400, 'User is already a member of this organization');
    }

    const normalizedRole = role === 'admin' ? 'admin' : 'member';

    await addUserToOrganization(userId, organization._id, normalizedRole, false);

    const updatedOrganization = await Organization.findById(req.params.id).populate(
      'members.user',
      'email'
    );

    successResponse(res, 200, 'Member added successfully', updatedOrganization);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.publicMarketplace = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { visibility: 'public' };
    const orgs = await Organization.find(filter)
      .select('name description visibility members createdAt')
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Organization.countDocuments(filter);

    const rows = orgs.map((o) => ({
      _id: o._id,
      name: o.name,
      description: o.description,
      visibility: o.visibility,
      memberCount: Array.isArray(o.members) ? o.members.length : 0,
    }));

    successResponse(res, 200, 'Public organizations retrieved successfully', {
      organizations: rows,
      totalOrganizations: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.publicOrganizationDetail = async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const organization = await Organization.findById(orgId).populate('owner', 'email displayName').lean();

    if (!organization || organization.visibility !== 'public') {
      return errorResponse(res, 404, 'Organization not found');
    }

    const viewerMembership =
      req.currentUser &&
      organization.members.some((m) => m.user.toString() === req.user._id.toString());

    const base = {
      _id: organization._id,
      name: organization.name,
      description: organization.description,
      visibility: organization.visibility,
      memberCount: organization.members.length,
      viewerMembership,
    };

    successResponse(res, 200, 'Organization retrieved successfully', base);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.requestJoinPublicOrganization = async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const message = req.body.message;

    const organization = await Organization.findById(orgId);
    if (!organization || organization.visibility !== 'public') {
      return errorResponse(res, 404, 'Organization not found');
    }

    if (await userHasMembership(req.user._id, organization._id)) {
      return errorResponse(res, 400, 'You are already a member');
    }

    const dup = await JoinRequest.findOne({
      organization: organization._id,
      requester: req.user._id,
      status: 'pending',
    });
    if (dup) {
      return errorResponse(res, 400, 'Join request already pending');
    }

    const jr = await JoinRequest.create({
      organization: organization._id,
      requester: req.user._id,
      message,
      status: 'pending',
    });

    await notifyAdminsJoinRequest(organization, jr, req.user._id);

    successResponse(res, 201, 'Join request submitted', jr);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.listOrganizationJoinRequests = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.orgId);
    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    const role = await orgRoleForUser(organization, req.user._id);
    if (role !== 'admin') {
      return errorResponse(res, 403, 'Only admins can view join requests');
    }

    const pending = await JoinRequest.find({
      organization: organization._id,
      status: 'pending',
    })
      .populate('requester', 'email displayName fullName')
      .sort({ createdAt: -1 })
      .lean();

    successResponse(res, 200, 'Join requests retrieved successfully', pending);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.reviewJoinRequest = async (req, res) => {
  try {
    const { orgId, requestId } = req.params;
    const decision = req.body.decision === 'accept' ? 'accept' : 'reject';

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    const role = await orgRoleForUser(organization, req.user._id);
    if (role !== 'admin') {
      return errorResponse(res, 403, 'Only admins can review join requests');
    }

    const jr = await JoinRequest.findOne({
      _id: requestId,
      organization: organization._id,
      status: 'pending',
    });
    if (!jr) {
      return errorResponse(res, 404, 'Join request not found');
    }

    if (decision === 'reject') {
      jr.status = 'rejected';
      jr.reviewedAt = new Date();
      jr.reviewedBy = req.user._id;
      await jr.save();
      await Notification.deleteMany({ 'payload.joinRequestId': jr._id });
      return successResponse(res, 200, 'Join request rejected', jr);
    }

    await addUserToOrganization(jr.requester, organization._id, 'member', false);

    jr.status = 'accepted';
    jr.reviewedAt = new Date();
    jr.reviewedBy = req.user._id;
    await jr.save();

    await Notification.deleteMany({ 'payload.joinRequestId': jr._id });

    successResponse(res, 200, 'Join request accepted', jr);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.leaveOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.orgId);
    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    if (organization.owner.toString() === req.user._id.toString()) {
      return errorResponse(res, 400, 'Transfer ownership before leaving this organization');
    }

    if (!(await userHasMembership(req.user._id, organization._id))) {
      return errorResponse(res, 403, 'You are not a member');
    }

    await removeUserFromOrganization(req.user._id, organization._id);

    successResponse(res, 200, 'You left the organization');
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

exports.transferOwnership = async (req, res) => {
  try {
    const { newOwnerId } = req.body;

    if (!newOwnerId) {
      return errorResponse(res, 400, 'newOwnerId is required');
    }

    const organization = await Organization.findById(req.params.orgId);
    if (!organization) {
      return errorResponse(res, 404, 'Organization not found');
    }

    if (organization.owner.toString() !== req.user._id.toString()) {
      return errorResponse(res, 403, 'Only the owner can transfer ownership');
    }

    const memberRow = organization.members.find((m) => m.user.toString() === newOwnerId);
    if (!memberRow) {
      return errorResponse(res, 400, 'New owner must be an existing member');
    }

    organization.owner = newOwnerId;
    memberRow.role = 'admin';
    await organization.save();

    successResponse(res, 200, 'Ownership transferred successfully', organization);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};
