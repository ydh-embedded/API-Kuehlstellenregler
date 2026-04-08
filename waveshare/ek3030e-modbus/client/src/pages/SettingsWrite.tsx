import { useGateway } from "@/contexts/GatewayContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Loader2, Save, Sliders } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FormValues {
  onTempCooling: string;
  offTempCooling: string;
  defrostTime: string;
  defrostCycle: string;
}

interface FieldMeta {
  key: keyof FormValues;
  label: string;
  register: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  isInt: boolean;
  description: string;
}

const FIELDS: FieldMeta[] = [
  {
    key: "onTempCooling",
    label: "Einschalt-Temperatur",
    register: "0x0400",
    unit: "°C",
    min: -50,
    max: 30,
    step: 0.1,
    isInt: false,
    description: "Temperatur, bei der die Kühlung einschaltet",
  },
  {
    key: "offTempCooling",
    label: "Ausschalt-Temperatur",
    register: "0x0401",
    unit: "°C",
    min: -50,
    max: 30,
    step: 0.1,
    isInt: false,
    description: "Temperatur, bei der die Kühlung ausschaltet",
  },
  {
    key: "defrostTime",
    label: "Abtauzeit",
    register: "0x0404",
    unit: "min",
    min: 1,
    max: 120,
    step: 1,
    isInt: true,
    description: "Maximale Abtaudauer in Minuten",
  },
  {
    key: "defrostCycle",
    label: "Abtauzyklus",
    register: "0x0405",
    unit: "h",
    min: 1,
    max: 24,
    step: 1,
    isInt: true,
    description: "Zeitintervall zwischen zwei Abtauvorgängen in Stunden",
  },
];

export default function SettingsWrite() {
  const { config } = useGateway();
  const [form, setForm] = useState<FormValues>({
    onTempCooling: "",
    offTempCooling: "",
    defrostTime: "",
    defrostCycle: "",
  });
  const [enabled, setEnabled] = useState<Record<keyof FormValues, boolean>>({
    onTempCooling: false,
    offTempCooling: false,
    defrostTime: false,
    defrostCycle: false,
  });
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const writeMutation = trpc.modbus.writeSettings.useMutation({
    onSuccess: (data) => {
      if (data.ok) {
        setResult({ ok: true, message: "Einstellungen erfolgreich geschrieben." });
        toast.success("Einstellungen gespeichert");
      } else {
        setResult({ ok: false, message: data.error ?? "Unbekannter Fehler" });
        toast.error("Schreibfehler");
      }
    },
    onError: (err) => {
      setResult({ ok: false, message: err.message });
      toast.error("Verbindungsfehler");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const payload: {
      ip: string;
      port: number;
      deviceId: number;
      onTempCooling?: number;
      offTempCooling?: number;
      defrostTime?: number;
      defrostCycle?: number;
    } = {
      ip: config.ip,
      port: config.port,
      deviceId: config.deviceId,
    };

    let hasAny = false;
    for (const field of FIELDS) {
      if (!enabled[field.key]) continue;
      const raw = form[field.key].trim();
      if (!raw) continue;
      const val = field.isInt ? parseInt(raw, 10) : parseFloat(raw);
      if (isNaN(val)) {
        toast.error(`Ungültiger Wert für ${field.label}`);
        return;
      }
      (payload as Record<string, unknown>)[field.key] = val;
      hasAny = true;
    }

    if (!hasAny) {
      toast.warning("Bitte mindestens einen Wert aktivieren und eingeben.");
      return;
    }

    writeMutation.mutate(payload);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Einstellungen schreiben
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modbus-Register direkt beschreiben · {config.ip}:{config.port} · Device-ID {config.deviceId}
        </p>
      </div>

      {/* Hinweis */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <Sliders className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Aktivieren Sie die gewünschten Register mit dem Schalter und geben Sie den neuen Wert ein.
          Nur aktivierte Felder werden an den Regler übertragen.
        </p>
      </div>

      {/* Formular */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className={`rounded-xl border transition-all ${
              enabled[field.key]
                ? "border-accent/40 bg-card shadow-sm"
                : "border-border bg-muted/20"
            }`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {field.label}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {field.register}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {field.description}
                  </p>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled[field.key]}
                  onClick={() =>
                    setEnabled((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    enabled[field.key] ? "bg-accent" : "bg-input"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                      enabled[field.key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Eingabefeld */}
              {enabled[field.key] && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={form[field.key]}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      placeholder={`${field.min} … ${field.max}`}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                    />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground w-8 text-right">
                    {field.unit}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Bereich: {field.min} … {field.max}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Ergebnis-Feedback */}
        {result && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              result.ok
                ? "border-accent/40 bg-accent/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${result.ok ? "text-accent" : "text-destructive"}`}>
              {result.message}
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={writeMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
          {writeMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {writeMutation.isPending ? "Schreibe…" : "Einstellungen übertragen"}
        </button>
      </form>
    </div>
  );
}
