#!/bin/bash
set -e

ENV=${1:-development}

echo "📝 Creating environment template for: $ENV"

if [ "$ENV" = "development" ]; then
    if [ ! -f ".env.development" ]; then
        cp ".env.development.example" ".env.development"
        echo "✅ Created .env.development from template"
        echo "💡 Please edit .env.development with your values"
    else
        echo "⚠️  .env.development already exists"
    fi
elif [ "$ENV" = "production" ]; then
    if [ ! -f ".env.production" ]; then
        cp ".env.production.example" ".env.production"
        echo "✅ Created .env.production from template"
        echo "🚨 IMPORTANT: Edit .env.production with SECURE production values"
        echo "🚨 NEVER commit .env.production to version control"
    else
        echo "⚠️  .env.production already exists"
    fi
else
    echo "❌ Invalid environment. Use: development or production"
    exit 1
fi
