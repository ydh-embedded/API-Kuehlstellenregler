import { createContext, useContext, useState, ReactNode } from "react";

export interface GatewayConfig {
  ip: string;
  port: number;
  deviceId: number;
}

const DEFAULT_CONFIG: GatewayConfig = {
  ip: "192.168.1.200",
  port: 502,
  deviceId: 7,
};

const STORAGE_KEY = "ek3030e-gateway-config";

function loadConfig(): GatewayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

interface GatewayContextValue {
  config: GatewayConfig;
  setConfig: (cfg: GatewayConfig) => void;
}

const GatewayContext = createContext<GatewayContextValue>({
  config: DEFAULT_CONFIG,
  setConfig: () => {},
});

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<GatewayConfig>(loadConfig);

  const setConfig = (cfg: GatewayConfig) => {
    setConfigState(cfg);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  };

  return (
    <GatewayContext.Provider value={{ config, setConfig }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  return useContext(GatewayContext);
}
