/**
 * Health Check Controller
 * 
 * Provides health check endpoint for monitoring and load balancers.
 */

import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  
  @Get()
  getHealth() {
    return {
      status: 'ok',
      backend: 'nestjs',
      timestamp: new Date().toISOString(),
      version: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      architecture: {
        framework: 'NestJS',
        runtime: 'Node.js',
        platform: process.platform,
        arch: process.arch,
      },
    };
  }
}