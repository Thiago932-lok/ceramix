import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../../data')

const dbPath = config.dbPath.startsWith(':memory:')
  ? config.dbPath
  : path.resolve(__dirname, '../..', config.dbPath.replace(/^\.\//, ''))

if (dbPath !== ':memory:') {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

export { dbPath, dataDir }
export default db
