#!/bin/bash
###############################################################################
# Runs ON THE SERVER (as root) - started by deploy-backend.sh, not by hand.
#
# Everything it touches is HVAC-Sim's own:
#   /opt/<name>                        code and Python venv
#   /var/lib/<name>                    SQLite session data
#   /etc/systemd/system/<name>.service
#   /etc/nginx/sites-available/<name>  (+ the sites-enabled link)
#   system user <name>
# where <name> is SERVICE_NAME from deploy.env.
# It never edits another service, venv or nginx site.
###############################################################################
set -euo pipefail

PORT="$1"
DOMAIN="$2"
ORIGINS="$3"
BUNDLE="$4"
NAME="$5"

[[ "$NAME" =~ ^[a-z][a-z0-9_-]{1,30}$ ]] || { echo "bad service name: $NAME" >&2; exit 1; }

APP="/opt/$NAME"
DATA="/var/lib/$NAME"
UNIT="/etc/systemd/system/$NAME.service"
SITE="/etc/nginx/sites-available/$NAME"
LINK="/etc/nginx/sites-enabled/$NAME"

say() { echo "  [server] $*"; }
die() { echo "  [server] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "must run as root (sudo)"
command -v python3 >/dev/null || die "python3 is not installed"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' \
    || die "Python 3.10 or newer is required; found $(python3 --version 2>&1)"
command -v nginx >/dev/null || die "nginx is not installed"

# Never take a port that something else is already using.
if ! systemctl is-active --quiet "$NAME" && ss -ltnH 2>/dev/null | grep -qE "[:.]${PORT}\s"; then
    die "port ${PORT} is already used by another program; choose a different APP_PORT"
fi

# Never reuse a hostname another nginx site already serves.
if [ ! -e "$SITE" ] && grep -rlsE "server_name[^;]*\b${DOMAIN//./\\.}\b" /etc/nginx/sites-enabled /etc/nginx/conf.d >/dev/null 2>&1; then
    die "${DOMAIN} is already served by another nginx site; choose a different API_DOMAIN"
fi

# Refuse to adopt a name that already belongs to something else on this server.
if [ ! -e "$APP/.hvac-sim-owned" ] && { [ -e "$UNIT" ] || [ -e "$SITE" ] || [ -e "$APP" ] || id "$NAME" >/dev/null 2>&1; }; then
    die "the name $NAME is already in use on this server (unit, nginx site, /opt folder or user); choose another SERVICE_NAME"
fi

id "$NAME" >/dev/null 2>&1 || {
    useradd --system --home-dir "$APP" --shell /usr/sbin/nologin "$NAME"
    say "created system user $NAME"
}
mkdir -p "$APP" "$DATA"
touch "$APP/.hvac-sim-owned"

# Unpack the new release beside the running one.
rm -rf "$APP/incoming"
mkdir "$APP/incoming"
tar -xzf "$BUNDLE" -C "$APP/incoming"
rm -f "$BUNDLE"

if [ ! -x "$APP/venv/bin/python" ]; then
    python3 -m venv "$APP/venv" || die "could not create a venv (on Debian/Ubuntu: apt install python3-venv)"
    say "created Python venv"
fi
"$APP/venv/bin/python" -m pip install --quiet --disable-pip-version-check -r "$APP/incoming/requirements.txt"
say "dependencies installed"

# Swap releases, keeping the previous one for a manual rollback.
rm -rf "$APP/previous"
[ -d "$APP/current" ] && mv "$APP/current" "$APP/previous"
mv "$APP/incoming" "$APP/current"
chown -R root:root "$APP"
chmod -R a+rX "$APP"
chown -R "$NAME:$NAME" "$DATA"

sed -e "s|__NAME__|${NAME}|g" -e "s|__PORT__|${PORT}|g" -e "s|__ORIGINS__|${ORIGINS}|g" "$APP/current/hvac-sim.service" > "$UNIT"
systemctl daemon-reload
systemctl enable --quiet "$NAME"
systemctl restart "$NAME"

for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 0.5
done
if [ "${healthy:-0}" != 1 ]; then
    journalctl -u "$NAME" -n 25 --no-pager || true
    die "the API did not answer on port ${PORT}; see the log above"
fi
say "API is running on 127.0.0.1:${PORT}"

if [ -e "$SITE" ]; then
    say "nginx site already installed - left unchanged"
else
    sed -e "s|__NAME__|${NAME}|g" -e "s|__PORT__|${PORT}|g" -e "s|__API_DOMAIN__|${DOMAIN}|g" "$APP/current/nginx-hvac-sim.conf" > "$SITE"
    ln -s "$SITE" "$LINK"
    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        say "nginx site installed for ${DOMAIN} (HTTP only until certbot is run)"
    else
        # Back out so a bad config can never take the other sites down.
        rm -f "$LINK" "$SITE"
        die "nginx rejected the new site; it was removed and nginx was not reloaded"
    fi
fi
