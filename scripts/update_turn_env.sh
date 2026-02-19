#!/bin/bash

# Function to add env var to all environments
add_env() {
    local key=$1
    local value=$2
    echo "Adding $key to production..."
    echo -n "$value" | npx vercel env add "$key" production
    echo "Adding $key to preview..."
    echo -n "$value" | npx vercel env add "$key" preview
    echo "Adding $key to development..."
    echo -n "$value" | npx vercel env add "$key" development
}

# Remove old Metered vars
npx vercel env rm VITE_METERED_DOMAIN production -y || true
npx vercel env rm VITE_METERED_API_KEY production -y || true

# Add ExpressTURN vars
add_env "VITE_TURN_URL" "turn:free.expressturn.com:3478"
add_env "VITE_TURN_USERNAME" "000000002086496644"
add_env "VITE_TURN_CREDENTIAL" "gZNVgI2y/JmBF0e2IuZOR4I20EE="

echo "Done updating environment variables."
