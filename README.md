# 8bitworkshop MCP Server

This package exposes the Atari 8-bit emulator controls from the 8bitworkshop WebSocket bridge as a Model Context Protocol (MCP) server over stdio.  It mirrors the RPC methods from the in-browser bridge as MCP tools.

## Prerequisites

- Node.js 18+
- A running Atari bridge. Either:
  - Start the headless bridge: `cd ../8bitworkshop && npm run atari-bridge`, or
  - Keep the original dev server + browser bridge running and point `ATARI_WS_URL` to it.

## Configuration

- `ATARI_WS_URL` (optional): WebSocket URL for the Atari bridge. Defaults to `ws://localhost:8765`.

## Setup & Usage

```bash
cd 8bitworkshop-mcp
npm install
npm run build
node dist/index.js
```

Once the server is running, attach it to an MCP-compatible client (e.g., MCP Inspector). The server will automatically reconnect to the Atari bridge if the WebSocket drops.

## Available Tools

**Control**
- `emulator_reset`, `emulator_load_rom`, `emulator_run`, `emulator_step`
- `emulator_send_key({ key_code?, char_code?, down?, shift?, ctrl?, alt?, meta?, flags? })`
- `emulator_set_joystick({ port, mask })`

**State**
- `emulator_get_state` (full snapshot)
- `emulator_save_state` (alias of `get_state`)
- `emulator_load_state({ state })`

**Memory / I/O**
- `emulator_read_mem({ addr, length })`, `emulator_write_mem({ addr, bytes_b64 })`
- `emulator_read_io({ addr })`, `emulator_write_io({ addr, value })`

**Debug**
- `emulator_set_breakpoint({ addr })`, `emulator_clear_breakpoint({ addr })`
- `emulator_get_trace({ last_n? })`

**Visualization**
- `emulator_screenshot()`

All byte payloads (ROMs, snapshots, memory reads, screenshots) use base64 strings.
