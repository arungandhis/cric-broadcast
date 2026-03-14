#!/bin/bash
set -e

REPO_URL="https://github.com/arungandhis/cric-broadcast.git"

git init
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO_URL"
git add .
git commit -m "Upload from Codespaces"
git branch -M main
git pull origin main --allow-unrelated-histories
git push -u origin main --force

echo "🎉 Upload complete!"