// Browser smoke test: suggestion → accept → "Back to text", with no console errors.
// Not part of `composer test`: it needs a running Statamic site with the addon installed,
// an opted-in Bard field with text in it, a working API key, and a signed-in browser.
//
//   BA_ENTRY_URL=http://127.0.0.1:4392/cp/collections/pages/entries/<id> \
//   BA_CDP=http://127.0.0.1:9223 \
//   node tests/browser/smoke.cjs
//
// BA_CDP connects to an already signed-in Chrome (--remote-debugging-port). Without it,
// a headless Chromium is launched and BA_EMAIL / BA_PASSWORD are used to sign in.
// PLAYWRIGHT_CORE may point at a playwright-core install if it is not resolvable.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const entryUrl = process.env.BA_ENTRY_URL;
if (!entryUrl) { console.error("Set BA_ENTRY_URL to an entry with an opted-in Bard field."); process.exit(2); }

const fail = (msg) => { throw new Error(msg); };
const visibleCount = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent).length);

(async () => {
  const browser = process.env.BA_CDP ? await chromium.connectOverCDP(process.env.BA_CDP) : await chromium.launch();
  const context = process.env.BA_CDP ? browser.contexts()[0] : await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  let ok = false;
  try {
    await page.goto(entryUrl);
    if (!process.env.BA_CDP && page.url().includes("/auth/login")) {
      await page.fill("input[type=email]", process.env.BA_EMAIL || "");
      await page.fill("input[type=password]", process.env.BA_PASSWORD || "");
      await page.keyboard.press("Enter");
      await page.waitForURL((u) => !u.toString().includes("/auth/login"));
      await page.goto(entryUrl);
    }
    await page.waitForSelector(".ba-bar", { timeout: 15000 });

    // Wait for at least one confident suggestion.
    const go = page.locator(".ba-pills .ba-split .ba-pill.go:not(.more)").filter({ visible: true }).first();
    await go.waitFor({ timeout: 30000 });
    const before = await visibleCount(page, ".ba-sethold");

    await go.dispatchEvent("mousedown");
    await page.waitForFunction((n) => [...document.querySelectorAll(".ba-sethold")].filter((e) => e.offsetParent).length > n, before, { timeout: 15000 });
    console.log("accepted: set created");

    await page.locator(".ba-sethold .setpill").filter({ visible: true }).first().dispatchEvent("mousedown");
    await page.locator(".ba-menu button[data-a='text']").click();
    await page.waitForFunction((n) => [...document.querySelectorAll(".ba-sethold")].filter((e) => e.offsetParent).length === n, before, { timeout: 5000 });
    console.log("back to text: set removed");

    if (errors.length) fail("console errors:\n" + errors.join("\n"));
    ok = true;
    console.log("OK");
  } catch (e) {
    console.error("FAILED:", e.message);
  } finally {
    await page.close();
    if (!process.env.BA_CDP) await browser.close();
    process.exit(ok ? 0 : 1);
  }
})();
