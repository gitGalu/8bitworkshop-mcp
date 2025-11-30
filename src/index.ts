import { randomUUID } from "node:crypto";
import { Console } from "console";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import WebSocket, { RawData } from "ws";

const DEFAULT_WS_URL = process.env.ATARI_WS_URL ?? "ws://localhost:8765";
const CPU_HZ = 1_789_773;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class WsRpcClient {
  private socket: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly url: string,
    private readonly logger: Console = console,
    private readonly reconnectDelayMs = 2000,
    private readonly callTimeoutMs = 5000,
  ) {
    this.connect();
  }

  private connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.logger.info(`[bridge] attempting connection to ${this.url}`);
    this.socket = new WebSocket(this.url);
    this.socket.on("open", () => {
      this.logger.info("[bridge] connected");
    });
    this.socket.on("message", (data: RawData) => this.handleMessage(data));
    this.socket.on("close", () => {
      this.logger.warn("[bridge] connection closed");
      this.rejectAllPending(new Error("Emulator bridge disconnected"));
      this.socket = null;
      this.scheduleReconnect();
    });
    this.socket.on("error", (err: Error) => {
      this.logger.error("[bridge] socket error", err);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectDelayMs);
  }

  private isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.isConnected()) {
      throw new Error("Emulator bridge is not connected");
    }
    const id = randomUUID();
    const payload = JSON.stringify({ id, method, params: params ?? {} });
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC ${method} timed out`));
      }, this.callTimeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
      });
      this.socket?.send(payload, (err?: Error | null) => {
        if (err) {
          const pending = this.pending.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(id);
          }
          reject(err);
        }
      });
    });
  }

  private handleMessage(raw: RawData) {
    const text = typeof raw === "string" ? raw : raw.toString();
    let message: any;
    try {
      message = JSON.parse(text);
    } catch (err) {
      this.logger.warn("[bridge] received invalid JSON", err);
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      const msg = typeof message.error?.message === "string" ? message.error.message : "Unknown bridge error";
      pending.reject(new Error(msg));
    } else {
      pending.resolve(message.result);
    }
  }

  private rejectAllPending(error: Error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function respond(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function registerTools(server: McpServer, client: WsRpcClient) {
  server.tool("emulator_reset", async () => {
    await client.call("reset");
    return respond("Emulator reset");
  });

  const loadRomSchema = {
    path: z.string().min(1).optional(),
    bytes_b64: z.string().min(1).optional(),
    autorun: z.boolean().optional(),
  };
  server.tool("emulator_load_rom", loadRomSchema, async (input) => {
    if (!input.path && !input.bytes_b64) {
      throw new Error("Provide either path or bytes_b64");
    }
    const params = {
      path: input.path,
      bytesB64: input.bytes_b64,
      autorun: input.autorun,
    };
    const result = await client.call("loadRom", params);
    return respond(result);
  });

  const runSchema = {
    ms: z.number().positive().optional(),
    cycles: z.number().int().positive().optional(),
  };
  server.tool("emulator_run", runSchema, async (input) => {
    if (typeof input.ms !== "number" && typeof input.cycles !== "number") {
      throw new Error("Provide ms or cycles");
    }
    const cycles = input.cycles ?? Math.max(1, Math.round((input.ms ?? 0) * CPU_HZ / 1000));
    const result = await client.call("runCycles", { cycles });
    return respond(result);
  });

  const stepSchema = {
    count: z.number().int().positive().optional(),
  };
  server.tool("emulator_step", stepSchema, async (input) => {
    const result = await client.call("step", { count: input.count ?? 1 });
    return respond(result);
  });

  server.tool("emulator_get_state", async () => {
    const state = await client.call("getState");
    return respond(state);
  });

  server.tool("emulator_save_state", async () => {
    const state = await client.call("getState");
    return respond(state);
  });

  const loadStateSchema = {
    state: z.any(),
  };
  server.tool("emulator_load_state", loadStateSchema, async (input) => {
    const result = await client.call("loadState", { state: input.state });
    return respond(result);
  });

  const readMemSchema = {
    addr: z.number().int().min(0).max(0xffff),
    length: z.number().int().positive().max(0x10000),
  };
  server.tool("emulator_read_mem", readMemSchema, async (input) => {
    const result = await client.call("readMem", input);
    return respond(result);
  });

  const writeMemSchema = {
    addr: z.number().int().min(0).max(0xffff),
    bytes_b64: z.string().min(1),
  };
  server.tool("emulator_write_mem", writeMemSchema, async (input) => {
    const result = await client.call("writeMem", { addr: input.addr, bytesB64: input.bytes_b64 });
    return respond(result);
  });

  const readIoSchema = {
    addr: z.number().int().min(0).max(0xffff),
  };
  server.tool("emulator_read_io", readIoSchema, async (input) => {
    const result = await client.call("readIO", input);
    return respond(result);
  });

  const writeIoSchema = {
    addr: z.number().int().min(0).max(0xffff),
    value: z.number().int().min(0).max(0xff),
  };
  server.tool("emulator_write_io", writeIoSchema, async (input) => {
    const result = await client.call("writeIO", input);
    return respond(result);
  });

  const breakpointSchema = {
    addr: z.number().int().min(0).max(0xffff),
  };
  server.tool("emulator_set_breakpoint", breakpointSchema, async (input) => {
    const result = await client.call("setBreakpoint", input);
    return respond(result);
  });
  server.tool("emulator_clear_breakpoint", breakpointSchema, async (input) => {
    const result = await client.call("clearBreakpoint", input);
    return respond(result);
  });

  const traceSchema = {
    last_n: z.number().int().positive().optional(),
  };
  server.tool("emulator_get_trace", traceSchema, async (input) => {
    const result = await client.call("getTrace", { lastN: input.last_n });
    return respond(result);
  });

  server.tool("emulator_screenshot", async () => {
    const shot = await client.call("screenshot");
    return respond(shot);
  });

  const sendKeySchema = {
    key_code: z.number().int().optional(),
    char_code: z.number().int().optional(),
    down: z.boolean().optional(),
    shift: z.boolean().optional(),
    ctrl: z.boolean().optional(),
    alt: z.boolean().optional(),
    meta: z.boolean().optional(),
    flags: z.number().int().optional(),
  };
  server.tool("emulator_send_key", sendKeySchema, async (input) => {
    const result = await client.call("sendKey", input);
    return respond(result);
  });

  const setJoystickSchema = {
    port: z.number().int().min(0).max(3),
    mask: z.number().int().min(0).max(0xff),
  };
  server.tool("emulator_set_joystick", setJoystickSchema, async (input) => {
    const result = await client.call("setJoystick", input);
    return respond(result);
  });
}

async function main() {
  const stderrLogger = new Console({ stdout: process.stderr, stderr: process.stderr });
  const client = new WsRpcClient(DEFAULT_WS_URL, stderrLogger);
  const server = new McpServer({
    name: "8bitworkshop-mcp",
    version: "0.1.0",
  });
  registerTools(server, client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
