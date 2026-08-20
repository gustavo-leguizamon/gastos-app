/**
 * Aplica una migración escrita a mano y la registra en `_prisma_migrations`.
 *
 *   node scripts/apply-migration.js <nombre_de_la_carpeta_de_migracion>
 *
 * Existe porque en este repo `prisma migrate dev` **no funciona**: falla al replicar
 * `20260516000000_rename_lugar_to_categoria` en la shadow database (P3006, el modelo `Lugar`
 * ya no existe). El historial quedó así desde la migración a Postgres y arreglarlo implicaría
 * reescribir migraciones ya aplicadas en producción.
 *
 * Es idempotente: si la migración ya figura como aplicada, no hace nada.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

const name = process.argv[2]
if (!name) {
  console.error('uso: node scripts/apply-migration.js <nombre_migracion>')
  process.exit(1)
}

const file = path.join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')
if (!fs.existsSync(file)) {
  console.error('no existe:', file)
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf8')
const checksum = crypto.createHash('sha256').update(sql).digest('hex')

const prisma = new PrismaClient()

;(async () => {
  const yaEsta = await prisma.$queryRawUnsafe(
    'SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL',
    name,
  )
  if (yaEsta.length) {
    console.log('ya aplicada:', name)
    return
  }

  // Los statements se separan por ';' a fin de línea. Se descartan los bloques que son sólo
  // comentarios, que si no llegarían vacíos a $executeRawUnsafe.
  const stmts = sql
    .split(/;\s*\r?\n/)
    .map(s => s.trim())
    .filter(s => s && !/^(--[^\n]*\s*)+$/.test(s))

  for (const s of stmts) {
    const resumen = s.split('\n').filter(l => !l.trim().startsWith('--')).join(' ').slice(0, 110)
    console.log('  >', resumen)
    await prisma.$executeRawUnsafe(s)
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
     VALUES ($1, $2, now(), $3, now(), $4)`,
    crypto.randomUUID(),
    checksum,
    name,
    stmts.length,
  )
  console.log('OK aplicada:', name, `(${stmts.length} statements)`)
})()
  .catch(e => {
    console.error('FALLO:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
