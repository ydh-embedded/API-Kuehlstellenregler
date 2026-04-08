import { GatewayConfig, useGateway } from "@/contexts/GatewayContext";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Network,
  Save,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function GatewayConfigPage() {
  const { config, setConfig } = useGateway();
  const [form, setForm] = useState<GatewayConfig>({ ...config });
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    swVersion?: number;
  } | null>(null);

  const testMutation = trpc.modbus.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.ok && (data.result as { connected?: boolean })?.connected) {
        const r = data.result as { connected: boolean; sw_version?: number; simulated?: boolean };
        setTestResult({
          ok: true,
          message: r.simulated
            ? "Simulation aktiv – kein echtes Gerät erreichbar."
            : "Verbindung erfolgreich hergestellt.",
          swVersion: r.sw_version,
        });
        toast.success("Verbindungstest erfolgreich");
      } else {
        const r = data.result as { error?: string } | null;
        setTestResult({
          ok: false,
          message:
            (r as { error?: string } | null)?.error ??
            data.error ??
            "Gerät nicht erreichbar",
        });
        toast.error("Verbindungstest fehlgeschlagen");
      }
    },
    onError: (err) => {
      setTestResult({ ok: false, message: err.message });
      toast.error("Bridge nicht erreichbar");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfig(form);
    setTestResult(null);
    toast.success("Gateway-Konfiguration gespeichert");
  };

  const handleTest = () => {
    setTestResult(null);
    testMutation.mutate({
      ip: form.ip,
      port: form.port,
      deviceId: form.deviceId,
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Gateway-Konfiguration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verbindungsparameter für den Modbus-TCP-Gateway
        </p>
      </div>

      {/* Aktuelle Konfiguration */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Aktive Konfiguration
        </p>
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-accent" />
          <span className="text-sm font-mono text-foreground">
            {config.ip}:{config.port}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">Device-ID {config.deviceId}</span>
        </div>
      </div>

      {/* Formular */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          {/* IP-Adresse */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="ip">
              Gateway IP-Adresse
            </label>
            <input
              id="ip"
              type="text"
              value={form.ip}
              onChange={(e) => setForm((p) => ({ ...p, ip: e.target.value }))}
              placeholder="192.168.1.200"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              IP-Adresse des Modbus-TCP-Gateways (z. B. Ewon Flexy, Moxa, etc.)
            </p>
          </div>

          {/* Port */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="port">
              Port
            </label>
            <input
              id="port"
              type="number"
              value={form.port}
              onChange={(e) => setForm((p) => ({ ...p, port: parseInt(e.target.value, 10) || 502 }))}
              min={1}
              max={65535}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              Standard-Modbus-Port: 502. Im Gateway-Webinterface unter „Device Port" konfigurierbar.
            </p>
          </div>

          {/* Device-ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="deviceId">
              Device-ID (Slave-Adresse)
            </label>
            <input
              id="deviceId"
              type="number"
              value={form.deviceId}
              onChange={(e) => setForm((p) => ({ ...p, deviceId: parseInt(e.target.value, 10) || 1 }))}
              min={1}
              max={247}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              Modbus-Slave-Adresse des EK-3030E (Parameter H17 am Gerät). Standard: 7.
            </p>
          </div>
        </div>

        {/* Test-Ergebnis */}
        {testResult && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              testResult.ok
                ? "border-accent/40 bg-accent/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`text-sm font-semibold ${
                  testResult.ok ? "text-accent" : "text-destructive"
                }`}
              >
                {testResult.ok ? "Verbindung OK" : "Verbindung fehlgeschlagen"}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  testResult.ok ? "text-accent/80" : "text-destructive/80"
                }`}
              >
                {testResult.message}
              </p>
              {testResult.swVersion !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  SW-Version: {testResult.swVersion}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Aktionsbuttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : testResult?.ok ? (
              <Wifi className="h-4 w-4 text-accent" />
            ) : testResult && !testResult.ok ? (
              <WifiOff className="h-4 w-4 text-destructive" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            {testMutation.isPending ? "Teste…" : "Verbindung testen"}
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Save className="h-4 w-4" />
            Konfiguration speichern
          </button>
        </div>
      </form>

      {/* Hinweise */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Voraussetzungen
        </p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            Python-Bridge starten:{" "}
            <code className="font-mono bg-muted px-1 rounded">
              python3 server/modbus_bridge.py
            </code>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            Gateway-Webinterface: Device Port auf <strong>502</strong> setzen
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            EK-3030E: Parameter <strong>H17</strong> auf <strong>1</strong> (Modbus aktiv)
          </li>
        </ul>
      </div>
    </div>
  );
}
