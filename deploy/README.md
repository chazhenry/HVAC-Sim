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

## What the backend deploy touches on the server

Only things it owns (shown for the default `SERVICE_NAME=hvac-sim`; another name changes every path
and the user to match):

- `/opt/hvac-sim` - code (`current`, `previous`) and a private Python venv
- `/var/lib/hvac-sim` - the SQLite session database
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
