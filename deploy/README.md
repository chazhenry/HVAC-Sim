# Deploying HVAC-Sim

Two pieces go to two places:

| Piece | Goes to | Script |
|---|---|---|
| Backend (FastAPI) | A Linux server, as its own service on its own hostname | `deploy/deploy-backend.sh` |
| Frontend (static files) | A folder of the website, e.g. `https://hypercard.ai/hvac/` | `deploy/publish-frontend.sh` |

The website is an Azure Static Web App. It cannot run Python and reserves `/api`
for its own functions, so the frontend calls the API on the other hostname.

## One-time setup

1. Copy `deploy/deploy.env.example` to `deploy/deploy.env` and fill it in. The
   file is git-ignored. The SSH key stays wherever it already is; only its path
   goes in the file.
2. Run `bash deploy/deploy-backend.sh`. The API is then running on the server and
   answering through nginx on port 80 for `API_DOMAIN`.
3. Make the API public (below).

### Making the API public

**Server behind a Cloudflare Tunnel** (no public IP): in the Cloudflare dashboard open
Zero Trust > Networks > Tunnels > the server's tunnel > Public hostnames, and add
`API_DOMAIN` with service `http://localhost:80`. Cloudflare creates the DNS record and
handles HTTPS; certbot is not needed.

**Server with a public IP**: create a DNS A record for `API_DOMAIN`, then run
`sudo certbot --nginx -d <API_DOMAIN>` on the server once. Certbot edits HVAC-Sim's own
nginx file; later deploys leave that file alone.

Check it with `curl https://<API_DOMAIN>/api/health`.

## Every update

To deploy the backend and then publish the frontend source in one command (stops if the backend fails):

```bash
bash deploy/deploy-both.sh "what changed"
```

Or run the deploys separately:

```bash
bash deploy/deploy-backend.sh                  # only when backend/ changed
bash deploy/deploy-frontend.sh "what changed"  # commit, push, then print the website steps
```

`deploy-frontend.sh` first updates `frontend/src/version.ts` to the deploying machine's local
date (`YY.MM.DD`). Additional deploys on the same date use `a`, `b`, through `z`, then `aa`,
`ab`, and so on. The version appears beside HVAC-Sim in the menu and job header.
The script commits the version and everything else in this repo with that comment and pushes it. It then
prints the three commands to run in the website repo, which rebuilds `public/hvac/` from GitHub
and publishes the site. The website's deploy uploads the whole site each time, which is why the
last step has to happen there.

`publish-frontend.sh` is the alternative for when the website repo is checked out on the same
machine: it builds the frontend and copies it straight into `<HOMEPAGE_REPO>/public/hvac/`.

## Simulator page visits

The backend already uses SQLite. `POST /api/visits` records page visits in the same
database as training sessions; no separate flat file or database service is needed.
The main page displays an invited guest sign-in modal on each page load. The entered
name is saved in browser localStorage under `hvac-sim.guest-name` and prefills the
modal on return visits. After the guest confirms their name, the frontend sends
`{ "visitId": "<UUID>", "appVersion": "26.11.11", "event": "home", "user": "Guest name" }`
once for that page load. React re-renders do not count as visits. Repeating a request
with the same visit ID does not count twice. Names are self-reported.

The `visits` table contains `id`, `visited_at` (UTC), `ip`, `city`, `state`, `country`,
`app_version`, `event`, and `user`. Page loads use `home`; future activity can use other event
names through the same endpoint. Existing databases automatically receive the column,
with existing visits marked `home`. The `user` column is also added automatically;
older records without a guest name remain NULL. In production the database lives at `/var/lib/<SERVICE_NAME>/hvac_sim.db`
(default `/var/lib/hvac-sim/hvac_sim.db`), survives releases, and is configured by
`HVAC_SIM_DB`. Development defaults to `backend/hvac_sim.db`.

IP addresses come from the connection as resolved by Uvicorn's trusted proxy
handling, never from the browser's request body. Deployment configures this app's
nginx site to restore `CF-Connecting-IP` only from a local Cloudflare Tunnel
connector (`127.0.0.1` or `::1`). Existing sites receive these directives without
replacing certbot TLS settings; nginx configuration is checked before reloading.
If cloudflared runs in a container or on another host, configure its specific trusted
source address in this app's nginx site instead. Do not trust arbitrary public sources.

City, state/region, and country are approximate IP locations retrieved server-side
over HTTPS from [ipwho.is](https://ipwhois.io/documentation). Visitor IPs are sent to
that provider; no API key is required. Known locations from recent visits by the
same IP are reused. Local/private IPs and failed or rate-limited lookups retain
NULL location fields, while the visit itself is still saved. The lookup runs after
the API response, and analytics failures do not block the simulator.

The gear button in the app's top-right corner appears only when the backend sees
visitor IP `136.56.49.114` or localhost (`127.0.0.1`, `::1`, or IPv4-mapped
`::ffff:127.0.0.1`). It opens a modal using 90% of the app viewport, with
search, refresh, and pages of 50 visits. `GET /api/visits/access` reports whether
the current IP is allowed; `GET /api/visits?search=&limit=50&offset=0` enforces the
same IP restriction on every request. Responses are not cached. Other IPs receive
HTTP 403 when attempting to read visits, even if they bypass the hidden button.
Those allowed IPs are excluded from all visit/activity analytics: the tracking endpoint
returns `{"status":"excluded"}` without saving a row or looking up their location.
They retain access to browse the log. The User and Event columns are visible and searchable.

To inspect records directly on the backend server with the SQLite CLI:

```bash
sudo sqlite3 -header -column /var/lib/hvac-sim/hvac_sim.db \
  'SELECT visited_at, user, event, ip, city, state, country, app_version FROM visits ORDER BY visited_at DESC LIMIT 100;'
```

## What the backend deploy touches on the server

Only things it owns (shown for the default `SERVICE_NAME=hvac-sim`; another name changes every path
and the user to match):

- `/opt/hvac-sim` - code (`current`, `previous`) and a private Python venv
- `/var/lib/hvac-sim` - the SQLite session and visit database
- `/etc/systemd/system/hvac-sim.service` - runs as system user `hvac-sim`,
  listening on `127.0.0.1:<APP_PORT>` only
- `/etc/nginx/sites-available/hvac-sim` - a separate nginx site for `API_DOMAIN`
- `/etc/hvac-sim.env` - the chat tutor's API keys, copied from your local `backend/.env` over SSH
  (mode 640, never in git). Without that file the API runs but the chat answers "not configured".

It refuses to continue if the port is in use, the service name is already taken, or another
nginx site already serves the hostname, and it removes its nginx file again if `nginx -t` fails.
It needs passwordless `sudo` for the deploy user.

## Rolling back

```bash
sudo systemctl stop hvac-sim
sudo rm -rf /opt/hvac-sim/current && sudo mv /opt/hvac-sim/previous /opt/hvac-sim/current
sudo systemctl start hvac-sim
```

## Removing it

```bash
sudo systemctl disable --now hvac-sim
sudo rm -f /etc/systemd/system/hvac-sim.service /etc/nginx/sites-enabled/hvac-sim /etc/nginx/sites-available/hvac-sim
sudo systemctl daemon-reload && sudo nginx -t && sudo systemctl reload nginx
sudo rm -rf /opt/hvac-sim /var/lib/hvac-sim && sudo userdel hvac-sim
```
