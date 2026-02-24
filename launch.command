#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "------------------------------------------"
echo "🚀 Launching Gemini Playground..."
echo "------------------------------------------"

# Check if node_modules exists, if not, install them
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies (this may take a minute)..."
    npm install
fi

# Run the development server and open the browser
echo "✨ Starting dev server..."
npm run dev -- --open
