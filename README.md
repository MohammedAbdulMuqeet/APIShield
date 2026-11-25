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

With MongoDB running on the default local port, run `node --test backend/src/integration.test.js`. Set `TEST_BROWSER` to the full path of a Chromium or Edge executable to include the browser signup, registration, refresh, logout and login workflow. Tests create and remove a uniquely named test database.
