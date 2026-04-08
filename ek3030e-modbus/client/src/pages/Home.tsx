import { useGateway } from "@/contexts/GatewayContext";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  Thermometer,
  Wind,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Typen ────────────────────────────────────────────────────────────────────
interface ModbusData {
  connected: boolean;
  simulated?: boolean;
  cabinet_temp?: number;
  defrost_temp?: number;
  sw_version?: number;
  on_temp_cooling?: number;
  off_temp_cooling?: number;
  defrost_time?: number;
  defrost_cycle?: number;
  relay_status?: number;
  alarm_status?: number;
  device_status?: number;
  error?: string;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function formatTemp(val: number | undefined): string {
  if (val === undefined) return "–";
  return `${val.toFixed(1)} °C`;
}

function getRelayBits(relay_status: number | undefined) {
  const s = relay_status ?? 0;
  return {
    compressor: !(s & 0x01),
    heater: !(s & 0x02),
    fan: !(s & 0x04),
  };
}

function getDeviceStatusLabel(status: number | undefined): string {
  switch (status) {
    case 0: return "Standby";
    case 1: return "Kühlen";
    case 2: return "Abtauen";
    case 3: return "Nachlauf";
    default: return status !== undefined ? `Code ${status}` : "–";
  }
}

// ─── Unterkomponenten ─────────────────────────────────────────────────────────
function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${accent ? "bg-accent/10" : "bg-muted"}`}>
          <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-muted-foreground"}`} />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function RelayIndicator({
  label,
  active,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  icon: React.ElementType;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
        active
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-muted/30"
      }`}
    >
      <div
        className={`relative h-3 w-3 rounded-full shrink-0 ${
          active ? "bg-accent" : "bg-muted-foreground/30"
        }`}
      >
        {active && (
          <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" />
        )}
      </div>
      <Icon
        className={`h-4 w-4 shrink-0 ${
          active ? "text-accent" : "text-muted-foreground/50"
        }`}
      />
      <span
        className={`text-sm font-medium ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
          active
            ? "bg-accent/20 text-accent"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {active ? "AN" : "AUS"}
      </span>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Home() {
  const { config } = useGateway();
  const [data, setData] = useState<ModbusData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const readQuery = trpc.modbus.readAll.useQuery(
    { ip: config.ip, port: config.port, deviceId: config.deviceId },
    {
      enabled: false,
      retry: false,
    }
  );

  const fetchData = async () => {
    const result = await readQuery.refetch();
    if (result.data?.ok && result.data.data) {
      setData(result.data.data as ModbusData);
      setLastUpdate(new Date());
    } else if (result.data && !result.data.ok) {
      setData({ connected: false, error: result.data.error });
    }
  };

  useEffect(() => {
    fetchData();
  }, [config]);

  useEffect(() => {
    if (isPolling) {
      intervalRef.current = setInterval(fetchData, 10000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPolling, config]);

  const relay = getRelayBits(data?.relay_status);
  const hasAlarm = (data?.alarm_status ?? 0) > 0;
  const isConnected = data?.connected === true;
  const isLoading = readQuery.isFetching;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Live-Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            EK-3030E · {config.ip}:{config.port} · Device-ID {config.deviceId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Verbindungsstatus */}
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
              data === null
                ? "border-border text-muted-foreground bg-muted/50"
                : isConnected
                ? "border-accent/40 text-accent bg-accent/10"
                : "border-destructive/40 text-destructive bg-destructive/10"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                data === null
                  ? "bg-muted-foreground"
                  : isConnected
                  ? "bg-accent"
                  : "bg-destructive"
              }`}
            />
            {data === null
              ? "Verbinde…"
              : isConnected
              ? data.simulated
                ? "Simulation"
                : "Verbunden"
              : "Getrennt"}
          </div>

          {/* Polling-Toggle */}
          <button
            onClick={() => setIsPolling(p => !p)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              isPolling
                ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Activity className={`h-3 w-3 ${isPolling ? "text-primary" : ""}`} />
            {isPolling ? "Polling aktiv" : "Polling pausiert"}
          </button>

          {/* Manuell aktualisieren */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Letzte Aktualisierung */}
      {lastUpdate && (
        <p className="text-xs text-muted-foreground -mt-4">
          Zuletzt aktualisiert: {lastUpdate.toLocaleTimeString("de-DE")}
          {data?.simulated && (
            <span className="ml-2 text-amber-600 font-medium">
              (Simulationsdaten – kein echtes Gerät)
            </span>
          )}
        </p>
      )}

      {/* ─── Fehleranzeige ─── */}
      {data && !isConnected && data.error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Verbindungsfehler</p>
            <p className="text-xs text-destructive/80 mt-1">{data.error}</p>
          </div>
        </div>
      )}

      {/* ─── Alarm-Banner ─── */}
      {hasAlarm && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-50 p-4 animate-pulse">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Alarm aktiv!</p>
            <p className="text-xs text-amber-700 mt-1">
              Alarm-Code:{" "}
              <span className="font-mono font-bold">
                {data?.alarm_status?.toString(2).padStart(8, "0")} (0x
                {data?.alarm_status?.toString(16).toUpperCase()})
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ─── Temperatur-Messwerte ─── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Messwerte
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Thermometer}
            label="Kühlraum-Temp."
            value={formatTemp(data?.cabinet_temp)}
            accent
          />
          <MetricCard
            icon={Thermometer}
            label="Abtau-Temp."
            value={formatTemp(data?.defrost_temp)}
          />
          <MetricCard
            icon={Thermometer}
            label="Einschalt-Temp."
            value={formatTemp(data?.on_temp_cooling)}
          />
          <MetricCard
            icon={Thermometer}
            label="Ausschalt-Temp."
            value={formatTemp(data?.off_temp_cooling)}
          />
        </div>
      </section>

      {/* ─── Betriebsparameter ─── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Betriebsparameter
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={Clock}
            label="Abtauzeit"
            value={data?.defrost_time !== undefined ? String(data.defrost_time) : "–"}
            unit="min"
          />
          <MetricCard
            icon={RefreshCw}
            label="Abtauzyklus"
            value={data?.defrost_cycle !== undefined ? String(data.defrost_cycle) : "–"}
            unit="h"
          />
          <MetricCard
            icon={Cpu}
            label="Gerätestatus"
            value={getDeviceStatusLabel(data?.device_status)}
          />
          <MetricCard
            icon={Activity}
            label="SW-Version"
            value={data?.sw_version !== undefined ? String(data.sw_version) : "–"}
          />
        </div>
      </section>

      {/* ─── Relais-Status ─── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Relais-Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RelayIndicator label="Kompressor" active={relay.compressor} icon={Zap} />
          <RelayIndicator label="Lüfter" active={relay.fan} icon={Wind} />
          <RelayIndicator label="Abtauheizung" active={relay.heater} icon={Thermometer} />
        </div>
      </section>

      {/* ─── Alarm-Status ─── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Alarm-Status
        </h2>
        <div
          className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${
            hasAlarm
              ? "border-amber-400/40 bg-amber-50"
              : "border-border bg-card"
          }`}
        >
          {hasAlarm ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
          )}
          <div>
            <p className={`text-sm font-semibold ${hasAlarm ? "text-amber-800" : "text-foreground"}`}>
              {hasAlarm ? "Alarm aktiv" : "Kein Alarm"}
            </p>
            {hasAlarm && (
              <p className="text-xs text-amber-700 mt-0.5 font-mono">
                Binär: {data?.alarm_status?.toString(2).padStart(8, "0")} · Hex: 0x
                {data?.alarm_status?.toString(16).toUpperCase().padStart(4, "0")}
              </p>
            )}
          </div>
          {data?.alarm_status !== undefined && (
            <span className="ml-auto text-xs text-muted-foreground font-mono">
              Register 0x0802 = {data.alarm_status}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
