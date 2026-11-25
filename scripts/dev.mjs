import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const children = new Set()
let frontend
let stopping = false

async function stop(code) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) child.kill()
  await frontend?.close()
}

function start(label, script, args = []) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
  })
  children.add(child)
  child.on('error', error => {
    console.error(label + ': ' + error.message)
    void stop(1)
  })
  child.on('exit', code => {
    children.delete(child)
    if (stopping) return
    console.error(label + ' stopped. Check MongoDB and make sure the required ports are free.')
    void stop(code || 1)
  })
}

try {
  frontend = await createServer({
    root: fileURLToPath(new URL('../frontend/', import.meta.url)),
    server: { host: '127.0.0.1', port: Number(process.env.FRONTEND_PORT || 5173), strictPort: true },
  })
  await frontend.listen()
  process.once('SIGINT', () => void stop(0))
  process.once('SIGTERM', () => void stop(0))
  start('Express', 'backend/src/server.js')
  if (process.argv.includes('--demo')) {
    for (const port of ['4101', '4102', '4103']) start('Demo upstream ' + port, 'backend/src/demo.js', [port])
  }
  frontend.printUrls()
} catch (error) {
  console.error(error.message)
  await stop(1)
}
