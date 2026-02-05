-- =============================================================================
-- BaaS Dashboard - Database Initialization Script
-- This script runs when PostgreSQL container is first created
-- =============================================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Grant privileges (the main database is created by POSTGRES_DB env var)
-- This is for any additional setup needed
