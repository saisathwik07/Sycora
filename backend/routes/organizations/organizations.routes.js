const express = require('express');
const router = express.Router();
const organizationController = require('../../controllers/organizations/organizations.controller');
const { auth, isAdmin, rejectGuest } = require('../../middleware/auth.middleware');

router.get('/public/marketplace', auth, organizationController.publicMarketplace);
router.get('/public/:orgId', auth, organizationController.publicOrganizationDetail);
router.post(
  '/public/:orgId/join-request',
  auth,
  rejectGuest,
  organizationController.requestJoinPublicOrganization
);

router.get('/my/list', auth, organizationController.getMyOrganizations);
router.get('/my', auth, organizationController.getMyOrganization);

router.post('/', auth, rejectGuest, organizationController.createOrganization);

router.get('/', auth, isAdmin, organizationController.getAllOrganizations);

router.post('/:orgId/leave', auth, rejectGuest, organizationController.leaveOrganization);
router.post('/:orgId/transfer-ownership', auth, rejectGuest, organizationController.transferOwnership);
router.get('/:orgId/join-requests', auth, rejectGuest, organizationController.listOrganizationJoinRequests);
router.post(
  '/:orgId/join-requests/:requestId/review',
  auth,
  rejectGuest,
  organizationController.reviewJoinRequest
);

router.get('/:id/members', auth, organizationController.getOrganizationMembers);
router.post('/:id/members', auth, rejectGuest, organizationController.addMemberToOrganization);
router.delete('/:id/members', auth, rejectGuest, organizationController.removeMember);

router.get('/:id', auth, organizationController.getOrganizationById);
router.put('/:id', auth, rejectGuest, organizationController.updateOrganization);
router.delete('/:id', auth, rejectGuest, organizationController.deleteOrganization);

module.exports = router;
