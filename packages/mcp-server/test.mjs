#!/usr/bin/env node

/**
 * MCP Server Test Suite
 *
 * Tests all 13 tools and 4 resources with a real Clawtown server.
 * Run: node test.mjs
 */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JOIN_TOKEN = process.env.TEST_JOIN_TOKEN || '';

let testsPassed = 0;
let testsFailed = 0;

function log(msg) {
  console.log(`[TEST] ${msg}`);
}

function pass(msg) {
  testsPassed++;
  console.log(`✅ PASS: ${msg}`);
}

function fail(msg, error) {
  testsFailed++;
  console.error(`❌ FAIL: ${msg}`);
  if (error) console.error(`   Error: ${error.message || error}`);
}

/**
 * Test helper: Send JSON-RPC request to MCP server
 */
async function mcpRequest(method, params) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {},
    };

    const proc = spawn('node', ['./index.js'], {
      cwd: '/Users/hejianzhi/Namecard/github/clawtown/packages/mcp-server',
      env: {
        ...process.env,
        MCP_CLAWTOWN_BASE_URL: BASE_URL,
        MCP_CLAWTOWN_JOIN_TOKEN: JOIN_TOKEN,
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      } else {
        try {
          // Parse JSON-RPC response from stdout
          const lines = stdout.split('\n').filter(Boolean);
          const response = JSON.parse(lines[lines.length - 1]);
          resolve(response);
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      }
    });

    // Send request via stdin
    proc.stdin.write(JSON.stringify(request) + '\n');
    proc.stdin.end();

    // Timeout after 10s
    setTimeout(() => {
      proc.kill();
      reject(new Error('Request timeout'));
    }, 10000);
  });
}

/**
 * Test Suite
 */

async function testInitialize() {
  log('Testing: Initialize MCP server');
  try {
    const response = await mcpRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    });

    if (response.result && response.result.serverInfo) {
      pass('Initialize: Server responded with serverInfo');
    } else {
      fail('Initialize: Missing serverInfo in response');
    }
  } catch (err) {
    fail('Initialize', err);
  }
}

async function testListTools() {
  log('Testing: List tools');
  try {
    const response = await mcpRequest('tools/list');

    if (response.result && Array.isArray(response.result.tools)) {
      const toolCount = response.result.tools.length;
      if (toolCount >= 13) {
        pass(`List tools: Found ${toolCount} tools`);
      } else {
        fail(`List tools: Expected >=13 tools, got ${toolCount}`);
      }

      // Verify key tools exist
      const toolNames = response.result.tools.map(t => t.name);
      const requiredTools = [
        'clawtown_link',
        'clawtown_set_mode',
        'clawtown_get_world',
        'clawtown_move_to',
        'clawtown_cast_spell',
        'clawtown_chat',
      ];

      for (const tool of requiredTools) {
        if (toolNames.includes(tool)) {
          pass(`List tools: ${tool} exists`);
        } else {
          fail(`List tools: Missing required tool ${tool}`);
        }
      }
    } else {
      fail('List tools: Invalid response format');
    }
  } catch (err) {
    fail('List tools', err);
  }
}

async function testListResources() {
  log('Testing: List resources');
  try {
    const response = await mcpRequest('resources/list');

    if (response.result && Array.isArray(response.result.resources)) {
      const resourceCount = response.result.resources.length;
      if (resourceCount >= 4) {
        pass(`List resources: Found ${resourceCount} resources`);
      } else {
        fail(`List resources: Expected >=4 resources, got ${resourceCount}`);
      }

      // Verify key resources exist
      const resourceUris = response.result.resources.map(r => r.uri);
      const requiredResources = [
        'clawtown://status',
        'clawtown://world',
        'clawtown://map',
        'clawtown://minimap',
      ];

      for (const uri of requiredResources) {
        if (resourceUris.includes(uri)) {
          pass(`List resources: ${uri} exists`);
        } else {
          fail(`List resources: Missing required resource ${uri}`);
        }
      }
    } else {
      fail('List resources: Invalid response format');
    }
  } catch (err) {
    fail('List resources', err);
  }
}

async function testToolInputSchemas() {
  log('Testing: Tool input schemas');
  try {
    const response = await mcpRequest('tools/list');
    const tools = response.result.tools;

    for (const tool of tools) {
      if (!tool.inputSchema) {
        fail(`Tool ${tool.name}: Missing inputSchema`);
        continue;
      }

      if (tool.inputSchema.type !== 'object') {
        fail(`Tool ${tool.name}: inputSchema.type should be 'object'`);
        continue;
      }

      pass(`Tool ${tool.name}: Has valid inputSchema`);
    }
  } catch (err) {
    fail('Tool input schemas', err);
  }
}

/**
 * Integration Tests (require live server)
 */

async function testLinkTool() {
  if (!JOIN_TOKEN) {
    log('Skipping link test: No JOIN_TOKEN provided');
    return;
  }

  log('Testing: clawtown_link tool');
  try {
    const response = await mcpRequest('tools/call', {
      name: 'clawtown_link',
      arguments: {
        joinToken: JOIN_TOKEN,
      },
    });

    if (response.result && response.result.content) {
      const content = response.result.content[0];
      const result = JSON.parse(content.text);

      if (result.success && result.playerId) {
        pass('Link tool: Successfully linked bot');
      } else {
        fail('Link tool: Response missing success or playerId');
      }
    } else {
      fail('Link tool: Invalid response format');
    }
  } catch (err) {
    fail('Link tool', err);
  }
}

async function testGetWorldTool() {
  if (!JOIN_TOKEN) {
    log('Skipping get_world test: No JOIN_TOKEN provided');
    return;
  }

  log('Testing: clawtown_get_world tool');
  try {
    const response = await mcpRequest('tools/call', {
      name: 'clawtown_get_world',
      arguments: {},
    });

    if (response.result && response.result.content) {
      const content = response.result.content[0];
      const world = JSON.parse(content.text);

      if (world.you && Array.isArray(world.entities)) {
        pass('Get world tool: Returned valid world state');
      } else {
        fail('Get world tool: Missing you or entities in response');
      }
    } else {
      fail('Get world tool: Invalid response format');
    }
  } catch (err) {
    fail('Get world tool', err);
  }
}

async function testStatusResource() {
  if (!JOIN_TOKEN) {
    log('Skipping status resource test: No JOIN_TOKEN provided');
    return;
  }

  log('Testing: clawtown://status resource');
  try {
    const response = await mcpRequest('resources/read', {
      uri: 'clawtown://status',
    });

    if (response.result && response.result.contents) {
      const content = response.result.contents[0];
      const status = JSON.parse(content.text);

      if (status.hp !== undefined && status.level !== undefined) {
        pass('Status resource: Returned valid status');
      } else {
        fail('Status resource: Missing hp or level in response');
      }
    } else {
      fail('Status resource: Invalid response format');
    }
  } catch (err) {
    fail('Status resource', err);
  }
}

/**
 * Run all tests
 */

async function runTests() {
  console.log('\n=== MCP Server Test Suite ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Join Token: ${JOIN_TOKEN ? '✓ Provided' : '✗ Not provided (some tests will skip)'}\n`);

  // Basic tests (no server required)
  await testInitialize();
  await testListTools();
  await testListResources();
  await testToolInputSchemas();

  // Integration tests (require live server + join token)
  if (JOIN_TOKEN) {
    await sleep(1000);
    await testLinkTool();
    await sleep(1000);
    await testGetWorldTool();
    await sleep(1000);
    await testStatusResource();
  }

  // Summary
  console.log('\n=== Test Summary ===\n');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}\n`);

  if (testsFailed > 0) {
    console.log('❌ Some tests failed. Please review errors above.\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
