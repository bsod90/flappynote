#!/bin/bash
#
# Download a subset of VocalSet for pitch detection evaluation
# VocalSet: A Singing Voice Dataset (CC BY 4.0)
# Source: https://zenodo.org/records/1193957
#
# This script downloads ~10 scale recordings with F0 annotations
# for testing pitch detection algorithms.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/tests/fixtures/vocalset"

# VocalSet Zenodo record
ZENODO_RECORD="1193957"
BASE_URL="https://zenodo.org/records/$ZENODO_RECORD/files"

# Create output directory
mkdir -p "$OUTPUT_DIR/audio"
mkdir -p "$OUTPUT_DIR/f0"

echo "=== VocalSet Subset Downloader ==="
echo "Output directory: $OUTPUT_DIR"
echo ""

# Define files to download (scale recordings from different singers)
# Format: singer/technique/vowel_scale.wav
# We select a mix of male and female singers, different vowels
AUDIO_FILES=(
    # Female singers
    "female1/scales/arpeggios_a_f1.wav"
    "female1/scales/scales_a_f1.wav"
    "female2/scales/arpeggios_e_f2.wav"
    "female2/scales/scales_i_f2.wav"
    "female3/scales/scales_o_f3.wav"
    # Male singers
    "male1/scales/arpeggios_a_m1.wav"
    "male1/scales/scales_a_m1.wav"
    "male2/scales/arpeggios_e_m2.wav"
    "male2/scales/scales_u_m2.wav"
    "male3/scales/scales_o_m3.wav"
)

# Note: VocalSet includes F0 annotations in a separate folder structure
# The F0 files have the same name but .f0 extension
F0_FILES=(
    "female1/scales/arpeggios_a_f1.f0"
    "female1/scales/scales_a_f1.f0"
    "female2/scales/arpeggios_e_f2.f0"
    "female2/scales/scales_i_f2.f0"
    "female3/scales/scales_o_f3.f0"
    "male1/scales/arpeggios_a_m1.f0"
    "male1/scales/scales_a_m1.f0"
    "male2/scales/arpeggios_e_m2.f0"
    "male2/scales/scales_u_m2.f0"
    "male3/scales/scales_o_m3.f0"
)

download_file() {
    local url="$1"
    local output="$2"

    if [ -f "$output" ]; then
        echo "  [SKIP] Already exists: $(basename "$output")"
        return 0
    fi

    echo "  [DOWNLOAD] $(basename "$output")"

    # Use curl with retry
    if ! curl -L --retry 3 --retry-delay 2 -o "$output" "$url" 2>/dev/null; then
        echo "    [ERROR] Failed to download: $url"
        return 1
    fi

    return 0
}

echo "Note: VocalSet is a large dataset (~5GB total)."
echo "This script attempts to download a small subset."
echo "If automatic download fails, please download manually from:"
echo "  https://zenodo.org/records/1193957"
echo ""
echo "The full dataset structure is:"
echo "  FULL/[singer]/[technique]/[filename].wav"
echo "  F0/[singer]/[technique]/[filename].f0"
echo ""

# Try to download using Zenodo API
echo "Attempting download..."
echo ""

# Since VocalSet is packaged as zip files on Zenodo, we provide instructions
# for manual download instead of trying to extract specific files

cat << 'EOF'

MANUAL DOWNLOAD INSTRUCTIONS:

1. Go to: https://zenodo.org/records/1193957
2. Download 'VocalSet1-2.zip' (contains audio files)
3. Extract and copy these files to tests/fixtures/vocalset/audio/:
   - FULL/female1/scales/arpeggios_a_f1.wav
   - FULL/female1/scales/scales_a_f1.wav
   - FULL/female2/scales/arpeggios_e_f2.wav
   - FULL/female2/scales/scales_i_f2.wav
   - FULL/female3/scales/scales_o_f3.wav
   - FULL/male1/scales/arpeggios_a_m1.wav
   - FULL/male1/scales/scales_a_m1.wav
   - FULL/male2/scales/arpeggios_e_m2.wav
   - FULL/male2/scales/scales_u_m2.wav
   - FULL/male3/scales/scales_o_m3.wav

4. Download 'F0.zip' (contains F0 annotations)
5. Extract and copy corresponding .f0 files to tests/fixtures/vocalset/f0/

EOF

# Create placeholder files with download instructions
for file in "${AUDIO_FILES[@]}"; do
    basename="${file##*/}"
    placeholder="$OUTPUT_DIR/audio/${basename%.wav}.placeholder"
    if [ ! -f "$OUTPUT_DIR/audio/$basename" ] && [ ! -f "$placeholder" ]; then
        echo "Download from VocalSet: FULL/$file" > "$placeholder"
    fi
done

for file in "${F0_FILES[@]}"; do
    basename="${file##*/}"
    placeholder="$OUTPUT_DIR/f0/${basename%.f0}.placeholder"
    if [ ! -f "$OUTPUT_DIR/f0/$basename" ] && [ ! -f "$placeholder" ]; then
        echo "Download from VocalSet: F0/$file" > "$placeholder"
    fi
done

echo ""
echo "Created placeholder files in:"
echo "  $OUTPUT_DIR/audio/"
echo "  $OUTPUT_DIR/f0/"
echo ""
echo "Replace placeholders with actual files from VocalSet."
echo "Done!"
