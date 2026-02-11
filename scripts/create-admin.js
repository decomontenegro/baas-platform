const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createAdmin() {
  const email = 'admin@baas.deco.ooo'
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