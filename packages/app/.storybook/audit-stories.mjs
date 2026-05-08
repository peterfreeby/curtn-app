// Headless audit: render every story in an iframe and report console errors.
import { chromium } from "playwright";

const BASE = "http://localhost:6006";

async function loadIndex() {
  const res = await fetch(`${BASE}/index.json`);
  const data = await res.json();
  return Object.values(data.entries).filter((e) => e.type === "story");
}

async function main() {
  const stories = await loadIndex();
  console.log(`Auditing ${stories.length} stories...\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  for (const story of stories) {
    const url = `${BASE}/iframe.html?id=${story.id}&viewMode=story`;
    const errors = [];
    const pageErrors = [];

    const onConsole = (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter noise
        if (text.includes("Failed to load resource")) return;
        if (text.includes("i.pravatar.cc")) return;
        if (text.includes("picsum.photos")) return;
        if (text.includes("Runtime config is deprecated")) return;
        errors.push(text.slice(0, 400));
      }
    };
    const onPageError = (err) => {
      pageErrors.push(String(err.message).slice(0, 400));
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      // Wait a tick for late errors
      await page.waitForTimeout(600);
    } catch (e) {
      errors.push(`NAVIGATION: ${e.message}`);
    }

    page.off("console", onConsole);
    page.off("pageerror", onPageError);

    const all = [...pageErrors, ...errors];
    if (all.length > 0) {
      results.push({ id: story.id, title: story.title, name: story.name, errors: all });
      console.log(`✗ ${story.title} / ${story.name}`);
      for (const e of all) console.log(`    ${e}`);
    } else {
      process.stdout.write(".");
    }
  }

  await browser.close();

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total stories: ${stories.length}`);
  console.log(`With errors: ${results.length}`);
  console.log(`Clean: ${stories.length - results.length}\n`);

  if (results.length > 0) {
    console.log("Broken stories:");
    for (const r of results) console.log(`  ${r.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
