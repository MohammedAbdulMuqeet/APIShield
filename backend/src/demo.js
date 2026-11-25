import express from 'express'
const port = Number(process.argv[2] || 4101)
const app = express()
app.use(express.json())
app.use((req, res) => res.json({ instance: port, method: req.method, path: req.path, query: req.query, body: req.body }))
app.listen(port, '127.0.0.1', () => console.log('Demo upstream listening on', port))