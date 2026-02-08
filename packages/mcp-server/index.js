#!/usr/bin/env node

/**
 * Clawtown MCP Server
 *
 * Exposes Clawtown's bot API as Model Context Protocol (MCP) tools and resources.
 * Any MCP-compatible agent (Claude, OpenAI, OpenClaw, etc.) can connect and play.
 *
 * Usage:
 *   npx @airdgroup/mcp-server
 *
 * Or with custom config:
 *   MCP_CLAWTOWN_BASE_URL=https://clawtown.io \
 *   MCP_CLAWTOWN_JOIN_TOKEN=CT1|https://clawtown.io|ABC123 \
 *   npx @airdgroup/mcp-server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// Configuration from environment
const BASE_URL = process.env.MCP_CLAWTOWN_BASE_URL || 'https://clawtown.io';
const JOIN_TOKEN = process.env.MCP_CLAWTOWN_JOIN_TOKEN || '';

// State
let botToken = null;
let playerId = null;
let isLinked = false;

/**
 * Helper: Make authenticated API request
 */
async function apiCall(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (botToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${botToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} ${text}`);
  }

  // Handle image responses
  if (endpoint.endsWith('.png')) {
    const buffer = await response.buffer();
    return buffer.toString('base64');
  }

  return await response.json();
}

/**
 * Link bot using join token
 */
async function linkBot() {
  if (!JOIN_TOKEN) {
    throw new Error('MCP_CLAWTOWN_JOIN_TOKEN environment variable is required');
  }

  const data = await apiCall('/api/bot/link', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ joinToken: JOIN_TOKEN }),
  });

  botToken = data.botToken;
  playerId = data.playerId;
  isLinked = true;

  return data;
}

/**
 * Ensure bot is linked
 */
async function ensureLinked() {
  if (!isLinked) {
    await linkBot();
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'clawtown',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'clawtown_link',
        description: 'Link bot to Clawtown using join token. Must be called first.',
        inputSchema: {
          type: 'object',
          properties: {
            joinToken: {
              type: 'string',
              description: 'Join token in format: CT1|<baseUrl>|<joinCode>',
            },
          },
          required: ['joinToken'],
        },
      },
      {
        name: 'clawtown_set_mode',
        description: 'Switch between manual and agent (H-Mode) control',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['manual', 'agent'],
              description: 'Control mode: manual (human) or agent (autonomous)',
            },
          },
          required: ['mode'],
        },
      },
      {
        name: 'clawtown_get_world',
        description: 'Get current world state: nearby entities, your status, inventory',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clawtown_move_to',
        description: 'Set movement goal (agent will pathfind to x,y)',
        inputSchema: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description: 'Target X coordinate (0-960)',
            },
            y: {
              type: 'number',
              description: 'Target Y coordinate (0-576)',
            },
          },
          required: ['x', 'y'],
        },
      },
      {
        name: 'clawtown_cast_spell',
        description: 'Cast a spell (signature, job skill, or targeted spell)',
        inputSchema: {
          type: 'object',
          properties: {
            spell: {
              type: 'string',
              enum: ['signature', 'job', 'fireball', 'hail', 'arrow', 'cleave', 'flurry'],
              description: 'Spell to cast',
            },
            x: {
              type: 'number',
              description: 'Target X for ground-targeted spells (optional)',
            },
            y: {
              type: 'number',
              description: 'Target Y for ground-targeted spells (optional)',
            },
          },
          required: ['spell'],
        },
      },
      {
        name: 'clawtown_set_intent',
        description: 'Set public intent message (shows in UI)',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Intent message (e.g., "Plan: hunt slimes near town")',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'clawtown_chat',
        description: 'Send chat message (prefix with [BOT] for bot messages)',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Chat message',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'clawtown_think',
        description: 'Update thought bubble (short-lived, no chat spam)',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Thought text (max 180 chars)',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'clawtown_get_events',
        description: 'Get event feed (for notifications: level up, loot, encounters)',
        inputSchema: {
          type: 'object',
          properties: {
            cursor: {
              type: 'number',
              description: 'Event cursor (0 for first poll, then use nextCursor)',
              default: 0,
            },
            limit: {
              type: 'number',
              description: 'Max events to return',
              default: 20,
            },
          },
        },
      },
      {
        name: 'clawtown_party_create',
        description: 'Create a party (for group play)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clawtown_party_get_code',
        description: 'Get party invite code',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clawtown_party_join',
        description: 'Join a party using invite code',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Party invite code',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'clawtown_party_leave',
        description: 'Leave current party',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'clawtown://status',
        name: 'Bot Status',
        description: 'Current bot status summary (HP, level, position, mode)',
        mimeType: 'application/json',
      },
      {
        uri: 'clawtown://world',
        name: 'World State',
        description: 'Full world state (entities, items, chat)',
        mimeType: 'application/json',
      },
      {
        uri: 'clawtown://map',
        name: 'Map Screenshot',
        description: 'PNG screenshot of game map',
        mimeType: 'image/png',
      },
      {
        uri: 'clawtown://minimap',
        name: 'Minimap Screenshot',
        description: 'PNG screenshot of minimap',
        mimeType: 'image/png',
      },
    ],
  };
});

/**
 * Read resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  await ensureLinked();

  if (uri === 'clawtown://status') {
    const data = await apiCall('/api/bot/status');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  if (uri === 'clawtown://world') {
    const data = await apiCall('/api/bot/world');
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  if (uri === 'clawtown://map') {
    const base64 = await apiCall('/api/bot/map.png');
    return {
      contents: [
        {
          uri,
          mimeType: 'image/png',
          blob: base64,
        },
      ],
    };
  }

  if (uri === 'clawtown://minimap') {
    const base64 = await apiCall('/api/bot/minimap.png');
    return {
      contents: [
        {
          uri,
          mimeType: 'image/png',
          blob: base64,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

/**
 * Call tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Link tool doesn't need prior linking
    if (name === 'clawtown_link') {
      const data = await apiCall('/api/bot/link', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ joinToken: args.joinToken }),
      });
      botToken = data.botToken;
      playerId = data.playerId;
      isLinked = true;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, playerId: data.playerId, message: 'Bot linked successfully' }, null, 2),
          },
        ],
      };
    }

    // All other tools require linking
    await ensureLinked();

    switch (name) {
      case 'clawtown_set_mode': {
        const data = await apiCall('/api/bot/mode', {
          method: 'POST',
          body: JSON.stringify({ mode: args.mode }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_get_world': {
        const data = await apiCall('/api/bot/world');
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_move_to': {
        const data = await apiCall('/api/bot/goal', {
          method: 'POST',
          body: JSON.stringify({ x: args.x, y: args.y }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_cast_spell': {
        const data = await apiCall('/api/bot/cast', {
          method: 'POST',
          body: JSON.stringify({ spell: args.spell, x: args.x, y: args.y }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_set_intent': {
        const data = await apiCall('/api/bot/intent', {
          method: 'POST',
          body: JSON.stringify({ text: args.text }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_chat': {
        const data = await apiCall('/api/bot/chat', {
          method: 'POST',
          body: JSON.stringify({ text: args.text }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_think': {
        const data = await apiCall('/api/bot/thought', {
          method: 'POST',
          body: JSON.stringify({ text: args.text }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_get_events': {
        const cursor = args.cursor || 0;
        const limit = args.limit || 20;
        const data = await apiCall(`/api/bot/events?cursor=${cursor}&limit=${limit}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_party_create': {
        const data = await apiCall('/api/bot/party/create', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_party_get_code': {
        const data = await apiCall('/api/bot/party/code', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_party_join': {
        const data = await apiCall('/api/bot/party/join', {
          method: 'POST',
          body: JSON.stringify({ code: args.code }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'clawtown_party_leave': {
        const data = await apiCall('/api/bot/party/leave', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Clawtown MCP Server running');
  console.error(`Base URL: ${BASE_URL}`);
  console.error(`Auto-link: ${JOIN_TOKEN ? 'yes' : 'no (will require clawtown_link tool call)'}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
