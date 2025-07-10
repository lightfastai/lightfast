/**
 * Examples of how LLM agents can use the atomic sandbox operations
 * These examples show various use cases across different domains
 */

import { SandboxExecutor } from "./sandbox-executor";

// Example 1: Python Data Science Project
export async function pythonDataScienceExample() {
	const executor = new SandboxExecutor();
	await executor.initialize({ runtime: "python3.13" });

	// Install required packages
	await executor.runCommand("pip", ["install", "pandas", "numpy", "matplotlib"]);

	// Create a data analysis script
	const pythonCode = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Generate sample data
data = {
    'x': np.random.randn(100),
    'y': np.random.randn(100)
}
df = pd.DataFrame(data)

# Basic statistics
print("Data Statistics:")
print(df.describe())

# Create a scatter plot
plt.figure(figsize=(8, 6))
plt.scatter(df['x'], df['y'], alpha=0.5)
plt.xlabel('X values')
plt.ylabel('Y values')
plt.title('Random Data Scatter Plot')
plt.savefig('scatter_plot.png')
print("\\nPlot saved as scatter_plot.png")
`;

	await executor.writeFiles([{ path: "/home/vercel-sandbox/analysis.py", content: pythonCode }]);

	// Run the analysis
	const result = await executor.runCommand("python", ["analysis.py"]);
	return result;
}

// Example 2: FFmpeg Video Processing
export async function ffmpegVideoProcessingExample() {
	const executor = new SandboxExecutor();

	// Install FFmpeg
	await executor.installPackages(["ffmpeg"]);

	// Download a sample video (or use one provided by user)
	await executor.downloadFile(
		"https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
		"/home/vercel-sandbox/input.mp4",
	);

	// Convert video to different format with compression
	await executor.runCommand("ffmpeg", [
		"-i",
		"input.mp4",
		"-vcodec",
		"h264",
		"-acodec",
		"aac",
		"-strict",
		"-2",
		"-crf",
		"24",
		"-preset",
		"fast",
		"output.mp4",
	]);

	// Extract thumbnail
	await executor.runCommand("ffmpeg", ["-i", "input.mp4", "-ss", "00:00:05", "-vframes", "1", "thumbnail.jpg"]);

	// Get video info
	const info = await executor.runCommand("ffprobe", [
		"-v",
		"quiet",
		"-print_format",
		"json",
		"-show_format",
		"-show_streams",
		"output.mp4",
	]);

	return info;
}

// Example 3: Web Scraping with Node.js
export async function webScrapingExample() {
	const executor = new SandboxExecutor();
	await executor.initialize({ runtime: "node22" });

	// Set up Node.js project
	const packageJson = {
		name: "web-scraper",
		version: "1.0.0",
		dependencies: {
			puppeteer: "^21.0.0",
			cheerio: "^1.0.0-rc.12",
			axios: "^1.5.0",
		},
	};

	await executor.writeFiles([
		{ path: "/home/vercel-sandbox/scraper/package.json", content: JSON.stringify(packageJson, null, 2) },
	]);

	// Install dependencies
	await executor.runCommand("npm", ["install"], { cwd: "/home/vercel-sandbox/scraper" });

	// Create scraper script
	const scraperCode = `
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeWebsite() {
    try {
        const { data } = await axios.get('https://example.com');
        const $ = cheerio.load(data);
        
        console.log('Page Title:', $('title').text());
        console.log('\\nAll Links:');
        $('a').each((i, elem) => {
            console.log('- ' + $(elem).attr('href'));
        });
    } catch (error) {
        console.error('Error:', error.message);
    }
}

scrapeWebsite();
`;

	await executor.writeFiles([{ path: "/home/vercel-sandbox/scraper/scrape.js", content: scraperCode }]);

	// Run the scraper
	const result = await executor.runCommand("node", ["scrape.js"], { cwd: "/home/vercel-sandbox/scraper" });
	return result;
}

// Example 4: Rust Development
export async function rustDevelopmentExample() {
	const executor = new SandboxExecutor();

	// Install Rust
	await executor.executeScript(`
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
		source $HOME/.cargo/env
	`);

	// Create a Rust project
	await executor.runCommand("cargo", ["new", "hello_rust", "--bin"], {
		env: { PATH: "$PATH:$HOME/.cargo/bin" },
	});

	// Write Rust code
	const rustCode = `
fn main() {
    println!("Hello from Rust!");
    
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    
    println!("Sum of {:?} is {}", numbers, sum);
}
`;

	await executor.writeFiles([{ path: "/home/vercel-sandbox/hello_rust/src/main.rs", content: rustCode }]);

	// Build and run
	await executor.runCommand("cargo", ["build", "--release"], {
		cwd: "/home/vercel-sandbox/hello_rust",
		env: { PATH: "$PATH:$HOME/.cargo/bin" },
	});

	const result = await executor.runCommand("cargo", ["run"], {
		cwd: "/home/vercel-sandbox/hello_rust",
		env: { PATH: "$PATH:$HOME/.cargo/bin" },
	});

	return result;
}

// Example 5: Security Analysis with Semgrep
export async function securityAnalysisExample() {
	const executor = new SandboxExecutor();

	// Install Semgrep
	await executor.runCommand("pip", ["install", "semgrep"]);

	// Create sample vulnerable code
	const vulnerableCode = `
import sqlite3
from flask import Flask, request

app = Flask(__name__)

@app.route('/user')
def get_user():
    # SQL Injection vulnerability
    user_id = request.args.get('id')
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE id = {user_id}"  # Vulnerable!
    cursor.execute(query)
    return cursor.fetchone()

@app.route('/exec')
def execute_command():
    # Command injection vulnerability
    cmd = request.args.get('cmd')
    import os
    os.system(cmd)  # Vulnerable!
    return "Executed"
`;

	await executor.writeFiles([{ path: "/home/vercel-sandbox/vulnerable.py", content: vulnerableCode }]);

	// Run security scan
	const result = await executor.runCommand("semgrep", ["--config=auto", "vulnerable.py", "--json"]);

	return result;
}

// Example 6: Docker Container Management
export async function dockerExample() {
	const executor = new SandboxExecutor();

	// Note: Docker might need special permissions in sandbox
	// This is a demonstration of the pattern

	// Create Dockerfile
	const dockerfile = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
`;

	await executor.writeFiles([{ path: "/home/vercel-sandbox/Dockerfile", content: dockerfile }]);

	// Build Docker image
	await executor.runCommand("docker", ["build", "-t", "myapp", "."], { sudo: true });

	// Run container
	const result = await executor.runCommand("docker", ["run", "-d", "-p", "3000:3000", "myapp"], { sudo: true });

	return result;
}

// Example 7: Machine Learning with TensorFlow
export async function tensorflowExample() {
	const executor = new SandboxExecutor();
	await executor.initialize({ runtime: "python3.13" });

	// Install TensorFlow
	await executor.runCommand("pip", ["install", "tensorflow", "scikit-learn"]);

	// Create ML script
	const mlCode = `
import tensorflow as tf
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np

# Load dataset
iris = load_iris()
X, y = iris.data, iris.target

# Split and scale
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# Build model
model = tf.keras.Sequential([
    tf.keras.layers.Dense(10, activation='relu', input_shape=(4,)),
    tf.keras.layers.Dense(10, activation='relu'),
    tf.keras.layers.Dense(3, activation='softmax')
])

# Compile and train
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
history = model.fit(X_train, y_train, epochs=50, verbose=0, validation_split=0.2)

# Evaluate
test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
print(f"Test accuracy: {test_acc:.4f}")

# Save model
model.save('iris_model.h5')
print("Model saved as iris_model.h5")
`;

	await executor.writeFiles([{ path: "/home/vercel-sandbox/train_model.py", content: mlCode }]);

	// Run training
	const result = await executor.runCommand("python", ["train_model.py"]);
	return result;
}

// Example showing how an LLM agent would use these operations
export async function llmAgentUsageExample(_task: string) {
	const executor = new SandboxExecutor();

	// The LLM would analyze the task and generate a sequence of operations
	// For example, if task is "Create a web server that serves static files"

	// 1. Determine the runtime needed
	await executor.initialize({ runtime: "node22" });

	// 2. Create project structure
	await executor.createDirectory("/home/vercel-sandbox/web-server/public");

	// 3. Generate necessary files
	const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200);
            res.end(content);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
`;

	const indexHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Static File Server</title>
</head>
<body>
    <h1>Welcome to the Static File Server</h1>
    <p>This server serves static files from the public directory.</p>
</body>
</html>
`;

	// 4. Write files
	await executor.writeFiles([
		{ path: "/home/vercel-sandbox/web-server/server.js", content: serverCode },
		{ path: "/home/vercel-sandbox/web-server/public/index.html", content: indexHtml },
	]);

	// 5. Run the server
	const result = await executor.runCommand("node", ["server.js"], {
		cwd: "/home/vercel-sandbox/web-server",
	});

	return result;
}

// Export all examples
export const examples = {
	pythonDataScience: pythonDataScienceExample,
	ffmpegProcessing: ffmpegVideoProcessingExample,
	webScraping: webScrapingExample,
	rustDevelopment: rustDevelopmentExample,
	securityAnalysis: securityAnalysisExample,
	docker: dockerExample,
	tensorflowML: tensorflowExample,
	llmAgentUsage: llmAgentUsageExample,
};
