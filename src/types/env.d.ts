declare namespace NodeJS {
  interface ProcessEnv {
    // Database
    DATABASE_URL: string
    
    // NextAuth
    NEXTAUTH_SECRET: string
    NEXTAUTH_URL: string
    
    // Stripe Billing
    STRIPE_SECRET_KEY: string
    STRIPE_PUBLISHABLE_KEY: string
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_PRICE_STARTER?: string
    STRIPE_PRICE_PRO?: string
    STRIPE_PRICE_ENTERPRISE?: string
    
    // App
    NEXT_PUBLIC_APP_URL: string
    
    // OpenAI
    OPENAI_API_KEY?: string
  }
}
