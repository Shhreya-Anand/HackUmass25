#!/bin/bash

# Setup script to copy videos from root videos/ folder to public/videos/
# This allows users to place videos in either location

echo "Setting up video files..."

# Create public/videos directory if it doesn't exist
mkdir -p public/videos

# Copy videos from root videos/ folder to public/videos/ if they exist
if [ -d "videos" ]; then
    echo "Copying videos from videos/ to public/videos/..."
    cp videos/*.mp4 public/videos/ 2>/dev/null || echo "No .mp4 files found in videos/ folder"
    echo "Video setup complete!"
else
    echo "videos/ folder not found. Please add video files to public/videos/ manually."
fi

echo "Expected video files:"
echo "  - public/videos/a.mp4 (Camera A)"
echo "  - public/videos/b.mp4 (Camera B)"
echo "  - public/videos/c.mp4 (Camera C)"
echo "  - public/videos/d.mp4 (Camera D)"

