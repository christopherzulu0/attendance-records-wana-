const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStudents() {
  try {
    const students = await prisma.student.findMany();
    console.log('Existing students:', JSON.stringify(students, null, 2));
    
    if (students.length === 0) {
      console.log('No students found. Creating sample students...');
      
      // Create sample students
      const sampleStudents = [
        {
          name: 'John Doe',
          email: 'john.doe@student.com',
          registrationNumber: 'STU001'
        },
        {
          name: 'Jane Smith',
          email: 'jane.smith@student.com',
          registrationNumber: 'STU002'
        },
        {
          name: 'Mike Johnson',
          email: 'mike.johnson@student.com',
          registrationNumber: 'STU003'
        }
      ];
      
      for (const student of sampleStudents) {
        await prisma.student.create({ data: student });
        console.log(`Created student: ${student.name}`);
      }
      
      console.log('Sample students created successfully!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStudents();