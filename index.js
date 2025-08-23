const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Signup endpoint
app.post('/api/signup', async (req, res) => {
  console.log('Signup request body:', req.body);
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create user
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });
    // Exclude password from response
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  console.log('Login request body:', req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      console.log('Backend - Login successful for user:', JSON.stringify(userData, null, 2));
      res.status(200).json({ user: userData });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  const { name, email, password, role = 'teacher' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create user
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Check if email is already taken by another user
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }
    // Update user
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Delete user
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all classes
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        classStudents: {
          include: {
            student: true
          }
        }
      }
    });
    
    console.log('Backend - Raw classes from database:', JSON.stringify(classes, null, 2));
    
    // Transform data to match frontend expectations
    const transformedClasses = classes.map(cls => ({
      id: cls.id.toString(),
      name: cls.name,
      section: cls.section || '',
      subject: cls.subject || '',
      description: cls.description || '',
      schedule: cls.schedule || '',
      room: cls.room || '',
      teacherId: cls.teacherId?.toString() || '',
      teacherName: cls.teacher?.name || 'Unassigned',
      totalStudents: cls.classStudents.length,
      createdAt: cls.createdAt
    }));
    
    res.status(200).json({ classes: transformedClasses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get class by ID
app.get('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cls = await prisma.class.findUnique({
      where: { id: parseInt(id) },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        classStudents: {
          include: {
            student: true
          }
        }
      }
    });
    
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const transformedClass = {
      id: cls.id.toString(),
      name: cls.name,
      section: cls.section || '',
      subject: cls.subject || '',
      description: cls.description || '',
      schedule: cls.schedule || '',
      room: cls.room || '',
      teacherId: cls.teacherId?.toString() || '',
      teacherName: cls.teacher?.name || 'Unassigned',
      totalStudents: cls.classStudents.length,
      createdAt: cls.createdAt
    };
    
    // Transform students data
    const students = cls.classStudents.map(cs => ({
      id: cs.student.id.toString(),
      name: cs.student.name,
      email: cs.student.email,
      studentId: cs.student.studentId,
      createdAt: cs.student.createdAt
    }));
    
    res.status(200).json({ class: transformedClass, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new class
app.post('/api/classes', async (req, res) => {
  const { name, section, subject, description, schedule, room, teacherId } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Class name is required' });
  }
  
  try {
    // Validate teacher exists if teacherId is provided
    if (teacherId) {
      const teacher = await prisma.user.findUnique({ 
        where: { id: parseInt(teacherId) } 
      });
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }
    
    const cls = await prisma.class.create({
      data: {
        name,
        section: section || null,
        subject: subject || null,
        description: description || null,
        schedule: schedule || null,
        room: room || null,
        teacherId: teacherId ? parseInt(teacherId) : null
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        classStudents: {
          include: {
            student: true
          }
        }
      }
    });
    
    const transformedClass = {
      id: cls.id.toString(),
      name: cls.name,
      section: cls.section || '',
      subject: cls.subject || '',
      description: cls.description || '',
      schedule: cls.schedule || '',
      room: cls.room || '',
      teacherId: cls.teacherId?.toString() || '',
      teacherName: cls.teacher?.name || 'Unassigned',
      totalStudents: cls.classStudents.length,
      createdAt: cls.createdAt
    };
    
    res.status(201).json({ class: transformedClass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update class
app.put('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  const { name, section, subject, description, schedule, room, teacherId } = req.body;
  
  console.log('PUT /api/classes/:id request:');
  console.log('ID:', id);
  console.log('Request body:', req.body);
  console.log('Room value:', room);
  
  try {
    // Check if class exists
    const existingClass = await prisma.class.findUnique({ 
      where: { id: parseInt(id) } 
    });
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Validate teacher exists if teacherId is provided
    if (teacherId) {
      const teacher = await prisma.user.findUnique({ 
        where: { id: parseInt(teacherId) } 
      });
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }
    
    const cls = await prisma.class.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(section !== undefined && { section: section || null }),
        ...(subject !== undefined && { subject: subject || null }),
        ...(description !== undefined && { description: description || null }),
        ...(schedule !== undefined && { schedule: schedule || null }),
        ...(room !== undefined && { room: room || null }),
        ...(teacherId !== undefined && { teacherId: teacherId ? parseInt(teacherId) : null })
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        classStudents: {
          include: {
            student: true
          }
        }
      }
    });
    
    const transformedClass = {
      id: cls.id.toString(),
      name: cls.name,
      section: cls.section || '',
      subject: cls.subject || '',
      description: cls.description || '',
      schedule: cls.schedule || '',
      room: cls.room || '',
      teacherId: cls.teacherId?.toString() || '',
      teacherName: cls.teacher?.name || 'Unassigned',
      totalStudents: cls.classStudents.length,
      createdAt: cls.createdAt
    };
    
    res.status(200).json({ class: transformedClass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete class
app.delete('/api/classes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if class exists
    const existingClass = await prisma.class.findUnique({ 
      where: { id: parseInt(id) } 
    });
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Delete class (this will cascade delete related records)
    await prisma.class.delete({ where: { id: parseInt(id) } });
    
    res.status(200).json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enroll student in class
app.post('/api/classes/:id/enroll', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;
  
  try {
    // Check if class exists
    const existingClass = await prisma.class.findUnique({ 
      where: { id: parseInt(id) } 
    });
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if student exists
    const existingStudent = await prisma.student.findUnique({ 
      where: { id: parseInt(studentId) } 
    });
    if (!existingStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Check if student is already enrolled
    const existingEnrollment = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: {
          classId: parseInt(id),
          studentId: parseInt(studentId)
        }
      }
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Student is already enrolled in this class' });
    }
    
    // Create enrollment
    const enrollment = await prisma.classStudent.create({
      data: {
        classId: parseInt(id),
        studentId: parseInt(studentId)
      },
      include: {
        class: true,
        student: true
      }
    });
    
    res.status(201).json({ 
      message: 'Student enrolled successfully',
      enrollment: {
        id: enrollment.id,
        classId: enrollment.classId.toString(),
        studentId: enrollment.studentId.toString(),
        enrolledAt: enrollment.enrolledAt,
        className: enrollment.class.name,
        studentName: enrollment.student.name
      }
    });
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unenroll student from class
app.delete('/api/classes/:id/unenroll', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;
  
  try {
    // Check if enrollment exists
    const existingEnrollment = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: {
          classId: parseInt(id),
          studentId: parseInt(studentId)
        }
      }
    });
    
    if (!existingEnrollment) {
      return res.status(404).json({ error: 'Student is not enrolled in this class' });
    }
    
    // Delete enrollment
    await prisma.classStudent.delete({
      where: {
        classId_studentId: {
          classId: parseInt(id),
          studentId: parseInt(studentId)
        }
      }
    });
    
    res.status(200).json({ message: 'Student unenrolled successfully' });
  } catch (err) {
    console.error('Unenrollment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student's enrolled classes
app.get('/api/students/:id/classes', async (req, res) => {
  const { id } = req.params;
  
  try {
    const enrollments = await prisma.classStudent.findMany({
      where: { studentId: parseInt(id) },
      include: {
        class: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });
    
    const classes = enrollments.map(enrollment => ({
      id: enrollment.class.id.toString(),
      name: enrollment.class.name,
      section: enrollment.class.section || '',
      subject: enrollment.class.subject || '',
      description: enrollment.class.description || '',
      schedule: enrollment.class.schedule || '',
      room: enrollment.class.room || '',
      teacherId: enrollment.class.teacherId?.toString() || '',
      teacherName: enrollment.class.teacher?.name || 'Unassigned',
      enrolledAt: enrollment.enrolledAt,
      createdAt: enrollment.class.createdAt
    }));
    
    res.status(200).json({ classes });
  } catch (err) {
    console.error('Get student classes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        _count: {
          select: {
            classStudents: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const formattedStudents = students.map(student => ({
      id: student.id.toString(),
      name: student.name,
      email: student.email,
      registrationNumber: student.registrationNumber,
      password: student.password, // Include password for admin reference
      userId: student.userId?.toString(),
      userEmail: student.user?.email,
      hasAccount: !!student.user,
      enrolledClassesCount: student._count.classStudents,
      createdAt: student.createdAt
    }));
    
    res.json(formattedStudents);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student by user ID
app.get('/api/students/by-user/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const student = await prisma.student.findUnique({
      where: { userId: parseInt(userId) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found for this user' });
    }
    
    const formattedStudent = {
      id: student.id.toString(),
      name: student.name,
      email: student.email,
      registrationNumber: student.registrationNumber,
      userId: student.userId?.toString(),
      userEmail: student.user?.email,
      hasAccount: !!student.user,
      createdAt: student.createdAt
    };
    
    res.json({ student: formattedStudent });
  } catch (err) {
    console.error('Error fetching student by user ID:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new student
app.post('/api/students', async (req, res) => {
  const { name, email, registrationNumber, createAccount, password, generatedPassword } = req.body;
  
  try {
    let userId = null;
    
    // If createAccount is true, create a user account for the student
    if (createAccount && email && (password || generatedPassword)) {
      const passwordToUse = generatedPassword || password;
      const hashedPassword = await bcrypt.hash(passwordToUse, 10);
      
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'student'
        }
      });
      
      userId = user.id;
    }
    
    const student = await prisma.student.create({
      data: {
        name,
        email,
        registrationNumber,
        password: generatedPassword || password, // Store the password for admin reference
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    const formattedStudent = {
      id: student.id.toString(),
      name: student.name,
      email: student.email,
      registrationNumber: student.registrationNumber,
      password: student.password, // Include password for admin reference
      userId: student.userId?.toString(),
      userEmail: student.user?.email,
      hasAccount: !!student.user,
      createdAt: student.createdAt
    };
    
    res.status(201).json(formattedStudent);
  } catch (err) {
    console.error('Error creating student:', err);
    if (err.code === 'P2002') {
      res.status(400).json({ error: 'Email or registration number already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update a student
app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, registrationNumber, createAccount, password } = req.body;
  
  try {
    const existingStudent = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });
    
    if (!existingStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    let userId = existingStudent.userId;
    
    // If createAccount is true and student doesn't have an account, create one
    if (createAccount && !existingStudent.user && email && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'student'
        }
      });
      
      userId = user.id;
    } else if (existingStudent.user) {
      // Update existing user account
      await prisma.user.update({
        where: { id: existingStudent.userId },
        data: {
          name,
          email: email || existingStudent.user.email
        }
      });
    }
    
    const student = await prisma.student.update({
      where: { id: parseInt(id) },
      data: {
        name,
        email,
        registrationNumber,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    const formattedStudent = {
      id: student.id.toString(),
      name: student.name,
      email: student.email,
      registrationNumber: student.registrationNumber,
      userId: student.userId?.toString(),
      userEmail: student.user?.email,
      hasAccount: !!student.user,
      createdAt: student.createdAt
    };
    
    res.json(formattedStudent);
  } catch (err) {
    console.error('Error updating student:', err);
    if (err.code === 'P2002') {
      res.status(400).json({ error: 'Email or registration number already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete a student
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: { user: true }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Delete student record (this will cascade to ClassStudent records)
    await prisma.student.delete({
      where: { id: parseInt(id) }
    });
    
    // If student has a user account, delete it too
    if (student.userId) {
      await prisma.user.delete({
        where: { id: student.userId }
      });
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student attendance records
app.get('/api/students/:id/attendance', async (req, res) => {
  const { id } = req.params;
  
  try {
    // First, find the student by user ID
    const student = await prisma.student.findFirst({
      where: {
        userId: parseInt(id)
      }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Get attendance records for this student
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        studentId: student.id
      },
      include: {
        class: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    const formattedRecords = attendanceRecords.map(record => ({
      id: record.id.toString(),
      date: record.date,
      status: record.status,
      class: {
        name: record.class.name
      }
    }));
    
    res.json(formattedRecords);
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link existing user to student record
app.post('/api/students/:studentId/link-user/:userId', async (req, res) => {
  const { studentId, userId } = req.params;
  
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if student exists
    const existingStudent = await prisma.student.findUnique({
      where: { id: parseInt(studentId) }
    });
    
    if (!existingStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Update student record to link with user
    const student = await prisma.student.update({
      where: { id: parseInt(studentId) },
      data: {
        userId: parseInt(userId)
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    const formattedStudent = {
      id: student.id.toString(),
      name: student.name,
      email: student.email,
      registrationNumber: student.registrationNumber,
      userId: student.userId?.toString(),
      userEmail: student.user?.email,
      hasAccount: !!student.user,
      createdAt: student.createdAt
    };
    
    res.json({ message: 'Student linked to user successfully', student: formattedStudent });
  } catch (err) {
    console.error('Error linking student to user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});