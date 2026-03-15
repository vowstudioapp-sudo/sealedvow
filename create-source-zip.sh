#!/bin/bash

# ─────────────────────────────────────────────────────────────────────
# Create Source Code ZIP Archive
# Generates a clean ZIP of the project source code excluding
# dependencies, build artifacts, and temporary files.
# ─────────────────────────────────────────────────────────────────────

# Generate timestamp in format: YYYY-MM-DD_HH-MM-SS
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# ZIP filename
ZIP_NAME="VOWAPP_CODEBASE_${TIMESTAMP}.zip"

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Creating source code archive...${NC}"

# Create ZIP archive with exclusions
zip -r "$ZIP_NAME" . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x "dist/*" \
  -x "build/*" \
  -x ".next/*" \
  -x "coverage/*" \
  -x ".cache/*" \
  -x ".turbo/*" \
  -x ".vercel/*" \
  -x "out/*" \
  -x "*.log" \
  -x "*.tmp" \
  -x "*.DS_Store" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "**/.DS_Store" \
  -x "$ZIP_NAME" \
  > /dev/null 2>&1

# Check if zip command succeeded
if [ $? -eq 0 ]; then
  # Get file size in human-readable format
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    FILE_SIZE=$(stat -f%z "$ZIP_NAME" 2>/dev/null)
  else
    # Linux
    FILE_SIZE=$(stat -c%s "$ZIP_NAME" 2>/dev/null)
  fi
  
  # Convert bytes to MB
  FILE_SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1024 / 1024" | bc)
  
  echo -e "${GREEN}✓ Archive created successfully!${NC}"
  echo ""
  echo -e "  Filename: ${BLUE}${ZIP_NAME}${NC}"
  echo -e "  Size: ${BLUE}${FILE_SIZE_MB} MB${NC}"
  echo -e "  Location: ${BLUE}$(pwd)/${ZIP_NAME}${NC}"
  echo ""
else
  echo -e "\033[0;31m✗ Error: Failed to create archive${NC}"
  exit 1
fi
