/**
 * Example 05: Python Development
 * Demonstrates Python scripting, package management, and frameworks
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function pythonDevelopmentExamples() {
	const executor = new SandboxExecutor();

	console.log("🐍 Python Development Examples\n");

	// Example 1: Basic Python script
	console.log("1. Creating and running Python script:");

	const helloScript = `#!/usr/bin/env python3
# Basic Python script demonstrating core features

def greet(name):
    """Greet a person with their name."""
    return f"Hello, {name}!"

def calculate_fibonacci(n):
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

# Main execution
if __name__ == "__main__":
    print(greet("Vercel Sandbox"))
    
    print("\\nFibonacci sequence (first 10 numbers):")
    for i in range(10):
        print(f"F({i}) = {calculate_fibonacci(i)}")
    
    # Working with lists and comprehensions
    squares = [x**2 for x in range(10)]
    print(f"\\nSquares: {squares}")
    
    # Dictionary operations
    data = {"name": "Python", "version": 3.11, "features": ["simple", "powerful"]}
    print(f"\\nLanguage info: {data}")
`;

	await executor.createDirectory("/home/vercel-sandbox/python-examples");
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/python-examples/hello.py",
			content: helloScript,
		},
	]);

	const runScript = await executor.runCommand("python3", ["hello.py"], {
		cwd: "/home/vercel-sandbox/python-examples",
	});
	console.log("   Output:");
	console.log(runScript.stdout);

	// Example 2: Creating a virtual environment and installing packages
	console.log("\n2. Setting up virtual environment:");

	// Create virtual environment
	await executor.runCommand("python3", ["-m", "venv", "myenv"], {
		cwd: "/home/vercel-sandbox/python-examples",
	});
	console.log("   ✅ Virtual environment created");

	// Create requirements.txt
	const requirements = `requests==2.31.0
numpy==1.24.3
pandas==2.0.3
matplotlib==3.7.2
flask==3.0.0
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/python-examples/requirements.txt",
			content: requirements,
		},
	]);

	// Install packages in virtual environment
	console.log("   Installing packages...");
	await executor.executeScript(
		"cd /home/vercel-sandbox/python-examples && source myenv/bin/activate && pip install -r requirements.txt",
	);
	console.log("   ✅ Packages installed in virtual environment");

	// Example 3: Data science script
	console.log("\n3. Data science operations:");

	const dataScript = `#!/usr/bin/env python3
import numpy as np
import pandas as pd

# Create sample data
np.random.seed(42)
data = {
    'date': pd.date_range('2024-01-01', periods=30),
    'temperature': np.random.normal(20, 5, 30),
    'humidity': np.random.normal(60, 10, 30),
    'sales': np.random.randint(100, 500, 30)
}

# Create DataFrame
df = pd.DataFrame(data)

# Basic analysis
print("Dataset Overview:")
print(df.head())
print(f"\\nShape: {df.shape}")

print("\\nStatistical Summary:")
print(df.describe())

# Correlations
print("\\nCorrelations:")
print(df[['temperature', 'humidity', 'sales']].corr())

# Group by week
df['week'] = df['date'].dt.isocalendar().week
weekly_sales = df.groupby('week')['sales'].agg(['mean', 'sum', 'count'])
print("\\nWeekly Sales Summary:")
print(weekly_sales)

# Export to CSV
df.to_csv('sales_data.csv', index=False)
print("\\n✅ Data exported to sales_data.csv")
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/python-examples/data_analysis.py",
			content: dataScript,
		},
	]);

	// Run data science script
	const dataRun = await executor.executeScript(
		"cd /home/vercel-sandbox/python-examples && source myenv/bin/activate && python data_analysis.py",
	);
	console.log("   Output:");
	console.log(dataRun.stdout);

	// Example 4: Flask web application
	console.log("\n4. Creating Flask web application:");

	const flaskApp = `#!/usr/bin/env python3
from flask import Flask, jsonify, request
from datetime import datetime
import json

app = Flask(__name__)

# In-memory data store
tasks = [
    {"id": 1, "title": "Learn Flask", "completed": False, "created_at": "2024-01-01"},
    {"id": 2, "title": "Build API", "completed": True, "created_at": "2024-01-02"}
]

@app.route('/')
def home():
    return jsonify({
        "message": "Welcome to Flask API",
        "endpoints": {
            "GET /api/tasks": "List all tasks",
            "POST /api/tasks": "Create new task",
            "PUT /api/tasks/<id>": "Update task",
            "DELETE /api/tasks/<id>": "Delete task"
        }
    })

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    new_task = {
        "id": len(tasks) + 1,
        "title": data.get('title'),
        "completed": False,
        "created_at": datetime.now().strftime("%Y-%m-%d")
    }
    tasks.append(new_task)
    return jsonify(new_task), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = next((t for t in tasks if t['id'] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    data = request.get_json()
    task['completed'] = data.get('completed', task['completed'])
    task['title'] = data.get('title', task['title'])
    return jsonify(task)

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    global tasks
    tasks = [t for t in tasks if t['id'] != task_id]
    return '', 204

# For testing, just show it works
if __name__ == '__main__':
    print("Flask API created successfully!")
    print("Available endpoints:")
    for rule in app.url_map.iter_rules():
        print(f"  {rule.methods} {rule.rule}")
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/python-examples/app.py",
			content: flaskApp,
		},
	]);

	// Test Flask app setup
	const flaskTest = await executor.executeScript(
		"cd /home/vercel-sandbox/python-examples && source myenv/bin/activate && python app.py",
	);
	console.log("   Flask app output:");
	console.log(flaskTest.stdout);

	// Example 5: Machine learning script
	console.log("\n5. Machine learning example:");

	const _mlScript = `#!/usr/bin/env python3
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
import pickle

# Generate synthetic data
np.random.seed(42)
n_samples = 100

# Features: size (sqft), bedrooms, age
X = np.random.rand(n_samples, 3)
X[:, 0] *= 3000  # Size: 0-3000 sqft
X[:, 1] = np.random.randint(1, 6, n_samples)  # Bedrooms: 1-5
X[:, 2] = np.random.randint(0, 50, n_samples)  # Age: 0-50 years

# Target: price (with some noise)
price_base = 50000
price_per_sqft = 100
bedroom_value = 10000
age_depreciation = -1000

y = (price_base + 
     X[:, 0] * price_per_sqft + 
     X[:, 1] * bedroom_value + 
     X[:, 2] * age_depreciation +
     np.random.normal(0, 20000, n_samples))

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
model = LinearRegression()
model.fit(X_train, y_train)

# Make predictions
y_pred = model.predict(X_test)

# Evaluate
mse = mean_squared_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print("House Price Prediction Model")
print("=" * 30)
print(f"Training samples: {len(X_train)}")
print(f"Test samples: {len(X_test)}")
print(f"\\nModel coefficients:")
print(f"  Size (sqft): \${model.coef_[0]:,.2f}")
print(f"  Bedrooms: \${model.coef_[1]:,.2f}")
print(f"  Age (years): \${model.coef_[2]:,.2f}")
print(f"  Base price: \${model.intercept_:,.2f}")
print(f"\\nModel performance:")
print(f"  MSE: {mse:.2f}")
print(f"  R² score: {r2:.3f}")

# Save model
with open('house_price_model.pkl', 'wb') as f:
    pickle.dump(model, f)
print("\\n✅ Model saved to house_price_model.pkl")

# Example prediction
sample_house = np.array([[2000, 3, 10]])  # 2000 sqft, 3 bedrooms, 10 years old
predicted_price = model.predict(sample_house)[0]
print(f"\\nExample prediction:")
print(f"  House: 2000 sqft, 3 bedrooms, 10 years old")
print(f"  Predicted price: \${predicted_price:,.2f}")
`;

	// Create a simple ML script that doesn't require scikit-learn
	const _simpleMlScript = `#!/usr/bin/env python3
# Simple machine learning example without external libraries

import json
import random

# Simple linear regression from scratch
class SimpleLinearRegression:
    def __init__(self):
        self.slope = None
        self.intercept = None
    
    def fit(self, X, y):
        n = len(X)
        x_mean = sum(X) / n
        y_mean = sum(y) / n
        
        numerator = sum((X[i] - x_mean) * (y[i] - y_mean) for i in range(n))
        denominator = sum((X[i] - x_mean) ** 2 for i in range(n))
        
        self.slope = numerator / denominator
        self.intercept = y_mean - self.slope * x_mean
    
    def predict(self, X):
        return [self.slope * x + self.intercept for x in X]

# Generate synthetic data
random.seed(42)
n_samples = 50

# Simple feature: house size in thousands of sqft
X = [random.uniform(1, 4) for _ in range(n_samples)]

# Price in thousands (base + size effect + noise)
y = [100 + 50 * x + random.gauss(0, 10) for x in X]

# Split data (80/20)
split_idx = int(0.8 * n_samples)
X_train, X_test = X[:split_idx], X[split_idx:]
y_train, y_test = y[:split_idx], y[split_idx:]

# Train model
model = SimpleLinearRegression()
model.fit(X_train, y_train)

# Make predictions
y_pred = model.predict(X_test)

# Calculate simple metrics
mse = sum((y_test[i] - y_pred[i]) ** 2 for i in range(len(y_test))) / len(y_test)

print("Simple House Price Prediction Model")
print("=" * 35)
print(f"Training samples: {len(X_train)}")
print(f"Test samples: {len(X_test)}")
print(f"\\nModel parameters:")
print(f"  Price per 1000 sqft: \${model.slope * 1000:,.2f}")
print(f"  Base price: \${model.intercept * 1000:,.2f}")
print(f"\\nModel performance:")
print(f"  Mean Squared Error: {mse:.2f}")

# Save model parameters
model_data = {
    "slope": model.slope,
    "intercept": model.intercept,
    "units": "thousands of dollars",
    "feature": "size in thousands of sqft"
}

with open('simple_model.json', 'w') as f:
    json.dump(model_data, f, indent=2)
print("\\n✅ Model saved to simple_model.json")

# Example prediction
sample_size = 2.5  # 2500 sqft
predicted_price = model.slope * sample_size + model.intercept
print(f"\\nExample prediction:")
print(f"  House size: 2,500 sqft")
print(f"  Predicted price: \${predicted_price * 1000:,.2f}")
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/python-examples/ml_example.py",
			content: _simpleMlScript,
		},
	]);

	// Run ML script
	const mlRun = await executor.runCommand("python3", ["ml_example.py"], {
		cwd: "/home/vercel-sandbox/python-examples",
	});
	console.log("   Machine learning output:");
	console.log(mlRun.stdout);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	pythonDevelopmentExamples().catch(console.error);
}
