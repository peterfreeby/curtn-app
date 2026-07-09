import { chromium } from 'playwright'

async function attempt(label: string, ua: string) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ userAgent: ua })
  const page = await ctx.newPage()
  const t0 = Date.now()
  try { await page.goto('https://www.nycitycenter.org/calendar', { waitUntil: 'domcontentloaded', timeout: 60000 }) } catch(e:any){ console.log(label,'goto:',e.message) }
  let cleared=false, at=0
  for(let i=0;i<30;i++){ const t=await page.title().catch(()=> ''); if(t.length && !/just a moment|verifying|checking|attention/i.test(t)){cleared=true;at=Date.now()-t0;break} await page.waitForTimeout(2000) }
  const wd = await page.evaluate(()=> (navigator as any).webdriver).catch(()=>null)
  console.log(`${label}: cleared=${cleared} afterMs=${at} title=${JSON.stringify(await page.title().catch(()=> ''))} navigator.webdriver=${wd}`)
  await browser.close()
}
;(async()=>{
  await attempt('CurtnBot-UA', 'CurtnBot/1.0 (+https://curtn.com; hello@curtn.com — internal archive bootstrap, contact for opt-out)')
  await attempt('Chrome-UA', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')
})().catch(e=>{console.error(e);process.exit(1)})
