/**
 * Example 07: Media Processing
 * Demonstrates audio/video manipulation, image processing, and metadata extraction
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function mediaProcessingExamples() {
	const executor = new SandboxExecutor();

	console.log("🎬 Media Processing Examples\n");

	// Example 1: Install media processing tools
	console.log("1. Installing media processing tools:");

	// Install ffmpeg
	console.log("   Installing ffmpeg...");
	const ffmpegInstall = await executor.runCommand("dnf", ["install", "-y", "ffmpeg"]);
	if (ffmpegInstall.success) {
		console.log("   ✅ ffmpeg installed successfully");
	}

	// Install ImageMagick
	console.log("   Installing ImageMagick...");
	const imagemagickInstall = await executor.runCommand("dnf", ["install", "-y", "ImageMagick"]);
	if (imagemagickInstall.success) {
		console.log("   ✅ ImageMagick installed successfully");
	}

	// Check versions
	const ffmpegVersion = await executor.runCommand("ffmpeg", ["-version"]);
	console.log("   FFmpeg version:", ffmpegVersion.stdout.split("\n")[0]);

	const convertVersion = await executor.runCommand("convert", ["--version"]);
	console.log("   ImageMagick version:", convertVersion.stdout.split("\n")[0]);

	// Example 2: Create test media files
	console.log("\n2. Creating test media files:");

	// Create a test image using ImageMagick
	console.log("   Creating test image...");
	await executor.runCommand("convert", [
		"-size",
		"800x600",
		"gradient:blue-yellow",
		"-swirl",
		"180",
		"-font",
		"DejaVu-Sans",
		"-pointsize",
		"48",
		"-gravity",
		"center",
		"-annotate",
		"+0+0",
		"Sample Media",
		"/home/vercel-sandbox/test-image.jpg",
	]);
	console.log("   ✅ Test image created");

	// Create a test video using ffmpeg
	console.log("   Creating test video...");
	await executor.executeScript(`
		ffmpeg -f lavfi -i testsrc=duration=5:size=640x480:rate=30 \
		-f lavfi -i sine=frequency=1000:duration=5 \
		-c:v libx264 -pix_fmt yuv420p -c:a aac \
		/home/vercel-sandbox/test-video.mp4 -y
	`);
	console.log("   ✅ Test video created");

	// Create a test audio file
	console.log("   Creating test audio...");
	await executor.executeScript(`
		ffmpeg -f lavfi -i "sine=frequency=440:duration=3" \
		-f lavfi -i "sine=frequency=880:duration=3" \
		-filter_complex "[0][1]amix=inputs=2" \
		/home/vercel-sandbox/test-audio.mp3 -y
	`);
	console.log("   ✅ Test audio created");

	// Example 3: Image processing operations
	console.log("\n3. Image processing operations:");

	// Resize image
	console.log("   Resizing image...");
	await executor.runCommand("convert", [
		"/home/vercel-sandbox/test-image.jpg",
		"-resize",
		"400x300",
		"/home/vercel-sandbox/test-image-resized.jpg",
	]);
	console.log("   ✅ Image resized to 400x300");

	// Create thumbnail
	console.log("   Creating thumbnail...");
	await executor.runCommand("convert", [
		"/home/vercel-sandbox/test-image.jpg",
		"-thumbnail",
		"150x150^",
		"-gravity",
		"center",
		"-extent",
		"150x150",
		"/home/vercel-sandbox/test-image-thumb.jpg",
	]);
	console.log("   ✅ Thumbnail created (150x150)");

	// Apply filters
	console.log("   Applying filters...");
	await executor.runCommand("convert", [
		"/home/vercel-sandbox/test-image.jpg",
		"-colorspace",
		"Gray",
		"-blur",
		"0x2",
		"-edge",
		"2",
		"/home/vercel-sandbox/test-image-filtered.jpg",
	]);
	console.log("   ✅ Filters applied (grayscale, blur, edge detection)");

	// Create image montage
	console.log("   Creating image montage...");
	await executor.runCommand("montage", [
		"/home/vercel-sandbox/test-image.jpg",
		"/home/vercel-sandbox/test-image-resized.jpg",
		"/home/vercel-sandbox/test-image-thumb.jpg",
		"/home/vercel-sandbox/test-image-filtered.jpg",
		"-tile",
		"2x2",
		"-geometry",
		"+5+5",
		"-background",
		"white",
		"/home/vercel-sandbox/image-montage.jpg",
	]);
	console.log("   ✅ Image montage created");

	// Example 4: Video processing
	console.log("\n4. Video processing operations:");

	// Extract video information
	console.log("   Extracting video metadata...");
	await executor.executeScript(`
		ffprobe -v quiet -print_format json -show_format -show_streams \
		/home/vercel-sandbox/test-video.mp4
	`);
	console.log("   ✅ Video metadata extracted");

	// Convert video format
	console.log("   Converting video to WebM...");
	await executor.executeScript(`
		ffmpeg -i /home/vercel-sandbox/test-video.mp4 \
		-c:v libvpx-vp9 -crf 30 -b:v 0 \
		/home/vercel-sandbox/test-video.webm -y
	`);
	console.log("   ✅ Video converted to WebM format");

	// Extract frames
	console.log("   Extracting video frames...");
	await executor.createDirectory("/home/vercel-sandbox/frames");
	await executor.executeScript(`
		ffmpeg -i /home/vercel-sandbox/test-video.mp4 \
		-vf fps=1 /home/vercel-sandbox/frames/frame_%03d.jpg -y
	`);
	console.log("   ✅ Frames extracted (1 per second)");

	// Create animated GIF
	console.log("   Creating animated GIF...");
	await executor.executeScript(`
		ffmpeg -i /home/vercel-sandbox/test-video.mp4 \
		-vf "fps=10,scale=320:-1:flags=lanczos" \
		-loop 0 /home/vercel-sandbox/test-animation.gif -y
	`);
	console.log("   ✅ Animated GIF created");

	// Example 5: Audio processing
	console.log("\n5. Audio processing operations:");

	// Extract audio metadata
	console.log("   Extracting audio metadata...");
	await executor.executeScript(`
		ffprobe -v quiet -print_format json -show_format \
		/home/vercel-sandbox/test-audio.mp3
	`);
	console.log("   ✅ Audio metadata extracted");

	// Convert audio format
	console.log("   Converting audio formats...");
	await executor.executeScript(`
		ffmpeg -i /home/vercel-sandbox/test-audio.mp3 \
		-c:a flac /home/vercel-sandbox/test-audio.flac -y
	`);
	await executor.executeScript(`
		ffmpeg -i /home/vercel-sandbox/test-audio.mp3 \
		-c:a libvorbis -q:a 4 /home/vercel-sandbox/test-audio.ogg -y
	`);
	console.log("   ✅ Audio converted to FLAC and OGG formats");

	// Apply audio filters
	console.log("   Applying audio effects...");
	await executor.executeScript(`
		ffmpeg -i /home/vercel-sandbox/test-audio.mp3 \
		-af "volume=0.5,highpass=f=200,lowpass=f=3000" \
		/home/vercel-sandbox/test-audio-filtered.mp3 -y
	`);
	console.log("   ✅ Audio filters applied (volume, highpass, lowpass)");

	// Example 6: Batch processing script
	console.log("\n6. Creating batch media processor:");

	const batchScript = `#!/bin/bash
# Batch media processing script

MEDIA_DIR="/home/vercel-sandbox/media-batch"
OUTPUT_DIR="/home/vercel-sandbox/media-output"

# Create directories
mkdir -p "$MEDIA_DIR" "$OUTPUT_DIR"

echo "🎯 Batch Media Processor"
echo "======================="

# Function to process images
process_images() {
    echo "Processing images..."
    for img in "$MEDIA_DIR"/*.{jpg,jpeg,png} 2>/dev/null; do
        if [ -f "$img" ]; then
            filename=$(basename "$img")
            name="\${filename%.*}"
            ext="\${filename##*.}"
            
            # Create web-optimized version
            convert "$img" -quality 85 -strip "$OUTPUT_DIR/\${name}_web.jpg"
            
            # Create thumbnail
            convert "$img" -thumbnail 200x200^ -gravity center -extent 200x200 "$OUTPUT_DIR/\${name}_thumb.jpg"
            
            echo "  ✅ Processed: $filename"
        fi
    done
}

# Function to process videos
process_videos() {
    echo "Processing videos..."
    for video in "$MEDIA_DIR"/*.{mp4,avi,mov} 2>/dev/null; do
        if [ -f "$video" ]; then
            filename=$(basename "$video")
            name="\${filename%.*}"
            
            # Create compressed version
            ffmpeg -i "$video" -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 128k \
                "$OUTPUT_DIR/\${name}_compressed.mp4" -y 2>/dev/null
            
            # Extract thumbnail
            ffmpeg -i "$video" -ss 00:00:01 -vframes 1 \
                "$OUTPUT_DIR/\${name}_thumbnail.jpg" -y 2>/dev/null
            
            echo "  ✅ Processed: $filename"
        fi
    done
}

# Function to generate report
generate_report() {
    echo ""
    echo "📊 Processing Report"
    echo "==================="
    echo "Input directory: $MEDIA_DIR"
    echo "Output directory: $OUTPUT_DIR"
    echo ""
    echo "Files processed:"
    ls -la "$OUTPUT_DIR" 2>/dev/null | grep -E '\\.(jpg|mp4)$' | wc -l
    echo ""
    echo "Output files:"
    ls -lh "$OUTPUT_DIR" 2>/dev/null | grep -E '\\.(jpg|mp4)$'
}

# Copy test files to batch directory
cp /home/vercel-sandbox/test-image.jpg "$MEDIA_DIR/" 2>/dev/null
cp /home/vercel-sandbox/test-video.mp4 "$MEDIA_DIR/" 2>/dev/null

# Run processing
process_images
process_videos
generate_report

echo ""
echo "✨ Batch processing complete!"
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/batch-processor.sh",
			content: batchScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/batch-processor.sh"]);

	// Run batch processor
	const batchResult = await executor.runCommand("bash", ["/home/vercel-sandbox/batch-processor.sh"]);
	console.log("   Batch processor output:");
	console.log(batchResult.stdout);

	// Example 7: Media analysis tool
	console.log("\n7. Creating media analysis tool:");

	const analysisScript = `#!/bin/bash
# Media file analyzer

analyze_media() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        echo "Error: File not found"
        return 1
    fi
    
    echo "📋 Media Analysis Report"
    echo "======================="
    echo "File: $(basename "$file")"
    echo "Path: $file"
    echo "Size: $(du -h "$file" | cut -f1)"
    echo ""
    
    # Detect file type
    file_type=$(file -b --mime-type "$file")
    echo "MIME Type: $file_type"
    
    case "$file_type" in
        image/*)
            echo "Type: Image"
            echo ""
            echo "Image Properties:"
            identify -verbose "$file" 2>/dev/null | grep -E "Geometry:|Colorspace:|Quality:|Filesize:" | head -4
            ;;
        video/*)
            echo "Type: Video"
            echo ""
            echo "Video Properties:"
            ffprobe -v quiet -show_entries format=duration,bit_rate:stream=codec_name,width,height,avg_frame_rate \
                -of default=noprint_wrappers=1 "$file"
            ;;
        audio/*)
            echo "Type: Audio"
            echo ""
            echo "Audio Properties:"
            ffprobe -v quiet -show_entries format=duration,bit_rate:stream=codec_name,sample_rate,channels \
                -of default=noprint_wrappers=1 "$file"
            ;;
        *)
            echo "Type: Unknown"
            ;;
    esac
}

# Analyze test files
echo "🔍 Analyzing test media files..."
echo ""

for file in /home/vercel-sandbox/test-*.*; do
    if [ -f "$file" ]; then
        analyze_media "$file"
        echo ""
        echo "---"
        echo ""
    fi
done
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/media-analyzer.sh",
			content: analysisScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/media-analyzer.sh"]);

	// Run analyzer
	const analyzerResult = await executor.runCommand("bash", ["/home/vercel-sandbox/media-analyzer.sh"]);
	console.log("   Media analyzer output:");
	console.log(analyzerResult.stdout);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	mediaProcessingExamples().catch(console.error);
}
