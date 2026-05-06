const mongoose = require('mongoose');
const User = require('../models/user/user.model');
const Organization = require('../models/organization/organization.model');

function idStr(ref) {
  if (!ref) return null;
  return typeof ref === 'object' && ref._id != null ? String(ref._id) : String(ref);
}

/**
 * Backfill User.memberships from Organization.members when legacy users only had organization set.
 */
async function hydrateMembershipsFromOrg(userDoc) {
  if (!userDoc || userDoc.memberships?.length) return userDoc;
  const orgId = userDoc.organization;
  if (!orgId) return userDoc;
  const org = await Organization.findById(orgId).lean();
  if (!org) return userDoc;
  const row = org.members.find((m) => idStr(m.user) === idStr(userDoc._id));
  const role = row?.role || 'member';
  const joinedAt = row?.joinedAt || new Date();
  await User.updateOne(
    { _id: userDoc._id },
    { $set: { memberships: [{ organization: orgId, role, joinedAt }] } }
  );
  return User.findById(userDoc._id).lean();
}

/**
 * Set active workspace when user has memberships but no organization pointer.
 */
async function hydrateActiveOrganization(userDoc) {
  if (!userDoc || userDoc.organization || !userDoc.memberships?.length) return userDoc;
  const first = userDoc.memberships[0].organization;
  await User.updateOne({ _id: userDoc._id }, { $set: { organization: first } });
  return User.findById(userDoc._id).lean();
}

async function hydrateUserOrgContext(userId) {
  let user = await User.findById(userId).lean();
  if (!user) return user;
  user = await hydrateMembershipsFromOrg(user);
  user = await hydrateActiveOrganization(user);
  return user;
}

async function userHasMembership(userId, organizationId) {
  const u = await User.findById(userId).select('memberships organization').lean();
  if (!u) return false;
  const oid = idStr(organizationId);
  if (u.organization && idStr(u.organization) === oid) return true;
  return (u.memberships || []).some((m) => idStr(m.organization) === oid);
}

async function orgRoleForUser(orgDoc, userId) {
  const uid = idStr(userId);
  if (idStr(orgDoc.owner) === uid) return 'admin';
  const row = orgDoc.members.find((m) => idStr(m.user) === uid);
  return row ? row.role : null;
}

/**
 * Sync Organization.members and User.memberships (+ optional active org).
 */
async function addUserToOrganization(userId, organizationId, role = 'member', setAsActive = false) {
  const orgId = new mongoose.Types.ObjectId(idStr(organizationId));
  const uid = new mongoose.Types.ObjectId(idStr(userId));

  await Organization.updateOne(
    { _id: orgId, 'members.user': { $ne: uid } },
    { $push: { members: { user: uid, role } } }
  );

  await User.updateOne(
    { _id: uid, 'memberships.organization': { $ne: orgId } },
    { $push: { memberships: { organization: orgId, role, joinedAt: new Date() } } }
  );

  if (setAsActive) {
    await User.updateOne({ _id: uid }, { $set: { organization: orgId } });
  }
}

async function removeUserFromOrganization(userId, organizationId) {
  const orgId = idStr(organizationId);
  const uid = idStr(userId);

  await Organization.updateOne(
    { _id: orgId },
    { $pull: { members: { user: uid } } }
  );

  await User.updateOne(
    { _id: uid },
    { $pull: { memberships: { organization: orgId } } }
  );

  const u = await User.findById(uid).lean();
  if (u && idStr(u.organization) === orgId) {
    const next = u.memberships?.[0]?.organization;
    if (next) {
      await User.updateOne({ _id: uid }, { $set: { organization: next } });
    } else {
      await User.updateOne({ _id: uid }, { $unset: { organization: 1 } });
    }
  }
}

module.exports = {
  idStr,
  hydrateUserOrgContext,
  userHasMembership,
  orgRoleForUser,
  addUserToOrganization,
  removeUserFromOrganization,
};
