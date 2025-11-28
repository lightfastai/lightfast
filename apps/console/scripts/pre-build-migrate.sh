#!/bin/bash

# Pre-Build Migration Script
# Runs database migrations before building the console app
# Ensures schema is up-to-date before code deployment

set -e  # Exit on error

echo "🗃️  Pre-Build Migration Script"
echo "================================"

# Check if we're in production build (need database credentials)
if [ -z "$DATABASE_HOST" ] || [ -z "$DATABASE_USERNAME" ] || [ -z "$DATABASE_PASSWORD" ]; then
  echo "⚠️  Database credentials not set"
  echo "Skipping migrations (likely local development)"
  exit 0
fi

# Check if this is a Vercel production deployment
if [ "$VERCEL_ENV" != "production" ]; then
  echo "📝 Environment: $VERCEL_ENV (not production)"
  echo "Skipping migrations for non-production deployment"
  exit 0
fi

echo "🌍 Environment: Production"
echo "📍 Running migrations for console database..."
echo ""

# Navigate to db/console directory
cd ../../db/console || {
  echo "❌ Failed to navigate to db/console directory"
  exit 1
}

# Check if migrations directory exists
if [ ! -d "src/migrations" ]; then
  echo "✅ No migrations directory found - skipping"
  exit 0
fi

# Check if there are any migration files
MIGRATION_COUNT=$(find src/migrations -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$MIGRATION_COUNT" -eq 0 ]; then
  echo "✅ No migration files found - skipping"
  exit 0
fi

echo "📋 Found $MIGRATION_COUNT migration file(s)"
echo ""

# Run migrations with error handling
echo "🚀 Applying migrations..."
if pnpm db:migrate; then
  echo ""
  echo "✅ Migrations applied successfully!"
else
  echo ""
  echo "❌ Migration failed!"
  echo ""
  echo "This usually means:"
  echo "  1. Database connection issue"
  echo "  2. Migration syntax error"
  echo "  3. Schema conflict"
  echo ""
  echo "Check the error above for details."
  exit 1
fi

echo ""
echo "================================"
echo "✅ Pre-build migration complete"
echo ""
