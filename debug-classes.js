const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugClasses() {
  try {
    console.log('=== DEBUGGING CLASSES AND TEACHERS ===');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    console.log('\n1. All Users:');
    console.log(JSON.stringify(users, null, 2));
    
    // Get all classes with teacher info
    const classes = await prisma.class.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    console.log('\n2. All Classes with Teacher Info:');
    console.log(JSON.stringify(classes, null, 2));
    
    // Check for teachers and their classes
    const teachers = users.filter(user => user.role === 'teacher');
    console.log('\n3. Teachers and their assigned classes:');
    for (const teacher of teachers) {
      const teacherClasses = classes.filter(cls => cls.teacherId === teacher.id);
      console.log(`Teacher: ${teacher.name} (ID: ${teacher.id})`);
      console.log(`  Assigned Classes: ${teacherClasses.length}`);
      teacherClasses.forEach(cls => {
        console.log(`    - ${cls.name} (ID: ${cls.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error debugging classes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugClasses();