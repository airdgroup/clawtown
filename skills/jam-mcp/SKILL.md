---
name: jam-mcp
description: Connect and use the Jam MCP server to debug Jam recordings. Use when configuring Jam MCP in MCP clients (ChatGPT, Claude Desktop/Code, VS Code, Cursor, Windsurf, OpenCode), when analyzing Jam links with Jam MCP tools, or when troubleshooting Jam MCP access, permissions, or feature limits (for example, Instant Replay).
---

# Jam MCP

## Overview
Use Jam MCP to fetch and analyze Jam recordings, screenshots, console logs, and network data for debugging and collaboration.

## Quick start
1. Obtain a Jam link from the user (or record one in Jam).
2. Connect the MCP client to `https://mcp.jam.dev/mcp` and complete Jam OAuth sign-in.
3. Call `getDetails` on the Jam link to pull metadata and context.
4. Pull evidence with `getConsoleLogs`, `getNetworkRequests`, `getScreenshot`, and `analyzeVideo`.
5. Summarize findings and propose fixes; post back with `createComment` if requested.

## Connect Jam MCP
- Confirm access to the Jam workspace; Jam MCP is available for Jam Pro and trial accounts.
- Use the client’s MCP server setup to add the Jam endpoint and follow the Jam connect flow.
- Prefer Streamable HTTP when the client supports it; fall back to HTTP+SSE if required by the client.

## Tool guide
- `listJams`: Find recent or relevant Jams when the user does not provide a link.
- `getDetails`: Pull high-level metadata and context; call this first for any Jam link.
- `getConsoleLogs`: Filter logs with `logLevels`, `searchQuery`, and `inConsole` for errors or keywords.
- `getNetworkRequests`: Filter by `searchQuery`, `inHeaders`, `inResponse`, or `status` to find failing calls.
- `getScreenshot`: Grab a screenshot for UI/state inspection.
- `analyzeVideo`: Ask for a visual walkthrough of the issue when timing or repro matters.
- `listMembers` / `listFolders`: Find people or organization context for routing or filing.
- `createComment`: Post findings or next steps back to the Jam.
- `updateJam`: Update Jam metadata when asked (status, title, priority, etc.).

## Prompting patterns
- “Analyze this Jam link and summarize the probable root cause.”
- “List console errors and correlate them with the failing network requests.”
- “Find requests to `/api/*` with status 4xx/5xx and summarize response bodies.”
- “Capture a screenshot at the error moment and note visible UI state.”

## Limitations and troubleshooting
- For Instant Replay Jams, `getScreenshot` and `analyzeVideo` are unavailable.
- If tool calls fail with permission errors, verify the Jam link is accessible and the user is signed into the correct workspace.
- If the user has data-sensitivity constraints, confirm it is acceptable to send Jam data to Jam’s third-party model provider for analysis and summarization.
