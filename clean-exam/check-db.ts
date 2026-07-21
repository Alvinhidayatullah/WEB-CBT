import prisma from "./src/lib/prisma";
async function main() {
  const users = await prisma.user.findMany({ select: { username: true, sessionVersion: true }});
  console.log(users);
}
main();
