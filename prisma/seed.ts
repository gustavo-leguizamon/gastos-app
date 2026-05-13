import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.moneda.upsert({ where: { codigo: 'ARS' }, update: {}, create: { codigo: 'ARS', nombre: 'Peso Argentino', simbolo: '$' } })
  await prisma.moneda.upsert({ where: { codigo: 'USD' }, update: {}, create: { codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: 'US$' } })
  await prisma.moneda.upsert({ where: { codigo: 'EUR' }, update: {}, create: { codigo: 'EUR', nombre: 'Euro', simbolo: '€' } })

  const casas = await prisma.casa.count()
  if (casas === 0) {
    await prisma.casa.create({ data: { nombre: 'Casa Principal' } })
  }
}

main().finally(() => prisma.$disconnect())
