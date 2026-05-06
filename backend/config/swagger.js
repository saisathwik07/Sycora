const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Syncora API',
      version: '1.0.0',
      description: 'REST API for Syncora task management',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://task-management-app-8t3d.vercel.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../routes/**/*.js'),
    path.join(__dirname, '../controllers/**/*.js'),
    path.join(__dirname, '../models/**/*.js'),
  ],
};

const swaggerSpec = swaggerJsDoc(options);

module.exports = swaggerSpec;
