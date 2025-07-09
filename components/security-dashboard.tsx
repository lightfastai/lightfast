'use client';

import { AlertCircle, CheckCircle, Info, Shield, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const securityCategories = [
    {
      title: 'Type Safety',
      icon: Shield,
      checks: [
        'No usage of "any" type',
        'Proper type guards implementation',
        'Strict null checks enabled',
        'No unsafe type assertions',
      ],
    },
    {
      title: 'Input Validation',
      icon: CheckCircle,
      checks: [
        'Schema validation for API inputs',
        'SQL injection prevention',
        'XSS protection measures',
        'Path traversal prevention',
      ],
    },
    {
      title: 'Authentication',
      icon: AlertCircle,
      checks: [
        'Secure JWT implementation',
        'Proper session management',
        'Strong password policies',
        'Multi-factor authentication',
      ],
    },
    {
      title: 'Data Protection',
      icon: Info,
      checks: [
        'Encryption at rest',
        'Secure API communications',
        'No hardcoded secrets',
        'Environment variable usage',
      ],
    },
  ];

  const bestPractices = [
    {
      category: 'TypeScript Configuration',
      recommendations: [
        {
          title: 'Enable Strict Mode',
          code: `{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}`,
          description: 'Enables all strict type-checking options for maximum safety.',
        },
        {
          title: 'Avoid Any Type',
          code: `// ❌ Bad
function processData(data: any) {
  return data.value; // No type safety
}

// ✅ Good
interface DataInput {
  value: string;
  timestamp: number;
}

function processData(data: DataInput) {
  return data.value; // Type-safe access
}`,
          description: 'Use specific types or generics instead of any.',
        },
      ],
    },
    {
      category: 'Input Validation',
      recommendations: [
        {
          title: 'Use Zod for Runtime Validation',
          code: `import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/),
  age: z.number().min(18).max(120),
});

// API Route
export async function POST(req: Request) {
  const body = await req.json();
  
  try {
    const validatedData = UserSchema.parse(body);
    // Process validated data safely
  } catch (error) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }
}`,
          description: 'Validate all external inputs with schema validation.',
        },
        {
          title: 'Prevent SQL Injection',
          code: `// ❌ Bad - SQL Injection vulnerable
const query = \`SELECT * FROM users WHERE id = \${userId}\`;

// ✅ Good - Using parameterized queries
import { sql } from '@vercel/postgres';

const result = await sql\`
  SELECT * FROM users WHERE id = \${userId}
\`;

// Or with Prisma
const user = await prisma.user.findUnique({
  where: { id: userId }
});`,
          description: 'Always use parameterized queries or ORMs.',
        },
      ],
    },
    {
      category: 'Authentication & Authorization',
      recommendations: [
        {
          title: 'Secure JWT Implementation',
          code: `import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

// Creating a secure JWT
export async function createToken(userId: string) {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .setNotBefore(Date.now() / 1000)
    .sign(secret);
}

// Verifying with proper error handling
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}`,
          description: 'Use secure JWT libraries with proper expiration and validation.',
        },
        {
          title: 'Type-Safe Middleware',
          code: `interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'admin' | 'user';
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  next: () => Promise<Response>
): Promise<Response> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const payload = await verifyToken(token);
    req.user = payload as AuthenticatedRequest['user'];
    return next();
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}`,
          description: 'Create type-safe authentication middleware.',
        },
      ],
    },
    {
      category: 'Error Handling',
      recommendations: [
        {
          title: 'Never Expose Internal Errors',
          code: `// ❌ Bad - Exposes internal details
try {
  await database.query(sql);
} catch (error) {
  return Response.json({ error: error.message }, { status: 500 });
}

// ✅ Good - Safe error messages
try {
  await database.query(sql);
} catch (error) {
  console.error('Database error:', error);
  
  // Log to monitoring service
  await logger.error('Database query failed', {
    error,
    query: sql,
    userId: req.user?.id,
  });
  
  return Response.json(
    { error: 'An error occurred processing your request' },
    { status: 500 }
  );
}`,
          description: 'Log errors internally but return safe messages to users.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {securityCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Card key={category.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{category.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1">
                  {category.checks.map((check) => (
                    <div key={check} className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="typescript">TypeScript</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Best Practices Overview</CardTitle>
              <CardDescription>
                Essential TypeScript security patterns for modern applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Type Safety First</h4>
                    <p className="text-sm text-muted-foreground">
                      Leverage TypeScript's type system to prevent runtime errors and security vulnerabilities.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Validate Everything</h4>
                    <p className="text-sm text-muted-foreground">
                      Never trust user input. Always validate and sanitize data at runtime.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Avoid Common Pitfalls</h4>
                    <p className="text-sm text-muted-foreground">
                      Stay away from eval(), any type, and other dangerous patterns.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {bestPractices.map((section) => (
          <TabsContent
            key={section.category}
            value={section.category.toLowerCase().split(' ')[0]}
            className="space-y-4"
          >
            {section.recommendations.map((rec) => (
              <Card key={rec.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{rec.title}</CardTitle>
                  <CardDescription>{rec.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                    <code className="text-sm">{rec.code}</code>
                  </pre>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Run Security Analysis</CardTitle>
          <CardDescription>
            Use our AI-powered security agent to analyze your TypeScript code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => window.location.href = '/investigation'}
            className="w-full"
          >
            <Shield className="mr-2 h-4 w-4" />
            Start Security Analysis
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}