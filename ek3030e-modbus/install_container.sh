#!/usr/bin/env bash
# =============================================================================
#  EK-3030E Modbus Controller – Podman Container Setup
#  Verwendung: bash install_container.sh [OPTION]
#
#  Optionen:
#    install   Podman installieren (Debian/Ubuntu/Fedora/RHEL/Arch)
#    build     Container-Image bauen
#    start     Container starten
#    stop      Container stoppen
#    restart   Container neu starten
#    logs      Live-Logs anzeigen
#    status    Container-Status anzeigen
#    shell     Shell im laufenden Container öffnen
#    update    Image neu bauen und Container neu starten
#    uninstall Container und Image entfernen
#    help      Diese Hilfe anzeigen
#
#  Ohne Argument: install → build → start (vollständiger Erststart)
# =============================================================================

set -euo pipefail

# ── Konfiguration ─────────────────────────────────────────────────────────────
IMAGE_NAME="ek3030e-modbus"
CONTAINER_NAME="ek3030e-controller"
WEB_PORT="${WEB_PORT:-3000}"          # Externer Port für das Dashboard
BRIDGE_PORT="${BRIDGE_PORT:-8502}"    # Externer Port der Modbus-Bridge
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_section() { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}\n"; }

check_root_or_sudo() {
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        log_warn "Einige Befehle benötigen sudo-Rechte."
    fi
}

# ── Podman installieren ───────────────────────────────────────────────────────
install_podman() {
    log_section "Podman installieren"

    if command -v podman &>/dev/null; then
        log_ok "Podman ist bereits installiert: $(podman --version)"
        return 0
    fi

    log_info "Erkenne Betriebssystem..."

    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        OS_ID="${ID:-unknown}"
        OS_ID_LIKE="${ID_LIKE:-}"
    else
        OS_ID="unknown"
        OS_ID_LIKE=""
    fi

    case "$OS_ID" in
        ubuntu|debian|linuxmint|pop)
            log_info "Debian/Ubuntu erkannt – installiere Podman via apt..."
            sudo apt-get update -qq
            sudo apt-get install -y podman
            ;;
        fedora)
            log_info "Fedora erkannt – installiere Podman via dnf..."
            sudo dnf install -y podman
            ;;
        rhel|centos|rocky|almalinux)
            log_info "RHEL/CentOS erkannt – installiere Podman via dnf..."
            sudo dnf install -y podman
            ;;
        arch|manjaro|endeavouros)
            log_info "Arch Linux erkannt – installiere Podman via pacman..."
            sudo pacman -Sy --noconfirm podman
            ;;
        opensuse*|sles)
            log_info "openSUSE erkannt – installiere Podman via zypper..."
            sudo zypper install -y podman
            ;;
        *)
            # Fallback: prüfe ID_LIKE
            if echo "$OS_ID_LIKE" | grep -qiE "debian|ubuntu"; then
                log_info "Debian-basiertes System erkannt – installiere Podman via apt..."
                sudo apt-get update -qq
                sudo apt-get install -y podman
            elif echo "$OS_ID_LIKE" | grep -qiE "rhel|fedora"; then
                log_info "RHEL-basiertes System erkannt – installiere Podman via dnf..."
                sudo dnf install -y podman
            else
                log_error "Betriebssystem '$OS_ID' nicht automatisch unterstützt."
                echo ""
                echo "  Bitte Podman manuell installieren:"
                echo "  https://podman.io/getting-started/installation"
                exit 1
            fi
            ;;
    esac

    if command -v podman &>/dev/null; then
        log_ok "Podman erfolgreich installiert: $(podman --version)"
    else
        log_error "Podman-Installation fehlgeschlagen."
        exit 1
    fi
}

# ── Image bauen ───────────────────────────────────────────────────────────────
build_image() {
    log_section "Container-Image bauen"

    if ! command -v podman &>/dev/null; then
        log_error "Podman nicht gefunden. Bitte zuerst 'bash install_container.sh install' ausführen."
        exit 1
    fi

    log_info "Baue Image '${IMAGE_NAME}' aus: ${SCRIPT_DIR}"
    log_info "Das kann beim ersten Mal 3–5 Minuten dauern (npm install + Vite-Build)..."

    podman build \
        --tag "${IMAGE_NAME}:latest" \
        --file "${SCRIPT_DIR}/Dockerfile" \
        "${SCRIPT_DIR}"

    log_ok "Image '${IMAGE_NAME}:latest' erfolgreich gebaut."
    podman image inspect "${IMAGE_NAME}:latest" \
        --format "    Größe: {{.Size | printf \"%.0f\"}} Bytes" 2>/dev/null || true
}

# ── Container starten ─────────────────────────────────────────────────────────
start_container() {
    log_section "Container starten"

    # Bereits laufenden Container stoppen
    if podman container exists "${CONTAINER_NAME}" 2>/dev/null; then
        log_info "Entferne vorhandenen Container '${CONTAINER_NAME}'..."
        podman rm -f "${CONTAINER_NAME}" &>/dev/null || true
    fi

    # .env-Datei laden falls vorhanden
    ENV_FILE_ARG=""
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        log_info "Lade Umgebungsvariablen aus .env"
        ENV_FILE_ARG="--env-file=${SCRIPT_DIR}/.env"
    else
        log_warn "Keine .env gefunden – verwende Standard-Umgebungsvariablen."
        log_warn "Tipp: cp env.example.txt .env  und anpassen."
    fi

    log_info "Starte Container '${CONTAINER_NAME}'..."
    log_info "  Web-Dashboard: http://localhost:${WEB_PORT}"
    log_info "  Modbus-Bridge: http://localhost:${BRIDGE_PORT} (intern)"

    # Netzwerk-Modus host für direkten Modbus-TCP-Zugriff auf das lokale Netz
    podman run \
        --detach \
        --name "${CONTAINER_NAME}" \
        --network host \
        --restart unless-stopped \
        ${ENV_FILE_ARG} \
        --env PORT="${WEB_PORT}" \
        --env MODBUS_BRIDGE_PORT="${BRIDGE_PORT}" \
        --env MODBUS_BRIDGE_HOST="0.0.0.0" \
        --env MODBUS_BRIDGE_URL="http://127.0.0.1:${BRIDGE_PORT}" \
        "${IMAGE_NAME}:latest"

    # Kurz warten und Status prüfen
    sleep 3
    if podman container inspect "${CONTAINER_NAME}" \
            --format '{{.State.Status}}' 2>/dev/null | grep -q "running"; then
        log_ok "Container läuft."
        echo ""
        echo -e "  ${BOLD}Dashboard aufrufen:${NC}  http://localhost:${WEB_PORT}"
        echo ""
    else
        log_error "Container konnte nicht gestartet werden. Logs:"
        podman logs "${CONTAINER_NAME}" 2>&1 | tail -20
        exit 1
    fi
}

# ── Container stoppen ─────────────────────────────────────────────────────────
stop_container() {
    log_section "Container stoppen"
    if podman container exists "${CONTAINER_NAME}" 2>/dev/null; then
        podman stop "${CONTAINER_NAME}"
        log_ok "Container '${CONTAINER_NAME}' gestoppt."
    else
        log_warn "Container '${CONTAINER_NAME}' läuft nicht."
    fi
}

# ── Logs anzeigen ─────────────────────────────────────────────────────────────
show_logs() {
    log_section "Container-Logs (Strg+C zum Beenden)"
    podman logs -f "${CONTAINER_NAME}"
}

# ── Status anzeigen ───────────────────────────────────────────────────────────
show_status() {
    log_section "Container-Status"
    if podman container exists "${CONTAINER_NAME}" 2>/dev/null; then
        podman container inspect "${CONTAINER_NAME}" \
            --format "  Name:    {{.Name}}
  Status:  {{.State.Status}}
  Image:   {{.ImageName}}
  Gestartet: {{.State.StartedAt}}" 2>/dev/null || podman ps --filter "name=${CONTAINER_NAME}"
    else
        log_warn "Container '${CONTAINER_NAME}' existiert nicht."
    fi
}

# ── Shell öffnen ──────────────────────────────────────────────────────────────
open_shell() {
    log_section "Shell im Container öffnen"
    podman exec -it "${CONTAINER_NAME}" /bin/bash
}

# ── Update ────────────────────────────────────────────────────────────────────
update_container() {
    log_section "Container aktualisieren"
    build_image
    start_container
}

# ── Deinstallieren ────────────────────────────────────────────────────────────
uninstall() {
    log_section "Container und Image entfernen"
    if podman container exists "${CONTAINER_NAME}" 2>/dev/null; then
        podman rm -f "${CONTAINER_NAME}"
        log_ok "Container entfernt."
    fi
    if podman image exists "${IMAGE_NAME}:latest" 2>/dev/null; then
        podman rmi "${IMAGE_NAME}:latest"
        log_ok "Image entfernt."
    fi
    log_ok "Deinstallation abgeschlossen."
}

# ── Hilfe ─────────────────────────────────────────────────────────────────────
show_help() {
    cat <<EOF

${BOLD}EK-3030E Modbus Controller – Container-Verwaltung${NC}

${BOLD}Verwendung:${NC}
  bash install_container.sh [OPTION]

${BOLD}Optionen:${NC}
  (kein Argument)   Vollständiger Erststart: install → build → start
  install           Podman installieren (automatische OS-Erkennung)
  build             Container-Image aus Dockerfile bauen
  start             Container starten (Port ${WEB_PORT})
  stop              Container stoppen
  restart           Container neu starten
  logs              Live-Logs anzeigen (Strg+C zum Beenden)
  status            Container-Status anzeigen
  shell             Bash-Shell im laufenden Container öffnen
  update            Image neu bauen und Container neu starten
  uninstall         Container und Image entfernen
  help              Diese Hilfe anzeigen

${BOLD}Umgebungsvariablen (vor dem Start setzen):${NC}
  WEB_PORT=3000     Port des Web-Dashboards   (Standard: 3000)
  BRIDGE_PORT=8502  Port der Modbus-Bridge    (Standard: 8502)

${BOLD}Beispiele:${NC}
  bash install_container.sh                   # Erststart
  WEB_PORT=8080 bash install_container.sh     # Dashboard auf Port 8080
  bash install_container.sh logs              # Logs verfolgen
  bash install_container.sh shell             # Debug-Shell

${BOLD}Voraussetzungen am Gerät:${NC}
  • EK-3030E Parameter H17 = 1 (Modbus aktiv)
  • Gateway-Webinterface: Device Port = 502
  • Gateway-IP im Dashboard unter "Gateway-Konfiguration" eintragen

EOF
}

# ── Hauptprogramm ─────────────────────────────────────────────────────────────
main() {
    echo -e "\n${BOLD}${CYAN}EK-3030E Modbus Controller – Container-Setup${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    check_root_or_sudo

    local action="${1:-all}"

    case "$action" in
        install)    install_podman ;;
        build)      build_image ;;
        start)      start_container ;;
        stop)       stop_container ;;
        restart)    stop_container; start_container ;;
        logs)       show_logs ;;
        status)     show_status ;;
        shell)      open_shell ;;
        update)     update_container ;;
        uninstall)  uninstall ;;
        help|--help|-h) show_help ;;
        all)
            install_podman
            build_image
            start_container
            ;;
        *)
            log_error "Unbekannte Option: '$action'"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
