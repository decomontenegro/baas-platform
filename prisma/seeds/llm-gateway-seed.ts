import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Seeding LLM Gateway...')

  // ============================================
  // 1. LLM Providers (Pool)
  // ============================================
  console.log('📦 Creating LLM Providers...')
  
  const providers = await Promise.all([
    prisma.lLMProvider.upsert({
      where: { name: 'max-1' },
      update: {},
      create: {
        name: 'max-1',
        type: 'CLAUDE_MAX',
        model: 'claude-sonnet-4-20250514',
        rateLimit: 60,
        concurrency: 5,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        priority: 1,
        status: 'ACTIVE',
        metadata: {
          description: 'Claude Max Account #1 - Primary',
          subscription: 'max',
          monthlyFee: 20
        }
      }
    }),
    prisma.lLMProvider.upsert({
      where: { name: 'max-2' },
      update: {},
      create: {
        name: 'max-2',
        type: 'CLAUDE_MAX',
        model: 'claude-sonnet-4-20250514',
        rateLimit: 60,
        concurrency: 5,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        priority: 2,
        status: 'ACTIVE',
        metadata: {
          description: 'Claude Max Account #2 - Fallback',
          subscription: 'max',
          monthlyFee: 20
        }
      }
    }),
    prisma.lLMProvider.upsert({
      where: { name: 'api-paid' },
      update: {},
      create: {
        name: 'api-paid',
        type: 'CLAUDE_API',
        model: 'claude-sonnet-4-20250514',
        rateLimit: 1000,
        concurrency: 50,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        priority: 3,
        status: 'ACTIVE',
        metadata: {
          description: 'Claude API - Pay per use (Final Fallback)',
          payPerUse: true
        }
      }
    })
  ])
  
  console.log(`✅ Created ${providers.length} LLM Providers`)

  // ============================================
  // 2. Tenant: VM Deco (First tenant)
  // ============================================
  console.log('🏢 Creating VM Deco tenant...')
  
  const vmDecoTenant = await prisma.tenant.upsert({
    where: { slug: 'vm-example' },
    update: {
      monthlyBudget: 500, // $500/mês
      dailyLimit: 50,     // $50/dia
      alertThresholds: [0.2, 0.1, 0.05, 0.01]
    },
    create: {
      name: 'VM Deco (Pessoal)',
      slug: 'vm-example',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      monthlyBudget: 500,
      dailyLimit: 50,
      alertThresholds: [0.2, 0.1, 0.05, 0.01],
      settings: {
        description: 'VM pessoal do Deco - primeiro tenant do BaaS',
        owner: 'Deco Montenegro',
        clawdbotInstance: true
      }
    }
  })
  
  console.log(`✅ Created tenant: ${vmDecoTenant.name}`)

  // ============================================
  // 3. Alcateia - 10 Agents
  // ============================================
  console.log('🐺 Creating Alcateia agents...')
  
  const alcateia = [
    {
      name: 'Lobo',
      role: 'coordinator',
      description: 'Coordenador da alcateia - orquestra os outros agentes',
      avatar: '🐺'
    },
    {
      name: 'Águia',
      role: 'analytics',
      description: 'Analytics & Relatórios - visão panorâmica, enxerga padrões',
      avatar: '🦅'
    },
    {
      name: 'Coruja',
      role: 'code_review',
      description: 'Code Review - sábia, detalhista, vê no escuro (bugs)',
      avatar: '🦉'
    },
    {
      name: 'Raposa',
      role: 'research',
      description: 'Research & Investigação - esperta, investigativa',
      avatar: '🦊'
    },
    {
      name: 'Falcão',
      role: 'devops',
      description: 'DevOps & Monitoramento - vigilante, visão afiada',
      avatar: '🦅'
    },
    {
      name: 'Golfinho',
      role: 'support',
      description: 'Suporte ao Cliente - comunicativo, amigável',
      avatar: '🐬'
    },
    {
      name: 'Pantera',
      role: 'security',
      description: 'Segurança & Compliance - ágil, precisa',
      avatar: '🐆'
    },
    {
      name: 'Castor',
      role: 'documentation',
      description: 'Documentação & Knowledge Base - construtor metódico',
      avatar: '🦫'
    },
    {
      name: 'Cão',
      role: 'qa',
      description: 'QA & Testes - leal, persistente, farejador de bugs',
      avatar: '🐕'
    },
    {
      name: 'Arara',
      role: 'marketing',
      description: 'Marketing & Comunicação - colorida, comunicativa',
      avatar: '🦜'
    }
  ]
  
  const agents = await Promise.all(
    alcateia.map(agent =>
      prisma.tenantAgent.upsert({
        where: {
          tenantId_name: {
            tenantId: vmDecoTenant.id,
            name: agent.name
          }
        },
        update: {},
        create: {
          tenantId: vmDecoTenant.id,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          avatar: agent.avatar,
          preferredModel: 'claude-sonnet-4-20250514',
          active: true,
          metadata: {
            alcateia: true,
            createdBy: 'seed'
          }
        }
      })
    )
  )
  
  console.log(`✅ Created ${agents.length} agents for Alcateia:`)
  agents.forEach(a => console.log(`   ${a.avatar || '🤖'} ${a.name} (${a.role})`))

  // ============================================
  // Summary
  // ============================================
  console.log('\n📊 Seed Summary:')
  console.log(`   - LLM Providers: ${providers.length}`)
  console.log(`   - Tenants: 1 (VM Deco)`)
  console.log(`   - Agents: ${agents.length} (Alcateia)`)
  console.log('\n✅ LLM Gateway seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
