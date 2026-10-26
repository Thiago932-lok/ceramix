import db, { dbPath } from './connection.js'
import { applyMigrations } from './schema.js'

applyMigrations(db)
console.log(`Migração concluída: ${dbPath}`)
db.close()
