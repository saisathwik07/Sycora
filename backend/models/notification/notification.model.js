const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['join_request'],
      required: true,
    },
    read: { type: Boolean, default: false, index: true },
    payload: {
      organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
      joinRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'JoinRequest' },
      requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
