#!/bin/bash
# Download spaCy language model for PHI detection
# This script ensures the model is available before the server starts

echo "🔄 Checking spaCy language model for PHI detection..."

if python3 -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null; then
    echo "✅ spaCy model 'en_core_web_sm' already installed"
else
    echo "📥 Downloading spaCy model 'en_core_web_sm'..."
    python3 -m spacy download en_core_web_sm
    echo "✅ spaCy model downloaded successfully"
fi
