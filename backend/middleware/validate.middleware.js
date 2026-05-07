const { errorResponse } = require('../utils/response');

const isEmailAllowed = (email) => {
  const raw = process.env.ALLOWED_EMAILS || '';
  if (!raw.trim()) return true;
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase());
  return allowed.includes(email.trim().toLowerCase());
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @returns {string|null} Error message or null when password satisfies registration rules */
const getRegisterPasswordError = (password) => {
  if (password == null || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.trim() === '') {
    return 'Password is required';
  }
  const missing = [];
  if (password.length < 6) missing.push('at least 6 characters');
  if (!/[A-Z]/.test(password)) missing.push('one uppercase letter');
  if (!/[a-z]/.test(password)) missing.push('one lowercase letter');
  if (!/[0-9]/.test(password)) missing.push('one number');
  if (!/[^A-Za-z0-9]/.test(password)) missing.push('one special character');
  if (missing.length === 0) return null;
  return `Password must contain ${missing.join(', ')}.`;
};

const validateRegister = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Invalid email format');
  } else if (!isEmailAllowed(email)) {
    return res.status(403).json({
      message:
        'This email is not authorized to create an account. Contact admin.',
    });
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, errors.join(', '));
  }

  const pwdMsg = getRegisterPasswordError(password);
  if (pwdMsg) {
    return errorResponse(res, 400, pwdMsg);
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Invalid email format');
  } else if (!isEmailAllowed(email)) {
    return res.status(403).json({
      message: 'Access restricted. Contact the admin to get access.',
      success: false,
    });
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, errors.join(', '));
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateCreateTask = (req, res, next) => {
  const { title, userId } = req.body;
  const errors = [];

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!userId || typeof userId !== 'string') {
    errors.push('Assigned user ID is required');
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, errors.join(', '));
  }

  next();
};

const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return errorResponse(res, 400, `Invalid ${paramName} format`);
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateTask,
  validateObjectId,
  isEmailAllowed,
  getRegisterPasswordError,
};
