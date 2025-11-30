#!/bin/bash
# Convert HEIC images to JPG for web display
# Requires: imagemagick or sips (macOS built-in)

UPLOADS_DIR="./uploads"
SHOES_DIR="./SHOES"

echo "Converting HEIC images to JPG..."

# Function to convert HEIC to JPG using sips (macOS)
convert_heic() {
    local input_file="$1"
    local output_file="${input_file%.*}.jpg"
    
    if command -v sips &> /dev/null; then
        sips -s format jpeg "$input_file" --out "$output_file" &> /dev/null
        if [ $? -eq 0 ]; then
            echo "✓ Converted: $(basename "$input_file") -> $(basename "$output_file")"
            return 0
        fi
    fi
    
    return 1
}

# Convert HEIC files in uploads folder
if [ -d "$UPLOADS_DIR" ]; then
    find "$UPLOADS_DIR" -name "*.HEIC" -o -name "*.heic" | while read file; do
        convert_heic "$file"
        # Optionally remove original HEIC file after conversion
        # rm "$file"
    done
fi

# Convert HEIC files in SHOES folder
if [ -d "$SHOES_DIR" ]; then
    find "$SHOES_DIR" -name "*.HEIC" -o -name "*.heic" | while read file; do
        convert_heic "$file"
    done
fi

echo "Conversion complete!"

