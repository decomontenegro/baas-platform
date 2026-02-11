import { NextRequest, NextResponse } from 'next/server'
// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes, scryptSync, createCipheriv, createDecipheriv, randomUUID } from 'crypto'

// Credential types for the pool
type CredentialType = 
  | 'OPENAI_API_KEY'
  | 'ANTHROPIC_API_KEY'
  | 'WHATSAPP_TOKEN'
  | 'EVOLUTION_API'
  | 'SMTP'
  | 'WEBHOOK'
  | 'CUSTOM'

interface Credential {
  id: string
  name: string
  type: CredentialType
  value: string // Encrypted
  metadata: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CredentialPool {
  credentials: Credential[]
  version: number
}

// Validation schemas
const createCredentialSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 
    'WHATSAPP_TOKEN',
    'EVOLUTION_API',
    'SMTP',
    'WEBHOOK',
    'CUSTOM'
  ]),
  value: z.string().min(1),
  metadata: z.record(z.any()).optional().default({})
})

const patchCredentialSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean()
})

// Simple encryption helpers (in production, use a proper encryption service)
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-key-change-in-prod'

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)
    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedText // Return as-is if decryption fails (for backwards compat)
  }
}

function maskValue(value: string): string {
  if (value.length <= 8) return '********'
  return value.substring(0, 4) + '****' + value.substring(value.length - 4)
}

function getCredentialPool(settings: any): CredentialPool {
  return settings?.credentialPool || { credentials: [], version: 1 }
}

/**
 * GET /api/admin/credentials
 * List all credentials for the tenant's pool
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true }
    })

    if (!user?.tenantId || !user.Tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const pool = getCredentialPool(user.Tenant.settings)
    
    let credentials = pool.credentials.map((cred: Credential) => ({
      ...cred,
      value: maskValue(decrypt(cred.value)) // Return masked value
    }))

    // Apply filters
    if (type) {
      credentials = credentials.filter((c: Credential) => c.type === type)
    }
    if (activeOnly) {
      credentials = credentials.filter((c: Credential) => c.isActive)
    }

    return NextResponse.json({
      credentials,
      total: credentials.length,
      version: pool.version
    })
  } catch (error) {
    console.error('Error fetching credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/credentials
 * Add a new credential to the pool
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true }
    })

    if (!user?.tenantId || !user.Tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = createCredentialSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, type, value, metadata } = validation.data
    const pool = getCredentialPool(user.Tenant.settings)

    // Check for duplicate names
    if (pool.credentials.some((c: Credential) => c.name === name)) {
      return NextResponse.json(
        { error: 'Credential with this name already exists' },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const newCredential: Credential = {
      id: randomUUID(),
      name,
      type,
      value: encrypt(value),
      metadata,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }

    pool.credentials.push(newCredential)
    pool.version += 1

    // Update tenant settings
    const currentSettings = (user.Tenant.settings as Record<string, any>) || {}
    await prisma.tenant.update({
      where: { id: user.TenantId },
      data: {
        settings: {
          ...currentSettings,
          credentialPool: pool
        }
      }
    })

    return NextResponse.json({
      message: 'Credential created',
      credential: {
        ...newCredential,
        value: maskValue(value) // Return masked value
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating credential:', error)
    return NextResponse.json(
      { error: 'Failed to create credential' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/credentials
 * Activate or deactivate a credential
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true }
    })

    if (!user?.tenantId || !user.Tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = patchCredentialSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { id, isActive } = validation.data
    const pool = getCredentialPool(user.Tenant.settings)

    const credentialIndex = pool.credentials.findIndex((c: Credential) => c.id === id)
    if (credentialIndex === -1) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      )
    }

    pool.credentials[credentialIndex] = {
      ...pool.credentials[credentialIndex],
      isActive,
      updatedAt: new Date().toISOString()
    }
    pool.version += 1

    // Update tenant settings
    const currentSettings = (user.Tenant.settings as Record<string, any>) || {}
    await prisma.tenant.update({
      where: { id: user.TenantId },
      data: {
        settings: {
          ...currentSettings,
          credentialPool: pool
        }
      }
    })

    const updatedCredential = pool.credentials[credentialIndex]

    return NextResponse.json({
      message: `Credential ${isActive ? 'activated' : 'deactivated'}`,
      credential: {
        ...updatedCredential,
        value: maskValue(decrypt(updatedCredential.value))
      }
    })
  } catch (error) {
    console.error('Error updating credential:', error)
    return NextResponse.json(
      { error: 'Failed to update credential' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/credentials
 * Remove a credential from the pool
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { Tenant: true }
    })

    if (!user?.tenantId || !user.Tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Credential ID is required' },
        { status: 400 }
      )
    }

    const pool = getCredentialPool(user.Tenant.settings)

    const credentialIndex = pool.credentials.findIndex((c: Credential) => c.id === id)
    if (credentialIndex === -1) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      )
    }

    const deletedCredential = pool.credentials[credentialIndex]
    pool.credentials.splice(credentialIndex, 1)
    pool.version += 1

    // Update tenant settings
    const currentSettings = (user.Tenant.settings as Record<string, any>) || {}
    await prisma.tenant.update({
      where: { id: user.TenantId },
      data: {
        settings: {
          ...currentSettings,
          credentialPool: pool
        }
      }
    })

    return NextResponse.json({
      message: 'Credential deleted',
      deletedId: id,
      name: deletedCredential.name
    })
  } catch (error) {
    console.error('Error deleting credential:', error)
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    )
  }
}
