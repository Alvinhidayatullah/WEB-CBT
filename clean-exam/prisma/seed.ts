import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPass = process.env.ADMIN_SEED_PASSWORD || 'ChangeMeAdmin123!';
  const guruPass = process.env.GURU_SEED_PASSWORD || 'ChangeMeGuru123!';
  
  const adminPassword = await bcrypt.hash(adminPass, 10);
  const guruPassword = await bcrypt.hash(guruPass, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'vinz_admin' },
    update: {},
    create: {
      username: 'vinz_admin',
      password: adminPassword,
      role: 'SUPER_ADMIN',
    },
  });

  const guru = await prisma.user.upsert({
    where: { username: 'vinz_guru' },
    update: {},
    create: {
      username: 'vinz_guru',
      password: guruPassword,
      role: 'GURU',
      token: 'VINZ1'
    },
  });

  console.log('Database seeded with default accounts:');
  console.log('- Admin:', admin.username);
  console.log('- Guru:', guru.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
