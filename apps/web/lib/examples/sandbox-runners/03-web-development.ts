/**
 * Example 03: Web Development
 * Demonstrates creating web applications, APIs, and static sites
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function webDevelopmentExamples() {
	const executor = new SandboxExecutor();

	console.log("🌐 Web Development Examples\n");

	// Example 1: Create a simple Express API
	console.log("1. Creating Express REST API:");

	const packageJson = {
		name: "api-example",
		version: "1.0.0",
		scripts: {
			start: "node server.js",
		},
		dependencies: {
			express: "^4.18.0",
			cors: "^2.8.5",
		},
	};

	const serverCode = `
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory data store
let todos = [
    { id: 1, title: 'Learn Express', completed: false },
    { id: 2, title: 'Build API', completed: true }
];

// Routes
app.get('/api/todos', (req, res) => {
    res.json(todos);
});

app.post('/api/todos', (req, res) => {
    const todo = {
        id: todos.length + 1,
        title: req.body.title,
        completed: false
    };
    todos.push(todo);
    res.status(201).json(todo);
});

app.put('/api/todos/:id', (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    
    todo.completed = req.body.completed;
    res.json(todo);
});

// For testing purposes, just log instead of listening
console.log('Express API created successfully!');
console.log('Available endpoints:');
console.log('  GET  /api/todos');
console.log('  POST /api/todos');
console.log('  PUT  /api/todos/:id');
`;

	await executor.createDirectory("/home/vercel-sandbox/express-api");
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/express-api/package.json",
			content: JSON.stringify(packageJson, null, 2),
		},
		{
			path: "/home/vercel-sandbox/express-api/server.js",
			content: serverCode,
		},
	]);

	// Install dependencies
	console.log("   Installing dependencies...");
	await executor.runCommand("npm", ["install"], {
		cwd: "/home/vercel-sandbox/express-api",
	});
	console.log("   ✅ Dependencies installed");

	// Test the server setup
	const testRun = await executor.runCommand("node", ["server.js"], {
		cwd: "/home/vercel-sandbox/express-api",
	});
	console.log(testRun.stdout);

	// Example 2: Create a static HTML site
	console.log("\n2. Creating static website:");

	const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Portfolio</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>John Doe</h1>
        <nav>
            <a href="#about">About</a>
            <a href="#projects">Projects</a>
            <a href="#contact">Contact</a>
        </nav>
    </header>
    <main>
        <section id="about">
            <h2>About Me</h2>
            <p>Full-stack developer passionate about creating amazing web experiences.</p>
        </section>
        <section id="projects">
            <h2>Projects</h2>
            <div class="project-grid">
                <div class="project">Project 1</div>
                <div class="project">Project 2</div>
                <div class="project">Project 3</div>
            </div>
        </section>
    </main>
    <script src="script.js"></script>
</body>
</html>`;

	const cssContent = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
header { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    text-align: center;
}
nav { margin-top: 1rem; }
nav a { color: white; margin: 0 1rem; text-decoration: none; }
main { max-width: 1200px; margin: 0 auto; padding: 2rem; }
section { margin-bottom: 3rem; }
.project-grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}
.project { 
    background: #f0f0f0; 
    padding: 2rem; 
    border-radius: 8px;
    text-align: center;
}`;

	const jsContent = `
// Smooth scrolling for navigation links
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').slice(1);
        document.getElementById(targetId).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'all 0.6s ease-out';
    observer.observe(section);
});

console.log('Portfolio site initialized!');`;

	await executor.createDirectory("/home/vercel-sandbox/portfolio");
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/portfolio/index.html",
			content: htmlContent,
		},
		{
			path: "/home/vercel-sandbox/portfolio/style.css",
			content: cssContent,
		},
		{
			path: "/home/vercel-sandbox/portfolio/script.js",
			content: jsContent,
		},
	]);
	console.log("   ✅ Static site created with HTML, CSS, and JavaScript");

	// Example 3: Create a React component (without build process)
	console.log("\n3. Creating React component:");

	const reactComponent = `
// TodoList.jsx - A simple React component
import React, { useState } from 'react';

const TodoList = () => {
    const [todos, setTodos] = useState([
        { id: 1, text: 'Learn React', done: false },
        { id: 2, text: 'Build amazing apps', done: false }
    ]);
    const [inputValue, setInputValue] = useState('');

    const addTodo = () => {
        if (inputValue.trim()) {
            setTodos([...todos, {
                id: Date.now(),
                text: inputValue,
                done: false
            }]);
            setInputValue('');
        }
    };

    const toggleTodo = (id) => {
        setTodos(todos.map(todo =>
            todo.id === id ? { ...todo, done: !todo.done } : todo
        ));
    };

    return (
        <div className="todo-container">
            <h2>My Todo List</h2>
            <div className="todo-input">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTodo()}
                    placeholder="Add a new todo..."
                />
                <button onClick={addTodo}>Add</button>
            </div>
            <ul className="todo-list">
                {todos.map(todo => (
                    <li key={todo.id} className={\`todo-item \${todo.done ? 'done' : ''}\`}>
                        <input
                            type="checkbox"
                            checked={todo.done}
                            onChange={() => toggleTodo(todo.id)}
                        />
                        <span>{todo.text}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TodoList;`;

	await executor.createDirectory("/home/vercel-sandbox/react-components");
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/react-components/TodoList.jsx",
			content: reactComponent,
		},
	]);
	console.log("   ✅ React component created");

	// Example 4: Create a build script
	console.log("\n4. Creating build script:");

	const buildScript = `#!/bin/bash
# Build script for web projects

echo "🔨 Building web project..."

# Minify CSS
if [ -f style.css ]; then
    echo "Minifying CSS..."
    # Simple CSS minification (remove comments and extra whitespace)
    sed 's/\/\*.*\*\///g' style.css | tr -d '\n' | sed 's/  */ /g' > style.min.css
    echo "✅ CSS minified"
fi

# Minify JavaScript (basic)
if [ -f script.js ]; then
    echo "Minifying JavaScript..."
    # Remove comments and extra whitespace
    sed '/^\/\//d' script.js | tr -d '\n' | sed 's/  */ /g' > script.min.js
    echo "✅ JavaScript minified"
fi

# Create production HTML
if [ -f index.html ]; then
    echo "Updating HTML references..."
    sed 's/style.css/style.min.css/g; s/script.js/script.min.js/g' index.html > index.prod.html
    echo "✅ Production HTML created"
fi

echo "✨ Build complete!"
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/portfolio/build.sh",
			content: buildScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "build.sh"], {
		cwd: "/home/vercel-sandbox/portfolio",
	});

	// Run the build
	const buildResult = await executor.runCommand("bash", ["build.sh"], {
		cwd: "/home/vercel-sandbox/portfolio",
	});
	console.log("   Build output:");
	console.log(buildResult.stdout);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	webDevelopmentExamples().catch(console.error);
}
