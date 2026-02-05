import { PrismaClient } from '@prisma/client';
import { createSoftDeleteMiddleware } from './prisma-extensions';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma client with soft delete middleware
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

  // Apply soft delete middleware (LGPD Compliance)
  // Note: For user-context aware soft delete, use createPrismaClientWithSoftDelete from prisma-extensions
  client.$use(createSoftDeleteMiddleware({}));

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// Re-export extended client utilities for when you need full control
export { 
  createExtendedPrismaClient, 
  createPrismaClientWithSoftDelete,
  logDeletion,
  isDeleted,
  getRecordsDueForHardDelete,
} from './prisma-extensions';
