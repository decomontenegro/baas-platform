import { PrismaClient } from '@prisma/client'
import { seedTemplates } from './seeds/templates'
import { seedLLMGateway } from './seeds/llm-gateway'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')
  
  // Seed templates
  await seedTemplates(prisma)
  
  // Seed LLM Gateway (providers + VM Deco tenant + Alcateia)
  await seedLLMGateway(prisma)
  
  console.log('✅ Database seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
