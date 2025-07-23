/**
 * Example 04: Data Processing
 * Demonstrates data analysis, transformation, and processing tasks
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function dataProcessingExamples() {
	const executor = new SandboxExecutor();

	console.log("📊 Data Processing Examples\n");

	// Example 1: CSV Data Processing
	console.log("1. CSV Data Analysis:");

	const salesData = `date,product,quantity,price,region
2024-01-15,Laptop,5,1200,North
2024-01-16,Mouse,25,30,South
2024-01-16,Keyboard,15,80,North
2024-01-17,Monitor,8,350,East
2024-01-17,Laptop,3,1200,West
2024-01-18,Mouse,30,30,North
2024-01-18,Keyboard,20,80,South
2024-01-19,Monitor,12,350,East
2024-01-20,Laptop,7,1200,North`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/sales.csv",
			content: salesData,
		},
	]);

	// Calculate total revenue
	const revenueResult = await executor.runCommand(
		"awk",
		["-F,", 'NR>1 {revenue=$3*$4; total+=revenue} END {printf "Total Revenue: $%.2f\\n", total}', "sales.csv"],
		{ cwd: "/home/vercel-sandbox" },
	);
	console.log(`   ${revenueResult.stdout}`);

	// Product summary
	const productSummary = await executor.runCommand(
		"awk",
		["-F,", 'NR>1 {products[$2]+=$3} END {for(p in products) print "   " p ": " products[p] " units"}', "sales.csv"],
		{ cwd: "/home/vercel-sandbox" },
	);
	console.log("   Product Summary:");
	console.log(productSummary.stdout);

	// Example 2: JSON Data Processing
	console.log("\n2. JSON Data Processing:");

	const jsonData = {
		users: [
			{ id: 1, name: "Alice", age: 28, department: "Engineering", salary: 95000 },
			{ id: 2, name: "Bob", age: 35, department: "Sales", salary: 75000 },
			{ id: 3, name: "Charlie", age: 42, department: "Engineering", salary: 110000 },
			{ id: 4, name: "Diana", age: 31, department: "Marketing", salary: 80000 },
			{ id: 5, name: "Eve", age: 29, department: "Sales", salary: 70000 },
		],
		company: "TechCorp",
		year: 2024,
	};

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/employees.json",
			content: JSON.stringify(jsonData, null, 2),
		},
	]);

	// Install jq for JSON processing
	await executor.installPackages(["jq"]);

	// Average salary by department
	const deptAnalysis = await executor.runCommand(
		"jq",
		[
			"[.users | group_by(.department)[] | {department: .[0].department, avg_salary: (map(.salary) | add / length), count: length}]",
			"employees.json",
		],
		{ cwd: "/home/vercel-sandbox" },
	);
	console.log("   Department Analysis:");
	console.log(deptAnalysis.stdout);

	// Example 3: Log File Analysis
	console.log("\n3. Log File Analysis:");

	const logData = `2024-01-20 10:15:23 INFO User login: user123
2024-01-20 10:16:45 ERROR Failed to connect to database
2024-01-20 10:17:02 INFO API request: GET /users
2024-01-20 10:17:05 WARN Slow query detected (1523ms)
2024-01-20 10:18:30 INFO User logout: user123
2024-01-20 10:19:12 ERROR Timeout connecting to external service
2024-01-20 10:20:00 INFO API request: POST /data
2024-01-20 10:20:15 ERROR Invalid input data
2024-01-20 10:21:30 INFO Cache cleared
2024-01-20 10:22:45 WARN Memory usage high (85%)`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/app.log",
			content: logData,
		},
	]);

	// Count log levels
	console.log("   Log Level Summary:");

	const countResult = await executor.executeScript(
		`cd /home/vercel-sandbox && awk '{print $3}' app.log | sort | uniq -c | sort -nr`,
		"bash",
	);
	console.log(countResult.stdout);

	// Extract errors
	console.log("\n   Errors found:");
	const errorResult = await executor.runCommand("grep", ["ERROR", "app.log"], { cwd: "/home/vercel-sandbox" });
	console.log(errorResult.stdout);

	// Example 4: Python Data Analysis
	console.log("\n4. Python Data Analysis:");

	const _pythonScript = `
import json
import statistics

# Read the employee data
with open('employees.json', 'r') as f:
    data = json.load(f)

employees = data['users']

# Basic statistics
ages = [emp['age'] for emp in employees]
salaries = [emp['salary'] for emp in employees]

print("Employee Statistics:")
print(f"  Total Employees: {len(employees)}")
print(f"  Average Age: {statistics.mean(ages):.1f}")
print(f"  Age Range: {min(ages)} - {max(ages)}")
print(f"  Average Salary: \${statistics.mean(salaries):,.2f}")
print(f"  Salary Std Dev: \${statistics.stdev(salaries):,.2f}")

# Department distribution
dept_count = {}
for emp in employees:
    dept = emp['department']
    dept_count[dept] = dept_count.get(dept, 0) + 1

print("\\nDepartment Distribution:")
for dept, count in sorted(dept_count.items()):
    print(f"  {dept}: {count} employees")
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/analyze.py",
			content: _pythonScript,
		},
	]);

	const pythonResult = await executor.runCommand("python3", ["analyze.py"], {
		cwd: "/home/vercel-sandbox",
	});
	console.log(pythonResult.stdout);

	// Example 5: Data Transformation Pipeline
	console.log("\n5. Data Transformation Pipeline:");

	const transformScript = `#!/bin/bash
echo "Starting data transformation pipeline..."

# Step 1: Extract data from CSV
echo "Step 1: Extracting high-value sales..."
awk -F, 'NR>1 && $3*$4 > 1000 {print $0}' sales.csv > high_value_sales.csv

# Step 2: Sort by revenue
echo "Step 2: Sorting by revenue..."
awk -F, 'NR==1 {print $0",revenue"} NR>1 {print $0","$3*$4}' high_value_sales.csv | \
    sort -t, -k6 -nr > sorted_sales.csv

# Step 3: Generate summary report
echo "Step 3: Generating summary report..."
cat > report.txt << EOF
Sales Analysis Report
====================
Generated: $(date)

High-Value Transactions (>$1000):
$(wc -l < high_value_sales.csv) transactions

Top Products by Revenue:
$(awk -F, 'NR>1 {rev[$2]+=$3*$4} END {for(p in rev) print p": $"rev[p]}' high_value_sales.csv | sort -k2 -nr | head -3)

Regional Distribution:
$(awk -F, 'NR>1 {regions[$5]++} END {for(r in regions) print r": "regions[r]" sales"}' high_value_sales.csv)
EOF

echo "Pipeline complete! Report saved to report.txt"
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/transform.sh",
			content: transformScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "transform.sh"], {
		cwd: "/home/vercel-sandbox",
	});

	const pipelineResult = await executor.runCommand("bash", ["transform.sh"], {
		cwd: "/home/vercel-sandbox",
	});
	console.log(pipelineResult.stdout);

	// Show the report
	console.log("\n   Generated Report:");
	const reportResult = await executor.readFile("/home/vercel-sandbox/report.txt");
	console.log(reportResult.stdout);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	dataProcessingExamples().catch(console.error);
}
