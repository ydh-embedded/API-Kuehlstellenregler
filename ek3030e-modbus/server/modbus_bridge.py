#!/usr/bin/env python3
"""
EK-3030E Modbus TCP Bridge
Stellt HTTP-Endpunkte bereit, über die das Node.js-Backend
Holding-Register lesen und schreiben kann.

Starten: python3 modbus_bridge.py [--port 8502]
"""

import argparse
import json
import logging
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

try:
    from pymodbus.client import ModbusTcpClient
    from pymodbus.exceptions import ModbusException
    PYMODBUS_AVAILABLE = True
except ImportError:
    PYMODBUS_AVAILABLE = False
    logging.warning("pymodbus nicht installiert – Simulation-Modus aktiv")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("modbus_bridge")


# ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

def decode_temperature(raw: int) -> float:
    """Unsigned 16-Bit → Temperatur mit Vorzeichen (Zweierkomplement)."""
    if raw > 32767:
        raw -= 65536
    return raw / 10.0


def encode_temperature(value: float) -> int:
    """Temperatur (float) → unsigned 16-Bit Modbus-Wert."""
    raw = round(value * 10)
    if raw < 0:
        raw += 65536
    return raw & 0xFFFF


def get_client(ip: str, port: int):
    if not PYMODBUS_AVAILABLE:
        return None
    client = ModbusTcpClient(ip, port=port)
    return client


# ─── Modbus-Operationen ───────────────────────────────────────────────────────

def read_all_registers(ip: str, port: int, device_id: int) -> dict:
    """Liest alle relevanten Register des EK-3030E."""
    if not PYMODBUS_AVAILABLE:
        # Simulationsdaten für Entwicklung ohne echtes Gerät
        return {
            "connected": True,
            "simulated": True,
            "cabinet_temp": -18.5,
            "defrost_temp": 8.2,
            "sw_version": 105,
            "on_temp_cooling": -20.0,
            "off_temp_cooling": -18.0,
            "defrost_time": 30,
            "defrost_cycle": 8,
            "relay_status": 0b00000101,
            "alarm_status": 0,
            "device_status": 1,
        }

    client = get_client(ip, port)
    try:
        if not client.connect():
            return {"connected": False, "error": f"Verbindung zu {ip}:{port} fehlgeschlagen"}

        data = {"connected": True, "simulated": False}

        # Block 1: Messwerte 0x0100–0x0102
        r = client.read_holding_registers(0x0100, count=3, device_id=device_id)
        if r.isError():
            return {"connected": False, "error": f"Lesefehler Block 1: {r}"}
        data["cabinet_temp"] = decode_temperature(r.registers[0])
        data["defrost_temp"] = decode_temperature(r.registers[1])
        data["sw_version"] = r.registers[2]
        time.sleep(0.15)

        # Block 2: Einstellungen 0x0400–0x0405
        r = client.read_holding_registers(0x0400, count=6, device_id=device_id)
        if r.isError():
            return {"connected": False, "error": f"Lesefehler Block 2: {r}"}
        data["on_temp_cooling"] = decode_temperature(r.registers[0])
        data["off_temp_cooling"] = decode_temperature(r.registers[1])
        data["defrost_time"] = r.registers[4]
        data["defrost_cycle"] = r.registers[5]
        time.sleep(0.15)

        # Block 3: Status 0x0800–0x0802
        r = client.read_holding_registers(0x0800, count=3, device_id=device_id)
        if r.isError():
            return {"connected": False, "error": f"Lesefehler Block 3: {r}"}
        data["relay_status"] = r.registers[0]
        data["alarm_status"] = r.registers[2]
        time.sleep(0.15)

        # Block 4: Gerätestatus 0x0A00
        r = client.read_holding_registers(0x0A00, count=1, device_id=device_id)
        if r.isError():
            return {"connected": False, "error": f"Lesefehler Block 4: {r}"}
        data["device_status"] = r.registers[0]

        return data

    except ModbusException as e:
        return {"connected": False, "error": f"Modbus-Ausnahme: {e}"}
    except Exception as e:
        return {"connected": False, "error": f"Unbekannter Fehler: {e}"}
    finally:
        client.close()


def write_settings(ip: str, port: int, device_id: int, settings: dict) -> dict:
    """
    Schreibt Einstellungsregister.
    settings-Keys: on_temp_cooling, off_temp_cooling, defrost_time, defrost_cycle
    """
    if not PYMODBUS_AVAILABLE:
        return {"success": True, "simulated": True, "written": settings}

    client = get_client(ip, port)
    try:
        if not client.connect():
            return {"success": False, "error": f"Verbindung zu {ip}:{port} fehlgeschlagen"}

        written = {}

        if "on_temp_cooling" in settings:
            val = encode_temperature(float(settings["on_temp_cooling"]))
            r = client.write_register(0x0400, val, device_id=device_id)
            if r.isError():
                return {"success": False, "error": f"Schreibfehler 0x0400: {r}"}
            written["on_temp_cooling"] = settings["on_temp_cooling"]
            time.sleep(0.1)

        if "off_temp_cooling" in settings:
            val = encode_temperature(float(settings["off_temp_cooling"]))
            r = client.write_register(0x0401, val, device_id=device_id)
            if r.isError():
                return {"success": False, "error": f"Schreibfehler 0x0401: {r}"}
            written["off_temp_cooling"] = settings["off_temp_cooling"]
            time.sleep(0.1)

        if "defrost_time" in settings:
            val = int(settings["defrost_time"])
            r = client.write_register(0x0404, val, device_id=device_id)
            if r.isError():
                return {"success": False, "error": f"Schreibfehler 0x0404: {r}"}
            written["defrost_time"] = val
            time.sleep(0.1)

        if "defrost_cycle" in settings:
            val = int(settings["defrost_cycle"])
            r = client.write_register(0x0405, val, device_id=device_id)
            if r.isError():
                return {"success": False, "error": f"Schreibfehler 0x0405: {r}"}
            written["defrost_cycle"] = val

        return {"success": True, "simulated": False, "written": written}

    except ModbusException as e:
        return {"success": False, "error": f"Modbus-Ausnahme: {e}"}
    except Exception as e:
        return {"success": False, "error": f"Unbekannter Fehler: {e}"}
    finally:
        client.close()


def test_connection(ip: str, port: int, device_id: int) -> dict:
    """Testet die Verbindung zum Gateway."""
    if not PYMODBUS_AVAILABLE:
        return {"connected": True, "simulated": True}

    client = get_client(ip, port)
    try:
        if not client.connect():
            return {"connected": False, "error": f"Verbindung zu {ip}:{port} fehlgeschlagen"}
        r = client.read_holding_registers(0x0102, count=1, device_id=device_id)
        if r.isError():
            return {"connected": False, "error": f"Gerät antwortet nicht: {r}"}
        return {"connected": True, "simulated": False, "sw_version": r.registers[0]}
    except Exception as e:
        return {"connected": False, "error": str(e)}
    finally:
        client.close()


# ─── HTTP-Handler ─────────────────────────────────────────────────────────────

class ModbusHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        logger.info(fmt % args)

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _parse_params(self) -> dict:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        return {k: v[0] for k, v in qs.items()}

    def do_GET(self):
        parsed = urlparse(self.path)
        params = self._parse_params()

        ip = params.get("ip", "192.168.1.200")
        port = int(params.get("port", "502"))
        device_id = int(params.get("device_id", "7"))

        if parsed.path == "/read":
            result = read_all_registers(ip, port, device_id)
            self._send_json(result)
        elif parsed.path == "/test":
            result = test_connection(ip, port, device_id)
            self._send_json(result)
        else:
            self._send_json({"error": "Unbekannter Endpunkt"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        params = self._parse_params()

        ip = params.get("ip", "192.168.1.200")
        port = int(params.get("port", "502"))
        device_id = int(params.get("device_id", "7"))

        if parsed.path == "/write":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                settings = json.loads(body)
            except json.JSONDecodeError:
                self._send_json({"success": False, "error": "Ungültiges JSON"}, 400)
                return
            result = write_settings(ip, port, device_id, settings)
            self._send_json(result)
        else:
            self._send_json({"error": "Unbekannter Endpunkt"}, 404)


# ─── Einstiegspunkt ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EK-3030E Modbus HTTP Bridge")
    parser.add_argument("--port", type=int, default=8502, help="HTTP-Port (Standard: 8502)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind-Adresse (Standard: 127.0.0.1)")
    args = parser.parse_args()

    logger.info(f"Starte Modbus-Bridge auf http://{args.host}:{args.port}")
    logger.info(f"pymodbus verfügbar: {PYMODBUS_AVAILABLE}")
    server = HTTPServer((args.host, args.port), ModbusHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Bridge beendet.")
