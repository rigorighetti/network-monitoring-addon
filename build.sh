#!/bin/bash

set -e

echo "Building Network Monitoring Add-on..."

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run TypeScript compiler
echo "Compiling TypeScript..."
npm run build

# Verify build
if [ ! -d "dist" ]; then
    echo "Error: Build failed - dist directory not created"
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    echo "Error: Build failed - index.js not found"
    exit 1
fi

echo "Build completed successfully!"
echo "Output directory: dist/"
ls -lh dist/
