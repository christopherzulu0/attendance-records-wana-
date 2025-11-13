const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for base64 images

/**
 * Get the Python command to use (prefers virtual environment if available)
 */
function getPythonCommand() {
  const isWindows = os.platform() === 'win32';
  const backendDir = __dirname;
  
  // Check for virtual environment
  if (isWindows) {
    const venvPython = path.join(backendDir, 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPython)) {
      return { command: venvPython, args: ['face_recognition_service.py'] };
    }
    // Fallback to Windows Python launcher
    return { command: 'py', args: ['-3.11', 'face_recognition_service.py'] };
  } else {
    // Linux/Mac - check for venv
    const venvPython = path.join(backendDir, 'venv', 'bin', 'python3');
    if (fs.existsSync(venvPython)) {
      return { command: venvPython, args: ['face_recognition_service.py'] };
    }
    // Fallback to system python3
    return { command: 'python3', args: ['face_recognition_service.py'] };
  }
}

/**
 * Call Python face recognition service
 * Uses stdin to pass large data instead of command-line args
 */
function callPythonFaceRecognition(command, data) {
  return new Promise((resolve, reject) => {
    const { command: pythonCommand, args } = getPythonCommand();
    const pythonArgs = [...args, command];
    
    console.log(`Using Python: ${pythonCommand} ${pythonArgs.join(' ')}`);
    
    const python = spawn(pythonCommand, pythonArgs, {
      cwd: __dirname // Ensure we're in the backend directory
    });
    
    let stdout = '';
    let stderr = '';
    let hasResolved = false;
    
    // Handle stdin errors gracefully (EPIPE is expected if process exits early)
    python.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') {
        console.error('Stdin error (non-EPIPE):', err);
      }
      // Don't reject here, let the process handle it
    });
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      const errorText = data.toString();
      stderr += errorText;
      console.error('Python stderr:', errorText);
    });
    
    python.on('close', (code) => {
      if (hasResolved) return;
      
      if (code !== 0) {
        console.error('Python process exited with code:', code);
        console.error('Python stderr output:', stderr);
        reject(new Error(stderr || `Python process failed with code ${code}`));
      } else {
        try {
          if (!stdout) {
            reject(new Error('Python process returned no output. Check stderr for errors.'));
            return;
          }
          const result = JSON.parse(stdout);
          resolve(result);
          hasResolved = true;
        } catch (e) {
          console.error('Failed to parse Python output:', stdout);
          console.error('Parse error:', e.message);
          reject(new Error(`Failed to parse Python output: ${e.message}. Output: ${stdout.substring(0, 200)}`));
        }
      }
    });
    
    python.on('error', (err) => {
      if (hasResolved) return;
      console.error('Failed to start Python process:', err);
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
    
    // Send data via stdin for large payloads
    // Wait a bit to ensure process is ready, then write
    if (data) {
      const writeData = () => {
        try {
          const jsonData = JSON.stringify(data);
          
          // Check if stdin is still writable
          if (python.stdin.destroyed || python.stdin.closed) {
            console.warn('Python stdin is already closed, cannot write data');
            return;
          }
          
          // Write data
          const writeSuccess = python.stdin.write(jsonData, 'utf8');
          
          if (!writeSuccess) {
            // If write buffer is full, wait for drain
            python.stdin.once('drain', () => {
              python.stdin.end();
            });
          } else {
            // All data written, close stdin
            python.stdin.end();
          }
        } catch (err) {
          // EPIPE errors are expected if process exits early, ignore them
          if (err.code !== 'EPIPE') {
            console.error('Error sending data to Python:', err);
          }
          // Try to end stdin anyway
          try {
            if (!python.stdin.destroyed && !python.stdin.closed) {
              python.stdin.end();
            }
          } catch (e) {
            // Ignore errors when ending
          }
        }
      };
      
      // Wait a bit to ensure process is ready
      if (python.stdin.writable) {
        // Use setImmediate to ensure process has started
        setImmediate(writeData);
      } else {
        setTimeout(writeData, 100);
      }
    }
  });
}

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
    
    // Convert IDs to strings for consistency with frontend
    const formattedUsers = users.map(user => ({
      ...user,
      id: user.id.toString()
    }));
    
    res.status(200).json({ users: formattedUsers });
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
    
    // Convert ID to string for consistency with frontend
    const formattedUser = {
      ...user,
      id: user.id.toString()
    };
    
    res.status(200).json({ user: formattedUser });
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
    
    // Convert ID to string for consistency with frontend
    const formattedUser = {
      ...user,
      id: user.id.toString()
    };
    
    res.status(201).json({ user: formattedUser });
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
    
    // Convert ID to string for consistency with frontend
    const formattedUser = {
      ...user,
      id: user.id.toString()
    };
    
    res.status(200).json({ user: formattedUser });
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

// Face enrollment endpoint - Uses Python for REAL face recognition
app.post('/api/students/:id/enroll-face', async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('FACE ENROLLMENT REQUEST RECEIVED!!!');
    console.log('Student ID:', req.params.id);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Has base64Image:', !!req.body.base64Image);
    console.log('Has faceEncoding:', !!req.body.faceEncoding);
    console.log('========================================');
    console.log('');
    
    const studentId = parseInt(req.params.id);
    const { base64Image } = req.body;

    if (!base64Image) {
      console.log('ERROR: base64Image not found in request body');
      return res.status(400).json({ error: 'Face image (base64) is required' });
    }

    console.log('Calling Python face recognition service...');

    // Call Python face recognition service to generate encoding
    // Pass data via stdin instead of command-line args
    const pythonResult = await callPythonFaceRecognition('encode', { image: base64Image });
    
    if (!pythonResult.success) {
      console.log('Python face detection failed:', pythonResult.error);
      return res.status(400).json({ error: pythonResult.error || 'Face detection failed' });
    }

    console.log('Face encoding generated successfully via Python');

    // Store the face encoding
    const faceEncodingJson = JSON.stringify({
      encoding: pythonResult.encoding,
      timestamp: Date.now(),
      version: '1.0_python',
      face_location: pythonResult.face_location
    });

    // Update student with face encoding
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        faceEncoding: faceEncodingJson,
        faceEnrolled: true
      }
    });

    res.json({ 
      message: 'Face enrollment completed successfully using deep learning',
      student: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        faceEnrolled: updatedStudent.faceEnrolled
      },
      confidence: pythonResult.confidence,
      face_location: pythonResult.face_location
    });
  } catch (err) {
    console.error('Error enrolling face:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Get student attendance history
app.get('/api/students/:id/attendance', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    console.log(`Fetching attendance for student ${studentId}, month: ${month}, year: ${year}`);

    // Get attendance records for the student in the specified month/year
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const attendance = await prisma.attendance.findMany({
      where: {
        studentId: studentId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'desc'
      },
      include: {
        class: {
          select: {
            name: true,
            section: true
          }
        }
      }
    });

    res.json({
      attendance: attendance.map(record => ({
        id: record.id.toString(),
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        method: record.method,
        classId: record.classId.toString(),
        className: record.class.name,
        section: record.class.section
      }))
    });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Face enrollment status endpoint
app.get('/api/students/:id/face-status', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        faceEnrolled: true,
        faceEncoding: false // Don't return the actual encoding for security
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ 
      student: {
        id: student.id,
        name: student.name,
        faceEnrolled: student.faceEnrolled
      }
    });
  } catch (err) {
    console.error('Error getting face status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Face recognition attendance endpoint - Uses Python for REAL face verification  
app.post('/api/attendance/face-recognition', async (req, res) => {
  try {
    console.log('');
    console.log('========================================');
    console.log('FACE RECOGNITION ATTENDANCE REQUEST');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('studentId:', req.body.studentId, 'Type:', typeof req.body.studentId);
    console.log('classId:', req.body.classId, 'Type:', typeof req.body.classId);
    console.log('base64Image length:', req.body.base64Image?.length || 0);
    console.log('========================================');
    console.log('');
    
    const { studentId, classId, base64Image } = req.body;

    if (!studentId || !classId || !base64Image) {
      console.log('ERROR: Missing required fields');
      console.log('studentId:', !!studentId, 'classId:', !!classId, 'base64Image:', !!base64Image);
      return res.status(400).json({ error: 'Student ID, class ID, and face image are required' });
    }

    // Get student and verify face enrollment
    const student = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      select: {
        id: true,
        name: true,
        faceEnrolled: true,
        faceEncoding: true
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!student.faceEnrolled || !student.faceEncoding) {
      return res.status(400).json({ error: 'Student has not enrolled their face. Please enroll first.' });
    }

    console.log('Generating encoding for captured face via Python...');
    
    // Generate encoding from captured image using Python
    const capturedResult = await callPythonFaceRecognition('encode', { image: base64Image });
    
    if (!capturedResult.success) {
      console.log('Failed to detect face:', capturedResult.error);
      return res.status(400).json({ error: capturedResult.error || 'Could not detect face in image' });
    }

    console.log('Comparing with enrolled face via Python...');
    
    // Get stored encoding
    const storedData = JSON.parse(student.faceEncoding);
    const storedEncoding = storedData.encoding;
    
    // Compare faces using Python's face_recognition library with STRICT tolerance
    // tolerance: 0.5 = strict (recommended for attendance)
    //            0.4 = very strict (may reject some valid matches)
    //            0.6 = default (may accept some invalid matches)
    const comparisonResult = await callPythonFaceRecognition('compare', {
      encoding1: storedEncoding,
      encoding2: capturedResult.encoding,
      tolerance: 0.5  // STRICT matching for security
    });

    console.log(`Face match: ${comparisonResult.match}, distance: ${comparisonResult.distance?.toFixed(3)}, threshold: ${comparisonResult.threshold}, quality: ${comparisonResult.quality}`);

    if (!comparisonResult.match) {
      return res.status(401).json({ 
        error: `Face not recognized. Identity does not match enrolled face.`,
        details: `Similarity: ${Math.round(comparisonResult.similarity * 100)}%, Distance: ${comparisonResult.distance?.toFixed(3)}, Quality: ${comparisonResult.quality}`,
        similarity: Math.round(comparisonResult.similarity * 100),
        distance: comparisonResult.distance,
        threshold: Math.round(comparisonResult.threshold * 100),
        quality: comparisonResult.quality,
        match: false
      });
    }

    console.log('Face verified successfully! Marking attendance...');

    // Check if attendance already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        studentId: parseInt(studentId),
        classId: parseInt(classId),
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    if (existingAttendance) {
      // Update existing attendance
      const updatedAttendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: 'present',
          method: 'face_recognition',
          markedAt: new Date()
        }
      });

      return res.json({
        message: 'Attendance updated successfully via face recognition',
        attendance: updatedAttendance,
        similarity: Math.round(comparisonResult.similarity * 100),
        verified: true
      });
    } else {
      // Create new attendance record
      const newAttendance = await prisma.attendance.create({
        data: {
          studentId: parseInt(studentId),
          classId: parseInt(classId),
          date: new Date(),
          status: 'present',
          method: 'face_recognition',
          markedAt: new Date()
        }
      });

      return res.json({
        message: 'Attendance marked successfully via face recognition',
        attendance: newAttendance,
        similarity: Math.round(comparisonResult.similarity * 100),
        verified: true
      });
    }
  } catch (err) {
    console.error('Error marking attendance via face recognition:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Mark attendance manually (for teachers)
app.post('/api/attendance/mark', async (req, res) => {
  try {
    const { studentId, classId, date, status, markedById } = req.body;

    if (!studentId || !classId || !date || !status) {
      return res.status(400).json({ error: 'Student ID, class ID, date, and status are required' });
    }

    // Validate status
    if (!['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be present, absent, or late' });
    }

    // Parse date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Check if attendance already exists
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        studentId: parseInt(studentId),
        classId: parseInt(classId),
        date: {
          gte: attendanceDate,
          lt: nextDay
        }
      }
    });

    if (existingAttendance) {
      // Update existing attendance
      const updatedAttendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: status,
          method: 'manual',
          markedById: markedById ? parseInt(markedById) : null,
          markedAt: new Date()
        }
      });

      return res.json({
        message: 'Attendance updated successfully',
        attendance: {
          id: updatedAttendance.id.toString(),
          studentId: updatedAttendance.studentId.toString(),
          classId: updatedAttendance.classId.toString(),
          date: updatedAttendance.date.toISOString().split('T')[0],
          status: updatedAttendance.status,
          method: updatedAttendance.method
        }
      });
    } else {
      // Create new attendance record
      const newAttendance = await prisma.attendance.create({
        data: {
          studentId: parseInt(studentId),
          classId: parseInt(classId),
          date: attendanceDate,
          status: status,
          method: 'manual',
          markedById: markedById ? parseInt(markedById) : null,
          markedAt: new Date()
        }
      });

      return res.json({
        message: 'Attendance marked successfully',
        attendance: {
          id: newAttendance.id.toString(),
          studentId: newAttendance.studentId.toString(),
          classId: newAttendance.classId.toString(),
          date: newAttendance.date.toISOString().split('T')[0],
          status: newAttendance.status,
          method: newAttendance.method
        }
      });
    }
  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Get attendance for a class on a specific date
app.get('/api/classes/:classId/attendance/:date', async (req, res) => {
  try {
    const { classId, date } = req.params;

    // Parse date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(attendanceDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all attendance records for this class on this date
    const attendance = await prisma.attendance.findMany({
      where: {
        classId: parseInt(classId),
        date: {
          gte: attendanceDate,
          lt: nextDay
        }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registrationNumber: true
          }
        }
      },
      orderBy: {
        student: {
          name: 'asc'
        }
      }
    });

    res.json({
      attendance: attendance.map(record => ({
        id: record.id.toString(),
        studentId: record.studentId.toString(),
        classId: record.classId.toString(),
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        method: record.method,
        student: {
          id: record.student.id.toString(),
          name: record.student.name,
          email: record.student.email,
          registrationNumber: record.student.registrationNumber
        }
      }))
    });
  } catch (err) {
    console.error('Error fetching class attendance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});