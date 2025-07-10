/**
 * Example 06: System Administration
 * Demonstrates system management, package installation, and monitoring
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function systemAdministrationExamples() {
	const executor = new SandboxExecutor();

	console.log("🔧 System Administration Examples\n");

	// Example 1: System information gathering
	console.log("1. System information and diagnostics:");

	// Get system info
	const unameResult = await executor.runCommand("uname", ["-a"]);
	console.log("   System:", unameResult.stdout.trim());

	// Check disk usage
	const dfResult = await executor.runCommand("df", ["-h"]);
	console.log("   Disk usage:");
	console.log(dfResult.stdout);

	// Memory info
	const freeResult = await executor.runCommand("free", ["-h"]);
	console.log("   Memory usage:");
	console.log(freeResult.stdout);

	// CPU info
	const cpuInfo = await executor.executeScript("lscpu | grep -E 'Model name|CPU\\(s\\)|Thread'");
	console.log("   CPU information:");
	console.log(cpuInfo.stdout);

	// Example 2: Package management with dnf
	console.log("\n2. Package management:");

	// Check dnf version
	const dnfVersion = await executor.runCommand("dnf", ["--version"]);
	console.log("   DNF version:", dnfVersion.stdout.split("\n")[0]);

	// Search for packages
	console.log("   Searching for monitoring tools...");
	const searchResult = await executor.runCommand("dnf", ["search", "htop", "iotop", "iftop"]);
	console.log("   Available packages:");
	const packages = searchResult.stdout
		.split("\n")
		.filter((line) => line.includes(".x86_64") || line.includes(".noarch"));
	packages.slice(0, 5).forEach((pkg) => console.log(`     - ${pkg.trim()}`));

	// Install a package (htop for system monitoring)
	console.log("\n   Installing htop...");
	const installResult = await executor.runCommand("dnf", ["install", "-y", "htop"]);
	if (installResult.success) {
		console.log("   ✅ htop installed successfully");
	}

	// Example 3: Process management
	console.log("\n3. Process management:");

	// Create a background process
	const bgScript = `#!/bin/bash
# Background worker script
echo "Starting background worker (PID: $$)"
count=0
while [ $count -lt 5 ]; do
    echo "Worker iteration $count at $(date)"
    sleep 2
    count=$((count + 1))
done
echo "Worker completed"
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/worker.sh",
			content: bgScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/worker.sh"]);

	// Run in background and capture PID
	console.log("   Starting background process...");
	const bgProcess = await executor.executeScript(
		"bash /home/vercel-sandbox/worker.sh > /home/vercel-sandbox/worker.log 2>&1 & echo $!",
	);
	const pid = bgProcess.stdout.trim();
	console.log(`   ✅ Background process started (PID: ${pid})`);

	// List processes
	const psResult = await executor.runCommand("ps", ["aux"]);
	const processes = psResult.stdout.split("\n").slice(0, 10);
	console.log("\n   Current processes (top 10):");
	processes.forEach((proc) => console.log(`     ${proc}`));

	// Monitor the background job
	await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
	const jobStatus = await executor.executeScript(`ps -p ${pid} > /dev/null && echo "Running" || echo "Completed"`);
	console.log(`\n   Background job status: ${jobStatus.stdout.trim()}`);

	// Example 4: User and permission management
	console.log("\n4. File permissions and ownership:");

	// Create test directory structure
	await executor.createDirectory("/home/vercel-sandbox/admin-test");
	await executor.createDirectory("/home/vercel-sandbox/admin-test/public");
	await executor.createDirectory("/home/vercel-sandbox/admin-test/private");

	// Create files with different permissions
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/admin-test/readme.txt",
			content: "Public documentation file",
		},
		{
			path: "/home/vercel-sandbox/admin-test/private/secret.txt",
			content: "Confidential information",
		},
		{
			path: "/home/vercel-sandbox/admin-test/script.sh",
			content: "#!/bin/bash\necho 'Executable script'",
		},
	]);

	// Set permissions
	console.log("   Setting file permissions...");
	await executor.runCommand("chmod", ["644", "/home/vercel-sandbox/admin-test/readme.txt"]);
	await executor.runCommand("chmod", ["600", "/home/vercel-sandbox/admin-test/private/secret.txt"]);
	await executor.runCommand("chmod", ["755", "/home/vercel-sandbox/admin-test/script.sh"]);
	await executor.runCommand("chmod", ["700", "/home/vercel-sandbox/admin-test/private"]);

	// Display permissions
	const lsResult = await executor.runCommand("ls", ["-la", "/home/vercel-sandbox/admin-test/"]);
	console.log("   Directory permissions:");
	console.log(lsResult.stdout);

	// Example 5: Cron job simulation
	console.log("\n5. Scheduled task simulation:");

	const cronScript = `#!/bin/bash
# Simulated cron job for system monitoring

LOG_FILE="/home/vercel-sandbox/system-monitor.log"

# Function to log system stats
log_system_stats() {
    echo "=== System Status at $(date) ===" >> "$LOG_FILE"
    echo "Disk Usage:" >> "$LOG_FILE"
    df -h / >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    echo "Memory Usage:" >> "$LOG_FILE"
    free -m >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    echo "Load Average:" >> "$LOG_FILE"
    uptime >> "$LOG_FILE"
    echo "================================" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# Simulate running every minute for 3 iterations
for i in {1..3}; do
    echo "Running scheduled task (iteration $i)..."
    log_system_stats
    if [ $i -lt 3 ]; then
        sleep 5  # Wait 5 seconds between runs (simulating cron interval)
    fi
done

echo "✅ Cron simulation completed. Check $LOG_FILE for results."
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/cron-monitor.sh",
			content: cronScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/cron-monitor.sh"]);

	// Run the cron simulation
	const cronRun = await executor.runCommand("bash", ["/home/vercel-sandbox/cron-monitor.sh"]);
	console.log("   Cron simulation output:");
	console.log(cronRun.stdout);

	// Show the log file
	const logResult = await executor.readFile("/home/vercel-sandbox/system-monitor.log");
	console.log("\n   System monitor log (last 20 lines):");
	const logLines = logResult.stdout.split("\n").slice(-20);
	logLines.forEach((line: string) => console.log(`     ${line}`));

	// Example 6: Network diagnostics
	console.log("\n6. Network diagnostics:");

	// Check network interfaces
	const ifconfigResult = await executor.runCommand("ip", ["addr", "show"]);
	console.log("   Network interfaces:");
	const interfaces = ifconfigResult.stdout.split("\n").filter((line) => line.includes("inet "));
	interfaces.forEach((iface) => console.log(`     ${iface.trim()}`));

	// Check connectivity
	console.log("\n   Testing connectivity...");
	const pingResult = await executor.runCommand("ping", ["-c", "3", "8.8.8.8"]);
	if (pingResult.success) {
		const stats = pingResult.stdout.split("\n").find((line) => line.includes("min/avg/max"));
		console.log(`   ✅ Internet connectivity OK: ${stats?.trim() || "Connected"}`);
	} else {
		console.log("   ❌ No internet connectivity");
	}

	// Check listening ports
	const netstatResult = await executor.runCommand("ss", ["-tuln"]);
	console.log("\n   Listening ports:");
	const ports = netstatResult.stdout.split("\n").slice(1, 6);
	ports.forEach((port) => console.log(`     ${port}`));

	// Example 7: System monitoring script
	console.log("\n7. Creating system monitoring dashboard:");

	const monitorScript = `#!/bin/bash
# System monitoring dashboard

clear
echo "📊 SYSTEM MONITORING DASHBOARD"
echo "=============================="
echo "Host: $(hostname)"
echo "Date: $(date)"
echo ""

# CPU Usage
echo "🖥️  CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print "   User: " $2 "%, System: " $4 "%, Idle: " $8 "%"}'

# Memory
echo ""
echo "💾 Memory Usage:"
free -h | awk '/^Mem:/ {print "   Total: " $2 ", Used: " $3 ", Free: " $4 ", Usage: " int($3/$2 * 100) "%"}'

# Disk
echo ""
echo "💿 Disk Usage:"
df -h / | awk 'NR==2 {print "   Total: " $2 ", Used: " $3 ", Available: " $4 ", Usage: " $5}'

# Load Average
echo ""
echo "📈 Load Average:"
uptime | awk -F'load average:' '{print "  " $2}'

# Top Processes
echo ""
echo "🔝 Top Processes (by CPU):"
ps aux --sort=-%cpu | head -6 | tail -5 | awk '{printf "   %-20s %5s%% %5s%% %s\\n", substr($11,1,20), $3, $4, $2}'

# Network
echo ""
echo "🌐 Network Statistics:"
ip -s link show 2>/dev/null | awk '/^[0-9]+:/ {iface=$2} /RX:/{getline; rx=$1} /TX:/{getline; tx=$1; if(iface!="lo:") print "   " iface " RX: " rx " bytes, TX: " tx " bytes"}'

echo ""
echo "=============================="
echo "Last updated: $(date +'%Y-%m-%d %H:%M:%S')"
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/system-dashboard.sh",
			content: monitorScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/system-dashboard.sh"]);

	// Run the dashboard
	const dashboardResult = await executor.runCommand("bash", ["/home/vercel-sandbox/system-dashboard.sh"]);
	console.log("   System dashboard output:");
	console.log(dashboardResult.stdout);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	systemAdministrationExamples().catch(console.error);
}
