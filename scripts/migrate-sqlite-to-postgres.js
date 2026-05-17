// ARCHIVAL — one-shot migration ya ejecutada. Se conserva como referencia.
//
// Para re-correr (no deberia hacer falta): `npm i -D sql.js` y luego
// `node scripts/migrate-sqlite-to-postgres.js`. Requiere DATABASE_URL en .env
// apuntando a Postgres y un archivo SQLite valido en data/gastos.db.
//
// Que hace: trunca todas las tablas de Postgres y copia las filas del SQLite
// preservando IDs. Convierte booleans 0/1 -> true/false y fechas string -> Date.
// Al final resetea las sequences de Postgres al MAX(id) de cada tabla.

const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')
const { PrismaClient } = require('@prisma/client')

const SQLITE_PATH = path.join(__dirname, '..', 'data', 'gastos.db')

const TABLES_FK_ORDER = [
  // parents first
  'Moneda',
  'Casa',
  'Tarjeta',
  'Lugar',
  'Inversion',
  // children
  'Gasto',
  'GastoItem',
  'Pago',
  'Movimiento',
]

const prisma = new PrismaClient()

function readSqliteAll(db, table) {
  const stmt = db.prepare(`SELECT * FROM "${table}"`)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function normalizeRow(table, row) {
  const out = { ...row }

  // SQLite stores booleans as 0/1 INTEGER; Postgres needs true/false.
  const booleanFields = {
    Gasto: ['confirmado'],
    GastoItem: ['incluyeEnTotal', 'incluyeEnVencimiento'],
  }
  for (const f of booleanFields[table] || []) {
    if (f in out) out[f] = out[f] === 1 || out[f] === true || out[f] === '1'
  }

  // DateTime fields: SQLite stores as string/number, Prisma expects Date.
  const dateFields = {
    Gasto: ['createdAt', 'updatedAt'],
    GastoItem: ['createdAt'],
    Pago: ['createdAt'],
    Inversion: ['createdAt'],
    Movimiento: ['createdAt'],
  }
  for (const f of dateFields[table] || []) {
    if (out[f] != null) out[f] = new Date(out[f])
  }

  // Replace nulls explicitly (sql.js sometimes returns undefined)
  for (const k of Object.keys(out)) if (out[k] === undefined) out[k] = null

  return out
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite file not found at ${SQLITE_PATH}`)
  }

  console.log('Loading sql.js WASM...')
  const SQL = await initSqlJs()
  const buf = fs.readFileSync(SQLITE_PATH)
  const db = new SQL.Database(buf)

  console.log(`\nReading from ${SQLITE_PATH}`)
  const data = {}
  for (const t of TABLES_FK_ORDER) {
    data[t] = readSqliteAll(db, t)
    console.log(`  ${t}: ${data[t].length} rows`)
  }
  db.close()

  console.log('\nTruncating Postgres tables...')
  // Reverse FK order, RESTART IDENTITY to reset sequences, CASCADE just in case.
  const truncList = [...TABLES_FK_ORDER].reverse().map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${truncList} RESTART IDENTITY CASCADE`)

  console.log('\nInserting rows into Postgres (preserving IDs)...')
  for (const t of TABLES_FK_ORDER) {
    const rows = data[t].map((r) => normalizeRow(t, r))
    if (rows.length === 0) {
      console.log(`  ${t}: skipped (empty)`)
      continue
    }
    const model = t.charAt(0).toLowerCase() + t.slice(1)
    const res = await prisma[model].createMany({ data: rows, skipDuplicates: false })
    console.log(`  ${t}: inserted ${res.count}`)
  }

  console.log('\nResetting Postgres sequences to max(id)...')
  for (const t of TABLES_FK_ORDER) {
    const seqRow = await prisma.$queryRawUnsafe(
      `SELECT pg_get_serial_sequence('"${t}"', 'id') AS seq`
    )
    const seq = seqRow[0]?.seq
    if (!seq) continue
    await prisma.$executeRawUnsafe(
      `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${t}"), 1), (SELECT MAX(id) IS NOT NULL FROM "${t}"))`
    )
    console.log(`  ${t}: sequence reset`)
  }

  console.log('\nVerifying row counts in Postgres...')
  for (const t of TABLES_FK_ORDER) {
    const model = t.charAt(0).toLowerCase() + t.slice(1)
    const count = await prisma[model].count()
    const expected = data[t].length
    const ok = count === expected ? 'OK' : 'MISMATCH'
    console.log(`  ${t}: ${count} (expected ${expected}) ${ok}`)
  }

  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error('\nMigration failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
