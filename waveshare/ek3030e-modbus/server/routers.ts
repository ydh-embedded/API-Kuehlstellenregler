import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

// ─── Modbus Bridge URL ────────────────────────────────────────────────────────
const BRIDGE_URL = process.env.MODBUS_BRIDGE_URL ?? "http://127.0.0.1:8502";

// ─── Hilfsfunktion: Bridge-Anfrage ────────────────────────────────────────────
async function bridgeFetch(
  path: string,
  params: Record<string, string | number>,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${BRIDGE_URL}${path}?${qs}`;

  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : {},
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Bridge HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── Zod-Schemas ──────────────────────────────────────────────────────────────
const GatewayConfigSchema = z.object({
  ip: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  deviceId: z.number().int().min(1).max(247),
});

const WriteSettingsSchema = GatewayConfigSchema.extend({
  onTempCooling: z.number().optional(),
  offTempCooling: z.number().optional(),
  defrostTime: z.number().int().optional(),
  defrostCycle: z.number().int().optional(),
});

// ─── Modbus-Router ────────────────────────────────────────────────────────────
const modbusRouter = router({
  /** Alle Register lesen */
  readAll: publicProcedure
    .input(GatewayConfigSchema)
    .query(async ({ input }) => {
      try {
        const data = await bridgeFetch("/read", {
          ip: input.ip,
          port: input.port,
          device_id: input.deviceId,
        });
        return { ok: true, data } as const;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: `Bridge nicht erreichbar: ${msg}. Bitte starten Sie modbus_bridge.py.`,
          data: null,
        } as const;
      }
    }),

  /** Einstellungsregister schreiben */
  writeSettings: publicProcedure
    .input(WriteSettingsSchema)
    .mutation(async ({ input }) => {
      const settings: Record<string, number> = {};
      if (input.onTempCooling !== undefined)
        settings.on_temp_cooling = input.onTempCooling;
      if (input.offTempCooling !== undefined)
        settings.off_temp_cooling = input.offTempCooling;
      if (input.defrostTime !== undefined)
        settings.defrost_time = input.defrostTime;
      if (input.defrostCycle !== undefined)
        settings.defrost_cycle = input.defrostCycle;

      try {
        const result = await bridgeFetch(
          "/write",
          { ip: input.ip, port: input.port, device_id: input.deviceId },
          { method: "POST", body: settings }
        ) as { success?: boolean; error?: string };
        if (result.success === false) {
          return { ok: false, error: result.error ?? "Schreibvorgang fehlgeschlagen", result: null } as const;
        }
        return { ok: true, result } as const;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: `Schreibfehler: ${msg}`,
          result: null,
        } as const;
      }
    }),

  /** Verbindungstest */
  testConnection: publicProcedure
    .input(GatewayConfigSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await bridgeFetch("/test", {
          ip: input.ip,
          port: input.port,
          device_id: input.deviceId,
        });
        return { ok: true, result } as const;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: `Verbindungstest fehlgeschlagen: ${msg}`,
          result: null,
        } as const;
      }
    }),
});

// ─── App-Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  modbus: modbusRouter,
});

export type AppRouter = typeof appRouter;
