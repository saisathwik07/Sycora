const { errorResponse } = require('../utils/response');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegister = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Invalid email format');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, errors.join(', '));
  }

  req.body.email = email.trim().toLowerCase();
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
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

module.exports = { validateRegister, validateLogin, validateCreateTask, validateObjectId };
