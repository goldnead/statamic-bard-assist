// Browser test: Tab from the text to a block's pill keeps focus on the pill, and the
// "not used" field pills of that block stay visible. Same setup as smoke.cjs:
//
//   BA_ENTRY_URL=http://127.0.0.1:4393/cp/collections/pages/entries/<id> \
//   BA_CDP=http://127.0.0.1:9223 BA_EMAIL=… BA_PASSWORD=… \
//   node tests/browser/keyboard.cjs
//
// With BA_CDP a fresh context is opened in that Chrome and signed in with BA_EMAIL /
// BA_PASSWORD, so it shares no cookies with other tabs.
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const entryUrl = process.env.BA_ENTRY_URL;
if (!entryUrl) { console.error("Set BA_ENTRY_URL to an entry with an opted-in Bard field."); process.exit(2); }

const fail = (msg) => { throw new Error(msg); };
const focused = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { tag: a?.tagName, cls: a?.className || "", inPills: !!a?.closest?.(".ba-pills, .ba-f") };
});

(async () => {
  const browser = process.env.BA_CDP ? await chromium.connectOverCDP(process.env.BA_CDP) : await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  let ok = false;
  try {
    await page.goto(entryUrl);
    if (page.url().includes("/auth/login")) {
      await page.waitForSelector("input[type=password]");
      await page.locator("input:not([type=password]):not([type=checkbox]):not([type=hidden])").first().fill(process.env.BA_EMAIL || "");
      await page.fill("input[type=password]", process.env.BA_PASSWORD || "");
      await page.keyboard.press("Enter");
      await page.waitForURL((u) => !u.toString().includes("/auth/login"));
      await page.goto(entryUrl);
    }
    await page.waitForSelector(".ba-bar", { timeout: 15000 });
    await page.locator(".ba-pills .ba-split .ba-pill.go:not(.more)").filter({ visible: true }).first().waitFor({ timeout: 30000 });

    // Put the caret at the end of the first line of a block with a confident suggestion.
    const line = page.locator(".ba-chunk.sugg[data-ba-key]").filter({ visible: true }).first();
    const key = await line.getAttribute("data-ba-key");
    await line.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
    const notUsedBefore = await page.locator(".ba-f").filter({ hasText: /not used/i }).count();

    // Tab order inside the editor starts at the bar ("Accept all"), then the block controls.
    // Every stop must survive the redraw that follows 150 ms after the editor loses focus.
    let reachedPill = false;
    for (let i = 1; i <= 4; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(600);
      const f = await focused(page);
      console.log(`after Tab ${i}:`, JSON.stringify(f));
      if (f.tag !== "BUTTON") fail(`focus fell out of the controls after Tab ${i} (now on ${f.tag}.${f.cls})`);
      if (f.inPills) { reachedPill = true; break; }
    }
    if (!reachedPill) fail("Tab never reached a block pill");

    // The block that owns the focused pill must be the active one.
    const owner = await page.evaluate(() => document.activeElement.closest("[data-ba-owner]")?.dataset.baOwner);
    const stillActive = await page.evaluate((k) => !!document.querySelector(`.ba-chunk.active[data-ba-key="${CSS.escape(k)}"]`), owner || "");
    if (!stillActive) fail("the block stopped being active when its pill got focus");
    const notUsedAfter = await page.locator(".ba-f").filter({ hasText: /not used/i }).count();
    if (notUsedAfter < notUsedBefore) fail(`"not used" pills disappeared (${notUsedBefore} → ${notUsedAfter})`);

    // One more Tab moves on, focus still on a button.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    const f2 = await focused(page);
    console.log("after next Tab:", JSON.stringify(f2));
    if (f2.tag !== "BUTTON") fail(`focus fell out after the next Tab (now on ${f2.tag}.${f2.cls})`);

    // Enter opens the button's menu, Escape closes it and returns focus to the button.
    if ((await page.evaluate(() => document.activeElement.getAttribute("aria-haspopup"))) === "menu") {
      await page.keyboard.press("Enter");
      await page.waitForSelector(".ba-menu", { timeout: 3000 });
      await page.waitForTimeout(400);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const f3 = await focused(page);
      console.log("after Escape:", JSON.stringify(f3));
      if (!f3.inPills) fail(`Escape did not return focus to the pill (now on ${f3.tag}.${f3.cls})`);
    }

    // Enter on "Accept all" turns the bar into an undo bar. Focus must not move onto "Undo",
    // or a second Enter would take the acceptance back.
    const all = page.locator(".ba-bar button.go").filter({ visible: true }).first();
    if (await all.count()) {
      await page.waitForFunction(() => !document.querySelector(".ba-pill.busy"), null, { timeout: 45000 });
      await page.waitForTimeout(500);
      await all.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      const fid = await page.evaluate(() => document.activeElement.dataset?.baFid || document.activeElement.tagName);
      console.log("after Accept all:", fid);
      if (fid === "bar|undo") fail("focus moved onto Undo after Accept all");
      if (fid === "BODY") fail("focus fell to the page after Accept all");
    }

    ok = true;
    console.log("OK");
  } catch (e) {
    console.error("FAILED:", e.message);
  } finally {
    await context.close();
    process.exit(ok ? 0 : 1);
  }
})();
