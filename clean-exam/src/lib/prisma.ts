import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
};

declare global {
  var prismaGlobalV2: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobalV2 ?? prismaClientSingleton();

export default prisma;

// Pastikan instance prisma di-cache di semua environment (termasuk production Serverless)
// agar tidak membuat koneksi database baru di setiap request
globalThis.prismaGlobalV2 = prisma;
