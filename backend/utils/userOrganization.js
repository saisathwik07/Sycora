const User = require('../models/user/user.model');
const Organization = require('../models/organization/organization.model');

/**
 * Ensures the user belongs to an organization. If not (and not platform super),
 * creates a personal workspace, assigns it atomically, and promotes the user to org admin.
 *
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function ensurePersonalWorkspace(userId) {
  let user = await User.findById(userId).populate('organization', 'name');
  if (!user) {
    throw new Error('User not found');
  }
  if (user.organization) {
    return user;
  }
  if (user.role === 'super') {
    return user;
  }

  const emailLocal = (user.email || 'me').split('@')[0] || 'me';
  const sanitizedLocal = emailLocal.replace(/[^\w\-]/g, '').slice(0, 40) || 'workspace';
  let baseName = `${sanitizedLocal}'s workspace`;
  let name = baseName;
  let n = 0;
  while (await Organization.findOne({ name }).lean()) {
    n += 1;
    name = `${baseName} (${n})`;
  }

  const org = await Organization.create({
    name,
    description: 'Your Syncora workspace',
    owner: user._id,
    members: [{ user: user._id, role: 'admin' }],
  });

  const assigned = await User.findOneAndUpdate(
    {
      _id: userId,
      role: { $ne: 'super' },
      $or: [{ organization: null }, { organization: { $exists: false } }],
    },
    {
      $set: { organization: org._id, role: 'admin' },
      $push: {
        memberships: {
          organization: org._id,
          role: 'admin',
          joinedAt: new Date(),
        },
      },
    },
    { new: true }
  ).populate('organization', 'name');

  if (!assigned) {
    await Organization.findByIdAndDelete(org._id);
    return User.findById(userId).populate('organization', 'name');
  }

  return assigned;
}

module.exports = { ensurePersonalWorkspace };
