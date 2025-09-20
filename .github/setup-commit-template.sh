#!/bin/bash
# 
# Git Commit Template Setup for CMSNext
# 
# This script configures Git to use our commit message template
# Run this once to set up the template for your local repository
#

# Set the commit template for this repository
git config commit.template .github/commit-template.txt

echo "✅ Git commit template configured!"
echo "📝 Now when you run 'git commit' (without -m), your editor will open with the template"
echo ""
echo "Quick usage:"
echo "  git add ."
echo "  git commit        # Opens editor with template"
echo "  # OR"
echo "  git commit -m \"feat: Your quick message here\""
echo ""
echo "💡 Tip: The template is most useful for complex commits with multiple changes"