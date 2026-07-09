import fs from 'fs'
import mongoose from 'mongoose'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
await mongoose.connect(env.MONGODB_URL)
const PI = mongoose.connection.collection('pendingimports')
const total = await PI.countDocuments({ status: 'pending' })
const withImg = await PI.countDocuments({ status: 'pending', imageUrl: { $nin: [null, ''] } })
console.log(`pending: ${total} | with imageUrl: ${withImg} | null/empty: ${total - withImg}`)
const recent = await PI.find({ status: 'pending' }).sort({ importedAt: -1 }).limit(14).project({ title:1, imageUrl:1, venueName:1 }).toArray()
for (const r of recent) {
  let host=''; try{ host = r.imageUrl ? new URL(r.imageUrl).host : '(none)' }catch{ host='(bad:'+String(r.imageUrl).slice(0,24)+')' }
  console.log(`${(r.venueName||'?').slice(0,20).padEnd(20)} | ${host.padEnd(30)} | ${String(r.title||'').slice(0,28)}`)
}
await mongoose.disconnect()
