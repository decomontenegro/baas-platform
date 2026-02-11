import type { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import EmailProvider from "next-auth/providers/email"
import CredentialsProvider from "next-auth/providers/credentials"
import { Resend } from "resend"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  providers: [
    // Credentials Provider for email/password login
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing credentials")
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          console.log(`[Auth] User not found: ${credentials.email}`)
          return null
        }

        if (!user.password) {
          console.log(`[Auth] User has no password set: ${credentials.email}`)
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          console.log(`[Auth] Invalid password for: ${credentials.email}`)
          return null
        }

        console.log(`[Auth] Successful credentials login: ${credentials.email}`)
        
        // Update lastLoginAt
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      }
    }),
    
    // Email Magic Link Provider
    EmailProvider({
      from: process.env.EMAIL_FROM || "BaaS <onboarding@resend.dev>",
      sendVerificationRequest: async ({ identifier: email, url }) => {
        console.log(`[Auth] Sending magic link to ${email}`)
        console.log(`[Auth] Callback URL: ${url}`)
        
        try {
          const result = await resend.emails.send({
            from: process.env.EMAIL_FROM || "BaaS <onboarding@resend.dev>",
            to: email,
            subject: "Sign in to BaaS Dashboard",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #8b5cf6;">BaaS Dashboard</h2>
                <p>Click the button below to sign in:</p>
                <a href="${url}" style="display: inline-block; background: linear-gradient(to right, #8b5cf6, #d946ef); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
                  Sign in
                </a>
                <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
              </div>
            `,
          })
          console.log(`[Auth] Email sent successfully:`, result)
        } catch (error) {
          console.error("[Auth] Failed to send verification email:", error)
          throw new Error("Failed to send verification email")
        }
      },
    }),
  ],

  // Use JWT for credentials, database for email provider
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      // Always fetch fresh tenantId from database (handles tenant assignment after login)
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tenantId: true }
        })
        token.tenantId = dbUser?.tenantId || null
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
        session.user.tenantId = token.tenantId as string | null
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
    error: "/login",
  },

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Explicit secret
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
}

// Helper to get authenticated session
export async function auth() {
  return getServerSession(authOptions)
}

// Helper to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Helper to verify passwords
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}
