#!/usr/bin/env node

/**
 * Test script for Node.js runtime bundling with complex dependencies
 * This demonstrates bundling ExaJS (~45MB) into a Vercel-deployable agent bundle
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testNodeJSBundling() {
  console.log('🧪 Testing Node.js Runtime Bundling with ExaJS');
  console.log('================================================\n');
  
  try {
    // Import the enhanced bundler from built CLI
    const { BundleGenerator, createNodeJSBundleGenerator } = await import('../../core/compiler/dist/bundler.js');
    const { transpileConfig } = await import('../../core/compiler/dist/transpiler.js');
    
    console.log('✅ Successfully imported bundler and transpiler');
    
    console.log('📝 Transpiling lightfast.config.ts...');
    
    // Transpile the Lightfast config using the function API
    const transpileResult = await transpileConfig(join(__dirname, 'lightfast.config.ts'), {
      baseDir: __dirname
    });
    
    if (transpileResult.errors.length > 0) {
      console.error('❌ Transpilation errors:');
      transpileResult.errors.forEach(error => console.error('  -', error));
      return;
    }
    
    console.log('✅ Transpilation successful');
    console.log(`   Code size: ${(transpileResult.code.length / 1024).toFixed(1)}KB`);
    
    // Check for ExaJS import
    if (transpileResult.code.includes('exa-js')) {
      console.log('✅ ExaJS dependency detected in transpiled code');
    } else {
      console.warn('⚠️  ExaJS dependency not found in transpiled code');
    }
    
    // Initialize the Node.js bundle generator
    const bundler = new BundleGenerator({
      baseDir: __dirname,
      outputDir: join(__dirname, '.lightfast'),
      compilerVersion: '0.1.0'
    });
    
    console.log('\n🔧 Generating Node.js runtime bundle...');
    
    // Generate Node.js bundle with full dependency bundling
    const nodeJSBundle = await bundler.generateNodeJSBundle(
      transpileResult,
      'researcher', // Agent ID
      {
        bundleAllDependencies: true,
        target: 'vercel',
        minify: false, // Keep readable for testing
        runtime: 'nodejs20.x'
      }
    );
    
    console.log('\n✅ Node.js bundle generation completed!');
    console.log('📊 Bundle Statistics:');
    console.log(`   Bundle ID: ${nodeJSBundle.id}`);
    console.log(`   File: ${nodeJSBundle.filename}`);
    console.log(`   Size: ${(nodeJSBundle.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Runtime: ${nodeJSBundle.runtime}`);
    console.log(`   Dependencies: ${nodeJSBundle.dependencies.join(', ')}`);
    console.log(`   Hash: ${nodeJSBundle.hash}`);
    
    // Check if ExaJS is properly bundled
    if (nodeJSBundle.dependencies.includes('exa-js')) {
      console.log('✅ ExaJS dependency successfully detected in bundle');
    }
    
    // Analyze bundle size
    const sizeMB = nodeJSBundle.size / 1024 / 1024;
    if (sizeMB < 10) {
      console.log('🚀 Bundle size is optimal for fast cold starts');
    } else if (sizeMB < 50) {
      console.log('✅ Bundle size is acceptable for Node.js runtime');
    } else if (sizeMB < 200) {
      console.log('⚠️  Large bundle - expect slower cold starts (~1-2s)');
    } else {
      console.log('🔥 Very large bundle - consider optimization');
    }
    
    console.log('\n📁 Bundle location:');
    console.log(`   ${nodeJSBundle.filepath}`);
    
    // Test bundle loading (without execution to avoid API calls)
    console.log('\n🔍 Testing bundle loading...');
    
    try {
      // Clear Node.js require cache
      delete require.cache[require.resolve(nodeJSBundle.filepath)];
      
      // Load the bundle
      const bundleModule = require(nodeJSBundle.filepath);
      console.log('✅ Bundle loaded successfully');
      
      // Check bundle structure
      if (typeof bundleModule === 'function') {
        console.log('✅ Bundle exports a function (direct execution)');
      } else if (bundleModule.handler) {
        console.log('✅ Bundle exports a handler function');
      } else if (bundleModule.POST) {
        console.log('✅ Bundle exports a POST handler (Vercel format)');
      } else {
        console.log('⚠️  Unknown bundle export format');
        console.log('   Available exports:', Object.keys(bundleModule));
      }
      
    } catch (loadError) {
      console.error('❌ Bundle loading failed:', loadError.message);
    }
    
    console.log('\n🎉 Node.js runtime bundling test completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Deploy to Vercel with Node.js runtime');
    console.log('   2. Test execution via POST /api/agents/execute/researcher');
    console.log('   3. Verify ExaJS functionality in production');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure dependencies are installed: npm install');
    console.error('   2. Ensure the CLI is built: cd ../../core/cli && npm run build');
    console.error('   3. Check that ExaJS is in package.json dependencies');
  }
}

// Handle Node.js vs module context
if (import.meta.url === `file://${process.argv[1]}`) {
  testNodeJSBundling().catch(console.error);
}

export { testNodeJSBundling };