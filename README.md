# APIShield

APIShield provides account-scoped gateways, reverse proxying, load balancing, automatic failover, circuit breakers, rate limiting and incident detection. Create an account at `/signup` or sign in at `/login`.

## Local development on Windows

Use Node.js LTS and MongoDB Community Server. From the project root, install dependencies with `npm.cmd ci`. On this PC, MongoDB runs as a user process. After restarting Windows, start it in a PowerShell terminal and keep that terminal open.

```powershell
& "$env:LOCALAPPDATA\Programs\MongoDB-9.0.8\MongoDB\Server\9.0\bin\mongod.exe" --dbpath "$env:LOCALAPPDATA\APIShield\mongodb" --bind_ip 127.0.0.1
```

Start the backend and frontend in separate PowerShell terminals.

```powershell
npm.cmd run dev:backend
```

```powershell
npm.cmd run dev:frontend
```

Open the local URL printed by Vite. The default backend health endpoint is `http://127.0.0.1:3001/api/health`. Refresh the page to check the connection again.

The backend uses `mongodb://127.0.0.1:27017/apishield` by default. To use another MongoDB deployment, set `$env:MONGODB_URI` in the backend terminal before starting the server.

Run `npm.cmd run build` from the root to create the frontend production bundle.

## Demonstrate a gateway

Open **Manage gateway → Configure maintenance** to pause routing with a custom message and an optional expected recovery time. Requests with a valid key receive HTTP 503 and the message. A future recovery time is included in the response and sets `Retry-After` in seconds. Choose **Resume gateway** when maintenance is complete. The expected time is advisory.

Under **Manage gateway**, open **Client keys** to issue a named key for each consumer. Copy the key when it appears and send it in the `X-API-Key` header. Revoking a named key leaves the other consumers connected. Existing shared keys appear as the default key and can be revoked after clients switch.

**History** shows the actor, timestamp and details for changes such as upstream edits, pauses and key rotation. Each gateway retains its latest 250 audit entries.

Enable **Active health checks** in gateway settings and specify an endpoint such as `/health`. APIShield probes each configured node every 30 seconds by default and shows its last result on Home. A successful HTTP response marks the node healthy. Probe status and circuit-breaker state are displayed separately.

**Trends** shows completed request volume, upstream HTTP 5xx as a share of forwarding attempts, and approximate p95 gateway latency. Retries count as upstream attempts and health probes are excluded. MongoDB retains request measurements for seven days.

On Home, open **Manage gateway** on a service card to edit its name, routing algorithm, rate policy or upstream nodes. Saving keeps its URL and key. Pause temporarily returns HTTP 503 to clients with a valid key. Resume restores routing. Rotating a key invalidates the old one and displays the replacement once. Deleting a gateway removes its route. Only its owner can perform these actions.

Start three lightweight upstreams in separate terminals from the project root.

```powershell
node backend/src/demo.js 4101
node backend/src/demo.js 4102
node backend/src/demo.js 4103
```

In the console, register a gateway with ports 4101 and 4102 as primaries and 4103 as backup. Choose round-robin, weighted round-robin or least-connections. Save the key shown after registration. Copy the gateway path from the service card.

```powershell
$gateway = Read-Host 'Paste the gateway path'
$key = Read-Host 'Paste the gateway key'
Invoke-RestMethod "http://127.0.0.1:5173${gateway}items" -Headers @{ 'X-API-Key' = $key }
```

Repeat the request to see which instance served it. Stop both primaries and send GET requests to observe backup routing. Three failed attempts open an upstream circuit for 15 seconds. The next eligible request probes recovery. Only GET and HEAD retry automatically, so an uncertain write is never replayed. Restart a primary to see recovery in the console. Health detection is traffic-driven.

Choose a sliding window or token bucket and a per-minute budget at registration. Requests exceeding the IP or shared service-key budget receive HTTP 429 and a Retry-After header. Five invalid keys or three rate-limit rejections per service within a one-minute observation period create a high-severity incident. The console polls every four seconds. MongoDB retains events for seven days. Node counters, circuit state and limit buckets are local to one gateway process and reset on restart.

The operator can set `UPSTREAM_ORIGINS` to a comma-separated list of trusted origins before starting Express. Only configure servers you control. The proxy forwards the path, query, payload, Accept and Content-Type. It strips client credentials before forwarding. Requests are limited to 256 KiB and responses to 4 MiB.

Passwords use bcrypt with cost 12. JWT sessions use HttpOnly, SameSite=Strict cookies and expire after eight hours. Logout revokes the session in MongoDB. Set a persistent high-entropy `JWT_SECRET` for sessions to survive backend restarts. Production mode requires this secret and HTTPS for secure cookies.

## Verification

With MongoDB running on the default local port, run `npm.cmd test`. Set `TEST_BROWSER` to the full path of a Chromium or Edge executable to include the browser signup, registration, refresh, logout and login workflow. Tests create and remove a uniquely named test database.

## Code layout

Home (`/`) shows your gateways and current counters. Open `/register` to add a gateway or `/incidents` to review recorded events. Random routing chooses an eligible node uniformly. Power-of-two routing samples two distinct eligible nodes and uses the one with fewer active requests.

Use **Add upstream node** on the registration page to enter your own origin. The default local setup accepts HTTP demo servers on 127.0.0.1 ports 4100–4199. For example, start `node backend/src/demo.js 4110` and enter `http://127.0.0.1:4110`. When UPSTREAM_ORIGINS is explicitly set, it replaces that demo policy. To authorize another trusted HTTP(S) origin for just one existing account, run `npm run approve-upstream -- YOUR_EMAIL https://orders.example.com` on the APIShield host. The grant is stored in MongoDB and takes effect immediately.

| Location | Responsibility |
| --- | --- |
| backend/src/server.js | Connect to MongoDB, initialize indexes and start listening. |
| backend/src/app.js | Assemble parsers, middleware and routers. |
| backend/src/routes | Map HTTP endpoints to controllers and apply access checks. |
| backend/src/controllers | Translate HTTP input into service calls and send the result. |
| backend/src/services | Implement account and session rules, gateway registration, routing, forwarding, rate limits and incident recording. |
| backend/src/models | Define MongoDB schemas and indexes for users, sessions, registered services and events. |
| backend/src/config and middleware | Provide gateway configuration, session checks and consistent HTTP errors. |
| frontend/src | Render account and console pages, submit gateway settings and share one HTTP client. |
| backend/tests | Exercise the application through HTTP and optionally through a browser. |

The dashboard uses a session cookie to manage its owner's gateways. A client calling a registered gateway uses the service's API key. A request goes through key verification, rate limiting, node selection and forwarding in that order. The console reads per-node counters and saved incidents through the authenticated management routes.

## Team workspaces

Open **Manage workspaces**, enter an organization name, and choose **Create workspace**. The workspace selector switches between organizations and your personal gateways. Existing gateways and incidents stay in the personal workspace.

Owners can create invitations for an email address, change member roles, and remove members or pending invitations. Share the invitation code privately. The invitee signs in with the matching email and enters the code under **Manage workspaces**. Codes expire after seven days and can be used once. Editors can manage gateways and keys. Viewers can read gateway metrics and incidents.

The selected workspace ID appears in the console URL. Management API clients send it in the `X-Workspace-Id` header on gateway, incident, and configuration history requests. Omit the header for your personal workspace. To approve a custom origin for a team, run `npm run approve-upstream -- workspace:WORKSPACE_ID https://orders.example.com`.
