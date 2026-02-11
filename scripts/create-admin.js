const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

// Set DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db"
}

const prisma = new PrismaClient()

async function createAdmin() {
  // Primeiro tenta gmail.com, depois me.com
  const possibleEmails = ['decomontenegro@gmail.com', 'decomontenegro@me.com']
  
  console.log('Checking for existing user...')
  
  // Procura qual email já existe
  let existingUser = null
  let email = null
  
  for (const testEmail of possibleEmails) {
    const user = await prisma.user.findUnique({
      where: { email: testEmail }
    })
    
    if (user) {
      existingUser = user
      email = testEmail
      console.log(`✅ Found existing user: ${testEmail}`)
      break
    }
  }
  
  if (existingUser) {
    console.log('User already configured - auth should work!')
    return
  }
  
  // Se não achou nenhum, usa gmail.com por padrão
  email = possibleEmails[0]
  const password = 'admin123'
  
  console.log('Creating admin user...')
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      console.log('Admin user already exists!')
      return
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Admin',
        emailVerified: new Date(),
      }
    })
    
    console.log(`✅ Admin user created!`)
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`User ID: ${user.id}`)
    
  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()