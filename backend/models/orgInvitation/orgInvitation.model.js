const mongoose = require('mongoose');

/** Audit trail for email invites (direct add still updates User immediately). */
const orgInvitationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    inviteeUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    status: {
      type: String,
      enum: ['accepted', 'declined', 'pending'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrgInvitation', orgInvitationSchema);
