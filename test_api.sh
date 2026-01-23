#!/bin/bash
# Test script for Gemini API

curl -X POST http://localhost:3000/api/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash-exp",
    "prompt": "Analyze this video for factual accuracy. Provide JSON with: summary, overallAssessment, factualClaims.",
    "videoUrl": "https://www.youtube.com/watch?v=cARN7f8d2IU"
  }' \
  | jq '.'
