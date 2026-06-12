import '../config/env'
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { DataSourceModel } from '../entities/dataSource/dataSourceModel'
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
function domain(u:string){ try{return new URL(u).host.replace(/^www\./,'')}catch{return ''} }
async function get(u:string){ try{const r=await fetch(u,{headers:{'user-agent':UA},redirect:'follow',signal:(AbortSignal as any).timeout(11000)}); return r.ok?await r.text():''}catch{return ''} }
const PATHS=['','/events','/shows','/calendar','/whats-on','/productions','/tickets','/on-stage','/upcoming']
function classify(h:string){
  const jsonLdEvents=(h.match(/"@type"\s*:\s*"?(?:Theater)?Event|"@type"\s*:\s*"?(?:Music|Comedy|Dance|Festival)Event/gi)||[]).length
  const sqsp=/eventlist-event--upcoming/.test(h)
  const tribe=/tribe-events|the-events-calendar/.test(h)
  if (jsonLdEvents>=2) return `JSONLD(${jsonLdEvents})`
  if (sqsp) return 'SQUARESPACE'
  if (tribe) return 'TRIBE'
  if (jsonLdEvents===1) return 'JSONLD(1)'
  return ''
}
;(async () => {
  await mongoose.connect(process.env.MONGODB_URL!)
  const sources:any[]=await DataSourceModel.find({type:{$in:['scraper','api']}}).select('url').lean()
  const done=new Set(sources.map(s=>domain(s.url||'')).filter(Boolean))
  await mongoose.disconnect()
  const seed=readFileSync('/tmp/seed_urls.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean)
  const undone=Array.from(new Set(seed.map(domain).filter(Boolean))).filter(d=>!done.has(d))
  const results:string[]=[]
  let i=0; const chunk=14
  while(i<undone.length){
    const batch=undone.slice(i,i+chunk)
    await Promise.all(batch.map(async d=>{
      const base='https://'+d
      for(const p of PATHS){ const h=await get(base+p); if(!h)continue; const c=classify(h); if(c){ results.push(`${c.padEnd(12)} ${base}${p}`); return } }
    }))
    i+=chunk
  }
  results.sort()
  console.log(results.join('\n'))
  console.log(`\n--- classified ${results.length}/${undone.length} undone ---`)
})()
