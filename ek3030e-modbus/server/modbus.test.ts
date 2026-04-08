import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock fetch ───────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const GATEWAY = { ip: "192.168.1.200", port: 502, deviceId: 7 };

// ─── Hilfsfunktion: fetch-Mock aufsetzen ─────────────────────────────────────
function mockBridgeResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    text: async () => JSON.stringify(data),
    json: async () => data,
  } as Response);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("modbus.readAll", () => {
  beforeEach(() => mockFetch.mockReset());

  it("gibt ok:true mit Gerätedaten zurück wenn Bridge antwortet", async () => {
    const payload = {
      connected: true,
      simulated: true,
      cabinet_temp: -18.5,
      defrost_temp: 8.2,
      relay_status: 5,
      alarm_status: 0,
      device_status: 1,
    };
    mockBridgeResponse(payload);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.modbus.readAll(GATEWAY);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ connected: true, cabinet_temp: -18.5 });
  });

  it("gibt ok:false zurück wenn Bridge nicht erreichbar ist", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.modbus.readAll(GATEWAY);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Bridge nicht erreichbar");
  });
});

describe("modbus.writeSettings", () => {
  beforeEach(() => mockFetch.mockReset());

  it("gibt ok:true zurück bei erfolgreichem Schreibvorgang", async () => {
    mockBridgeResponse({ success: true, simulated: true, written: { on_temp_cooling: -20 } });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.modbus.writeSettings({
      ...GATEWAY,
      onTempCooling: -20,
    });

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    // POST-Methode prüfen
    expect(mockFetch.mock.calls[0][1]?.method).toBe("POST");
  });

  it("gibt ok:false zurück wenn Bridge nicht erreichbar ist", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.modbus.writeSettings({
      ...GATEWAY,
      defrostTime: 30,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Schreibfehler");
  });

  it("sendet nur aktivierte Felder an die Bridge", async () => {
    mockBridgeResponse({ success: true, written: { defrost_cycle: 8 } });

    const caller = appRouter.createCaller(createCtx());
    await caller.modbus.writeSettings({ ...GATEWAY, defrostCycle: 8 });

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body).toHaveProperty("defrost_cycle", 8);
    expect(body).not.toHaveProperty("on_temp_cooling");
  });
});

describe("modbus.testConnection", () => {
  beforeEach(() => mockFetch.mockReset());

  it("gibt ok:true zurück wenn Verbindungstest erfolgreich", async () => {
    mockBridgeResponse({ connected: true, simulated: true, sw_version: 105 });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.modbus.testConnection(GATEWAY);

    expect(result.ok).toBe(true);
  });

  it("gibt ok:false zurück bei Verbindungsfehler", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.modbus.testConnection(GATEWAY);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Verbindungstest fehlgeschlagen");
  });
});
