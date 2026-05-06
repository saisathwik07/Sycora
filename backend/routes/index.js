/**
 * Registers all REST API routers on the Express app.
 * Mount paths are unchanged from previous versions (/api/*).
 */
function registerApiRoutes(app) {
  app.use('/api/auth', require('./auth/auth.routes'));
  app.use('/api/tasks', require('./tasks/tasks.routes'));
  app.use('/api/users', require('./users/users.routes'));
  app.use('/api/organizations', require('./organizations/organizations.routes'));
}

module.exports = registerApiRoutes;
