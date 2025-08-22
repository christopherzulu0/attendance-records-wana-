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
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
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
    
    res.status(200).json({ class: transformedClass });
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

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});