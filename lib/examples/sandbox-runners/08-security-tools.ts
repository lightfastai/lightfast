/**
 * Example 08: Security Tools
 * Demonstrates security scanning, vulnerability detection, and log analysis
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function securityToolsExamples() {
	const executor = new SandboxExecutor();

	console.log("🔒 Security Tools Examples\n");

	// Example 1: Install security tools
	console.log("1. Installing security tools:");

	// Install Python (needed for many security tools)
	console.log("   Installing Python and pip...");
	const pythonInstall = await executor.runCommand("dnf", ["install", "-y", "python3", "python3-pip"]);
	if (pythonInstall.success) {
		console.log("   ✅ Python installed successfully");
	}

	// Install semgrep
	console.log("   Installing semgrep...");
	const semgrepInstall = await executor.runCommand("pip3", ["install", "semgrep"]);
	if (semgrepInstall.success) {
		console.log("   ✅ semgrep installed successfully");
	}

	// Install other security tools
	console.log("   Installing additional security tools...");
	await executor.runCommand("pip3", ["install", "bandit", "safety"]);
	console.log("   ✅ bandit and safety installed");

	// Example 2: Create vulnerable code samples
	console.log("\n2. Creating code samples for security scanning:");

	// Create vulnerable Python code
	const vulnerablePython = `#!/usr/bin/env python3
# Example code with security vulnerabilities

import os
import subprocess
import pickle
import hashlib
from flask import Flask, request, render_template_string

app = Flask(__name__)

# SQL Injection vulnerability
def get_user(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"  # SQL injection
    # execute_query(query)
    return query

# Command injection vulnerability
@app.route('/ping')
def ping():
    host = request.args.get('host', '127.0.0.1')
    # Vulnerable to command injection
    result = os.system(f'ping -c 1 {host}')
    return f"Ping result: {result}"

# Insecure deserialization
def load_user_data(data):
    # Vulnerable to arbitrary code execution
    return pickle.loads(data)

# Weak cryptography
def hash_password(password):
    # MD5 is cryptographically broken
    return hashlib.md5(password.encode()).hexdigest()

# Server-Side Template Injection (SSTI)
@app.route('/greet')
def greet():
    name = request.args.get('name', 'Guest')
    # Vulnerable to SSTI
    template = f"Hello {name}!"
    return render_template_string(template)

# Hardcoded credentials
DATABASE_PASSWORD = "admin123"  # Hardcoded password
API_KEY = "sk-1234567890abcdef"  # Hardcoded API key

# Path traversal vulnerability
@app.route('/read')
def read_file():
    filename = request.args.get('file')
    # Vulnerable to path traversal
    with open(f'/var/data/{filename}', 'r') as f:
        return f.read()

if __name__ == '__main__':
    # Debug mode enabled in production
    app.run(debug=True, host='0.0.0.0')
`;

	// Create vulnerable JavaScript code
	const vulnerableJavaScript = `// Example code with security vulnerabilities

const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();

// XSS vulnerability
app.get('/search', (req, res) => {
    const query = req.query.q;
    // Vulnerable to XSS
    res.send(\`<h1>Search results for: \${query}</h1>\`);
});

// Command injection
app.get('/execute', (req, res) => {
    const cmd = req.query.cmd;
    // Vulnerable to command injection
    exec(cmd, (error, stdout) => {
        res.send(stdout);
    });
});

// Insecure random number generation
function generateToken() {
    // Math.random() is not cryptographically secure
    return Math.random().toString(36).substr(2);
}

// Hardcoded secrets
const SECRET_KEY = 'supersecret123';
const DB_PASSWORD = 'password123';

// SQL injection
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;
    // Vulnerable to SQL injection
    const query = \`SELECT * FROM users WHERE id = \${userId}\`;
    // db.query(query);
});

// Prototype pollution
function merge(target, source) {
    for (let key in source) {
        // Vulnerable to prototype pollution
        target[key] = source[key];
    }
}

// Weak encryption
function encrypt(data) {
    // Using deprecated algorithm
    const cipher = crypto.createCipher('des', 'password');
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

app.listen(3000);
`;

	// Create configuration file with vulnerabilities
	const vulnerableConfig = `# Application Configuration

# Database settings
database:
  host: localhost
  port: 5432
  username: admin
  password: admin123  # Hardcoded password
  
# API Keys
api:
  github_token: ghp_1234567890abcdef  # Exposed token
  aws_access_key: AKIAIOSFODNN7EXAMPLE  # AWS credentials
  aws_secret_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  
# Security settings
security:
  debug_mode: true  # Debug enabled in production
  allow_all_origins: true  # CORS misconfiguration
  session_secret: "change_me"  # Weak secret
  
# File paths
paths:
  upload_directory: /tmp/uploads  # Insecure temporary directory
  log_file: /var/log/app.log
  
# Network settings
server:
  bind: 0.0.0.0  # Binding to all interfaces
  port: 8080
  ssl: false  # No encryption
`;

	await executor.createDirectory("/home/vercel-sandbox/security-scan");
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/security-scan/vulnerable.py",
			content: vulnerablePython,
		},
		{
			path: "/home/vercel-sandbox/security-scan/vulnerable.js",
			content: vulnerableJavaScript,
		},
		{
			path: "/home/vercel-sandbox/security-scan/config.yml",
			content: vulnerableConfig,
		},
	]);
	console.log("   ✅ Vulnerable code samples created");

	// Example 3: Run semgrep security scan
	console.log("\n3. Running semgrep security scan:");

	// Run semgrep with auto config
	const semgrepScan = await executor.executeScript(
		"cd /home/vercel-sandbox/security-scan && semgrep --config=auto --json . 2>/dev/null | jq -r '.results[] | \"[\\(.check_id)] \\(.path):\\(.start.line) - \\(.extra.message)\"' | head -10",
	);
	console.log("   Semgrep findings:");
	if (semgrepScan.stdout.trim()) {
		console.log(semgrepScan.stdout);
	} else {
		// Run without JSON parsing as fallback
		const semgrepText = await executor.executeScript(
			"cd /home/vercel-sandbox/security-scan && semgrep --config=auto . 2>&1 | grep -E 'Running|Findings|vulnerable.py|vulnerable.js' | head -20",
		);
		console.log(semgrepText.stdout);
	}

	// Example 4: Run bandit for Python security
	console.log("\n4. Running bandit Python security scan:");

	const banditScan = await executor.executeScript(
		"cd /home/vercel-sandbox/security-scan && bandit -r vulnerable.py -f txt 2>/dev/null | grep -E 'Severity:|Issue:|Location:' | head -15",
	);
	console.log("   Bandit findings:");
	console.log(banditScan.stdout || "   Running bandit scan...");

	// Example 5: Create custom security scanner
	console.log("\n5. Creating custom security scanner:");

	const customScanner = `#!/usr/bin/env python3
# Custom security scanner for common vulnerabilities

import os
import re
import json
import sys

class SecurityScanner:
    def __init__(self):
        self.vulnerabilities = []
        self.patterns = {
            'hardcoded_password': {
                'pattern': r'(?i)(password|passwd|pwd)\s*=\s*["\']([^"\']+)["\']',
                'severity': 'HIGH',
                'message': 'Hardcoded password detected'
            },
            'api_key': {
                'pattern': r'(?i)(api_key|apikey|secret_key|access_token)\s*=\s*["\']([^"\']+)["\']',
                'severity': 'HIGH',
                'message': 'Exposed API key or secret'
            },
            'sql_injection': {
                'pattern': r'(?i)(query|sql)\s*=.*f["\'].*{.*}|\.format\(|%\s*\(',
                'severity': 'CRITICAL',
                'message': 'Potential SQL injection vulnerability'
            },
            'command_injection': {
                'pattern': r'(?i)(os\.system|subprocess\.|exec\(|eval\()',
                'severity': 'CRITICAL',
                'message': 'Potential command injection vulnerability'
            },
            'weak_crypto': {
                'pattern': r'(?i)(md5|sha1|des|rc4)\s*\(',
                'severity': 'MEDIUM',
                'message': 'Weak cryptographic algorithm used'
            },
            'debug_mode': {
                'pattern': r'(?i)debug\s*=\s*true|debug.*enabled',
                'severity': 'MEDIUM',
                'message': 'Debug mode enabled'
            },
            'insecure_bind': {
                'pattern': r'0\.0\.0\.0|bind.*all.*interfaces',
                'severity': 'LOW',
                'message': 'Service binding to all interfaces'
            }
        }
    
    def scan_file(self, filepath):
        """Scan a single file for vulnerabilities"""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            for line_num, line in enumerate(content.split('\\n'), 1):
                for vuln_type, config in self.patterns.items():
                    if re.search(config['pattern'], line):
                        self.vulnerabilities.append({
                            'file': filepath,
                            'line': line_num,
                            'type': vuln_type,
                            'severity': config['severity'],
                            'message': config['message'],
                            'code': line.strip()[:80] + '...' if len(line.strip()) > 80 else line.strip()
                        })
        except Exception as e:
            print(f"Error scanning {filepath}: {e}")
    
    def scan_directory(self, directory):
        """Scan all files in a directory"""
        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith(('.py', '.js', '.yml', '.yaml', '.conf', '.config')):
                    filepath = os.path.join(root, file)
                    self.scan_file(filepath)
    
    def generate_report(self):
        """Generate security scan report"""
        print("=" * 60)
        print("SECURITY SCAN REPORT")
        print("=" * 60)
        print(f"Total vulnerabilities found: {len(self.vulnerabilities)}")
        print()
        
        # Group by severity
        by_severity = {}
        for vuln in self.vulnerabilities:
            severity = vuln['severity']
            if severity not in by_severity:
                by_severity[severity] = []
            by_severity[severity].append(vuln)
        
        # Print by severity
        for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            if severity in by_severity:
                print(f"\\n[{severity}] {len(by_severity[severity])} vulnerabilities:")
                for vuln in by_severity[severity][:5]:  # Show first 5 of each
                    print(f"  - {vuln['file']}:{vuln['line']}")
                    print(f"    {vuln['message']}")
                    print(f"    Code: {vuln['code']}")
                if len(by_severity[severity]) > 5:
                    print(f"    ... and {len(by_severity[severity]) - 5} more")

# Run scanner
if __name__ == "__main__":
    scanner = SecurityScanner()
    scan_dir = sys.argv[1] if len(sys.argv) > 1 else "/home/vercel-sandbox/security-scan"
    
    print(f"Scanning directory: {scan_dir}")
    scanner.scan_directory(scan_dir)
    scanner.generate_report()
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/custom-scanner.py",
			content: customScanner,
		},
	]);

	const customScanResult = await executor.runCommand("python3", [
		"/home/vercel-sandbox/custom-scanner.py",
		"/home/vercel-sandbox/security-scan",
	]);
	console.log("   Custom scanner output:");
	console.log(customScanResult.stdout);

	// Example 6: Log analysis for security
	console.log("\n6. Security log analysis:");

	// Create sample log file with security events
	const sampleLogs = `2024-01-15 10:23:45 INFO User login successful: user=admin ip=192.168.1.100
2024-01-15 10:24:12 WARNING Failed login attempt: user=admin ip=10.0.0.5
2024-01-15 10:24:15 WARNING Failed login attempt: user=admin ip=10.0.0.5
2024-01-15 10:24:18 WARNING Failed login attempt: user=admin ip=10.0.0.5
2024-01-15 10:24:21 ERROR Brute force detected: user=admin ip=10.0.0.5 attempts=3
2024-01-15 10:25:00 INFO File upload: file=document.pdf user=john size=2048KB
2024-01-15 10:25:30 WARNING SQL injection attempt detected: ip=185.220.101.45 payload="' OR '1'='1"
2024-01-15 10:26:00 ERROR Unauthorized access attempt: path=/admin/config ip=45.155.205.233
2024-01-15 10:26:15 INFO User logout: user=admin
2024-01-15 10:27:00 WARNING Port scan detected: source_ip=162.142.125.217 ports=22,80,443,3306
2024-01-15 10:27:30 ERROR Malware upload blocked: file=virus.exe hash=a1b2c3d4e5f6
2024-01-15 10:28:00 WARNING XSS attempt: ip=104.248.144.120 payload="<script>alert('xss')</script>"
2024-01-15 10:28:30 INFO Security scan completed: vulnerabilities=0
2024-01-15 10:29:00 ERROR DDoS attack detected: source_ips=multiple requests_per_second=1000
2024-01-15 10:30:00 WARNING Suspicious process: name=cryptominer pid=12345 cpu=98%`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/security.log",
			content: sampleLogs,
		},
	]);

	// Create log analyzer script
	const logAnalyzer = `#!/bin/bash
# Security log analyzer

LOG_FILE="/home/vercel-sandbox/security.log"

echo "🔍 Security Log Analysis"
echo "======================="
echo "Log file: $LOG_FILE"
echo "Analysis time: $(date)"
echo ""

# Count security events by type
echo "📊 Security Event Summary:"
echo "  Total events: $(wc -l < "$LOG_FILE")"
echo "  Errors: $(grep -c ERROR "$LOG_FILE")"
echo "  Warnings: $(grep -c WARNING "$LOG_FILE")"
echo "  Info: $(grep -c INFO "$LOG_FILE")"
echo ""

# Identify critical security events
echo "🚨 Critical Security Events:"
grep -E "ERROR|CRITICAL" "$LOG_FILE" | while read -r line; do
    echo "  - $line"
done
echo ""

# Suspicious IPs
echo "🌐 Suspicious IP Addresses:"
grep -oE "ip=([0-9]{1,3}\\.){3}[0-9]{1,3}" "$LOG_FILE" | sort | uniq -c | sort -rn | head -5 | while read count ip; do
    echo "  - \${ip#ip=} (\${count} events)"
done
echo ""

# Attack patterns
echo "⚔️  Detected Attack Patterns:"
echo "  - Brute force attempts: $(grep -c "Brute force" "$LOG_FILE")"
echo "  - SQL injection attempts: $(grep -c "SQL injection" "$LOG_FILE")"
echo "  - XSS attempts: $(grep -c "XSS attempt" "$LOG_FILE")"
echo "  - Port scans: $(grep -c "Port scan" "$LOG_FILE")"
echo "  - DDoS attacks: $(grep -c "DDoS attack" "$LOG_FILE")"
echo "  - Malware uploads: $(grep -c "Malware" "$LOG_FILE")"
echo ""

# Time-based analysis
echo "⏰ Events by Hour:"
awk '{print $2}' "$LOG_FILE" | cut -d: -f1 | sort | uniq -c | while read count hour; do
    echo "  - Hour $hour: $count events"
done
echo ""

# Generate recommendations
echo "💡 Security Recommendations:"
if grep -q "Failed login attempt" "$LOG_FILE"; then
    echo "  - Enable account lockout after multiple failed login attempts"
fi
if grep -q "SQL injection" "$LOG_FILE"; then
    echo "  - Implement parameterized queries and input validation"
fi
if grep -q "Port scan" "$LOG_FILE"; then
    echo "  - Configure firewall rules to block port scanning"
fi
if grep -q "DDoS attack" "$LOG_FILE"; then
    echo "  - Consider implementing rate limiting and DDoS protection"
fi
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/log-analyzer.sh",
			content: logAnalyzer,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/log-analyzer.sh"]);

	const logAnalysisResult = await executor.runCommand("bash", ["/home/vercel-sandbox/log-analyzer.sh"]);
	console.log("   Log analysis output:");
	console.log(logAnalysisResult.stdout);

	// Example 7: Security hardening script
	console.log("\n7. Creating security hardening checklist:");

	const hardeningScript = `#!/bin/bash
# Security hardening checklist

echo "🛡️  Security Hardening Checklist"
echo "================================"
echo ""

# Function to check status
check_status() {
    if [ $1 -eq 0 ]; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
    fi
}

echo "1. System Security Checks:"

# Check for system updates
echo -n "   - System updates: "
if command -v dnf &> /dev/null; then
    updates=$(dnf check-update 2>/dev/null | grep -c "updates")
    if [ "$updates" -eq 0 ]; then
        echo "✅ System is up to date"
    else
        echo "❌ $updates updates available"
    fi
else
    echo "⚠️  Package manager not found"
fi

# Check SSH configuration (if exists)
echo -n "   - SSH hardening: "
if [ -f /etc/ssh/sshd_config ]; then
    if grep -q "PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
        echo "✅ Root login disabled"
    else
        echo "❌ Root login may be enabled"
    fi
else
    echo "⚠️  SSH config not found"
fi

# Check for open ports
echo -n "   - Open ports: "
open_ports=$(ss -tuln 2>/dev/null | grep LISTEN | wc -l)
echo "$open_ports listening services found"

echo ""
echo "2. File System Security:"

# Check for world-writable files
echo -n "   - World-writable files: "
writable=$(find /home/vercel-sandbox -type f -perm -002 2>/dev/null | wc -l)
if [ "$writable" -eq 0 ]; then
    echo "✅ None found"
else
    echo "⚠️  $writable files found"
fi

# Check for SUID/SGID files
echo -n "   - SUID/SGID files: "
suid_files=$(find /home/vercel-sandbox -type f \\( -perm -4000 -o -perm -2000 \\) 2>/dev/null | wc -l)
echo "$suid_files files with special permissions"

echo ""
echo "3. Application Security:"

# Check for common vulnerabilities in code
echo -n "   - Hardcoded secrets: "
secrets=$(grep -r -E "(password|api_key|secret)" /home/vercel-sandbox/security-scan 2>/dev/null | grep -v "Binary" | wc -l)
if [ "$secrets" -gt 0 ]; then
    echo "❌ $secrets potential secrets found"
else
    echo "✅ None found"
fi

echo -n "   - Insecure functions: "
insecure=$(grep -r -E "(eval\\(|exec\\(|system\\()" /home/vercel-sandbox/security-scan 2>/dev/null | grep -v "Binary" | wc -l)
if [ "$insecure" -gt 0 ]; then
    echo "❌ $insecure insecure functions found"
else
    echo "✅ None found"
fi

echo ""
echo "4. Security Best Practices:"
echo "   ☐ Enable firewall and configure rules"
echo "   ☐ Implement strong password policies"
echo "   ☐ Enable audit logging"
echo "   ☐ Regular security updates"
echo "   ☐ Implement intrusion detection"
echo "   ☐ Regular security scans"
echo "   ☐ Backup and disaster recovery plan"
echo "   ☐ Security awareness training"

echo ""
echo "📋 Report generated: $(date)"
`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/security-hardening.sh",
			content: hardeningScript,
		},
	]);

	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/security-hardening.sh"]);

	const hardeningResult = await executor.runCommand("bash", ["/home/vercel-sandbox/security-hardening.sh"]);
	console.log("   Security hardening checklist:");
	console.log(hardeningResult.stdout);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	securityToolsExamples().catch(console.error);
}
