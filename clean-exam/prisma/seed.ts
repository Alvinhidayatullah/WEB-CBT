import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPass = process.env.ADMIN_SEED_PASSWORD || 'ChangeMeAdmin123!';
  const guruPass = process.env.GURU_SEED_PASSWORD || 'ChangeMeGuru123!';
  
  const adminPassword = await bcrypt.hash(adminPass, 10);
  const guruPassword = await bcrypt.hash(guruPass, 10);

  let admin = await prisma.user.findFirst({ where: { username: 'vinz_admin' } });
  if (admin) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { password: adminPassword },
    });
  } else {
    admin = await prisma.user.create({
      data: {
        username: 'vinz_admin',
        password: adminPassword,
        role: 'SUPER_ADMIN',
      },
    });
  }

  let guru = await prisma.user.findFirst({ where: { username: 'vinz_guru' } });
  if (guru) {
    guru = await prisma.user.update({
      where: { id: guru.id },
      data: { password: guruPassword },
    });
  } else {
    guru = await prisma.user.create({
      data: {
        username: 'vinz_guru',
        password: guruPassword,
        role: 'GURU',
        token: 'VINZ1',
      },
    });
  }

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
