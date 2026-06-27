import '../config/env'
import mongoose from 'mongoose'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'

// Mark a DataSource inactive (so the orchestrator won't auto-run it) without
// deleting its config. Usage: ts-node src/scripts/holdSource.ts <id> "<reason>"

async function main() {
  const [id, reason] = process.argv.slice(2)
  if (!id) throw new Error('usage: holdSource.ts <dataSourceId> "<reason>"')
  const mongoUrl = process.env.MONGODB_URL
  if (!mongoUrl) throw new Error('MONGODB_URL not set')
  await mongoose.connect(mongoUrl)
  try {
    const ds = await DataSourceModel.findById(id)
    if (!ds) throw new Error(`DataSource not found: ${id}`)
    ds.isActive = false
    ds.disabledReason = reason || 'held'
    await ds.save()
    console.log(`Held ${ds.name} (${id}) — isActive=false, reason: ${ds.disabledReason}`)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
