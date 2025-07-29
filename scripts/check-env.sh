#!/bin/bash
set -e

ENV=${1:-development}
ENV_FILE=".env.${ENV}"

echo "🔍 Checking environment configuration for: $ENV"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "💡 Copy from .env.${ENV}.example and fill in your values"
    exit 1
fi

# Source the environment file
set -a
source "$ENV_FILE"
set +a

# Required variables
REQUIRED_VARS=""
if [ "$ENV" = "development" ]; then
    REQUIRED_VARS="DATABASE_URL REDIS_URL CLERK_SECRET_KEY JWT_SECRET API_PORT"
elif [ "$ENV" = "production" ]; then
    REQUIRED_VARS="DATABASE_URL REDIS_URL CLERK_SECRET_KEY JWT_SECRET API_PORT POSTGRES_PASSWORD REDIS_PASSWORD"
fi

# Check required variables
missing_vars=""
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        missing_vars="$missing_vars $var"
    fi
done

if [ -n "$missing_vars" ]; then
    echo "❌ Missing required environment variables:"
    for var in $missing_vars; do
        echo "   • $var"
    done
    exit 1
fi

# Validate specific formats
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
    echo "❌ DATABASE_URL must start with postgresql://"
    exit 1
fi

if [[ ! "$REDIS_URL" =~ ^redis:// ]]; then
    echo "❌ REDIS_URL must start with redis://"
    exit 1
fi

echo "✅ Environment configuration is valid!"
