# EK-3030E Modbus Controller – TODO

## Backend
- [x] Python-Modbus-Bridge-Skript (modbus_bridge.py) mit HTTP-Endpunkten für Read/Write
- [x] tRPC-Prozedur: modbus.readAll – alle Register lesen
- [x] tRPC-Prozedur: modbus.writeSettings – Einstellungen schreiben (0x0400–0x0405)
- [x] tRPC-Prozedur: modbus.testConnection – Verbindungstest
- [x] Gateway-Konfiguration (IP, Port, Device-ID) als Parameter übergeben

## Frontend
- [x] CSS-Theme aus pasted_content.txt (Deep Navy + Emerald) in index.css übernehmen
- [x] DashboardLayout mit Sidebar-Navigation einrichten
- [x] Dashboard-Seite: Live-Messwerte (Kühlraum-Temp, Abtau-Temp, SW-Version)
- [x] Relais-Status-Karten: Kompressor, Lüfter, Abtauheizung mit farbigen Indikatoren
- [x] Alarm-Anzeige mit Alarm-Code und visueller Hervorhebung
- [x] Gerätestatus-Anzeige
- [x] Automatisches Polling alle 10 Sekunden
- [x] Schreibformular: Einschalt-Temperatur, Ausschalt-Temperatur, Abtauzeit, Abtauzyklus
- [x] Gateway-Konfigurationsformular (IP, Port, Device-ID) im Frontend
- [x] Verbindungsstatus-Anzeige (verbunden/getrennt) mit Fehler-Feedback

## Tests
- [x] Vitest-Test für modbus.readAll-Prozedur
- [x] Vitest-Test für modbus.writeSettings-Prozedur

## Container-Setup
- [x] Dockerfile (Multi-Stage: Node.js Build + Python Runtime)
- [x] .dockerignore erstellen
- [x] supervisord.conf für Prozess-Management (Node.js + Python-Bridge)
- [x] install_container.sh – Podman-Installations- und Startskript
- [x] .env.example für Umgebungsvariablen (env.example.txt)

## Container-Bug-Fixes
- [x] Dockerfile: Alle fehlenden Env-Variablen (OAUTH_SERVER_URL, VITE_*, JWT_SECRET) mit Standardwerten belegen
- [x] Server: OAUTH_SERVER_URL-Pflichtprüfung für lokalen Betrieb deaktivierbar machen
- [x] Frontend: VITE_ANALYTICS_ENDPOINT Platzhalter-URL im Build ersetzen (Script-Tag entfernt)

## URL-Bug-Fix (Container)
- [x] tRPC-Client: URL-Fallback auf window.location.origin wenn VITE_FRONTEND_FORGE_API_URL leer
- [x] main.tsx / trpc.ts: Invalid-URL-Fehler bei leerem Forge-API-URL absichern
