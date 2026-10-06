const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');
const { generateNextId, PREFIX_CONFIG } = require('../utils/idGenerator');

function setupPrismaMiddleware(client) {
  if (client._hasIdGeneratorMiddleware) return;
  client._hasIdGeneratorMiddleware = true;

  client.$use(async (params, next) => {
    // 1. Intercept 'create'
    if (params.action === 'create' && params.args && params.args.data) {
      const model = params.model;
      const data = params.args.data;

      // Generate primary ID jika belum ada
      if (!data.id && PREFIX_CONFIG[model]) {
        data.id = await generateNextId(model, client);
      }

      // Khusus model Handover
      if (model === 'Handover') {
        if (!data.handoverNo && data.id) {
          data.handoverNo = data.id;
        }

        // Nested items.create
        if (data.items && data.items.create) {
          if (Array.isArray(data.items.create)) {
            for (let i = 0; i < data.items.create.length; i++) {
              if (!data.items.create[i].id) {
                data.items.create[i].id = await generateNextId('HandoverItem', client, i);
              }
            }
          } else if (typeof data.items.create === 'object' && !data.items.create.id) {
            data.items.create.id = await generateNextId('HandoverItem', client);
          }
        }

        // Nested photos.create
        if (data.photos && data.photos.create) {
          if (Array.isArray(data.photos.create)) {
            for (let i = 0; i < data.photos.create.length; i++) {
              if (!data.photos.create[i].id) {
                data.photos.create[i].id = await generateNextId('Photo', client, i);
              }
            }
          } else if (typeof data.photos.create === 'object' && !data.photos.create.id) {
            data.photos.create.id = await generateNextId('Photo', client);
          }
        }

        // Nested issue.create
        if (data.issue && data.issue.create && !data.issue.create.id) {
          data.issue.create.id = await generateNextId('Issue', client);
        }
      }
    }

    // 2. Intercept 'createMany'
    if (params.action === 'createMany' && params.args && params.args.data) {
      const model = params.model;
      if (PREFIX_CONFIG[model]) {
        if (Array.isArray(params.args.data)) {
          for (let i = 0; i < params.args.data.length; i++) {
            if (!params.args.data[i].id) {
              params.args.data[i].id = await generateNextId(model, client, i);
            }
          }
        }
      }
    }

    return next(params);
  });
}

// PrismaClient is attached to global in development to prevent exhausting database connection limit
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
  setupPrismaMiddleware(prisma);
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['error', 'warn']
    });
    setupPrismaMiddleware(global.prisma);
  }
  prisma = global.prisma;
}

module.exports = prisma;
