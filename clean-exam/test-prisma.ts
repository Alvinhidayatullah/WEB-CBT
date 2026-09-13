import prisma from "./src/lib/prisma";
async function run() {
  try {
    const exams = await prisma.exam.findMany({
      include: { 
        questions: true,
        results: { 
          include: { 
            student: {
              select: { id: true, username: true, className: true }
            } 
          } 
        }
      },
    });
    console.log("SUCCESS", exams.length);
  } catch (e) {
    console.error("ERROR", e.message);
  }
}
run();
