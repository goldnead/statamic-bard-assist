// Bard Assist editor extension. This file IS the source: hand-written, browser-native,
// no imports and no build step. It sits in resources/dist/ only because that is what the
// package ships (resources/js/ is export-ignored); edit it here directly.
//
// Suggests a set from the field's configuration for each block of paragraphs.
// Active only on Bard fields with `bard_assist: true`. The text is never touched until
// someone accepts, and every acceptance can be undone.
// Catalogue = the field's sets (display + instructions); fields = the set's fields.
(function () {
  const TEXT = "__text";
  const TEXT_KEY = "Plain text"; // option name the model sees for "stays text"
  const LINE_TYPES = ["text", "textarea", "list", "markdown"];

  // Colours come from the CP theme (--theme-color-*), so re-themed and dark CPs follow.
  const css = `
  :root { --ba-bg: var(--theme-color-content-bg, #fff); --ba-border: var(--theme-color-gray-200); --ba-border-strong: var(--theme-color-gray-300);
    --ba-text: var(--theme-color-gray-900); --ba-muted: var(--theme-color-gray-500); --ba-hover: var(--theme-color-gray-100); --ba-busy: var(--theme-color-gray-300);
    --ba-accent: var(--theme-color-primary); --ba-accent-text: var(--theme-color-ui-accent-text, var(--theme-color-primary));
    --ba-accent-soft: color-mix(in oklch, var(--theme-color-primary) 7%, var(--ba-bg)); --ba-accent-line: color-mix(in oklch, var(--theme-color-primary) 30%, var(--ba-bg));
    --ba-warn: oklch(0.666 0.179 58.318); --ba-warn-soft: color-mix(in oklch, var(--ba-warn) 12%, var(--ba-bg)); --ba-focus: var(--theme-color-focus-outline);
    /* Text on the accent: core's primary button uses near-white in both modes; gray-50 is the themeable equivalent. */
    --ba-on-accent: var(--theme-color-gray-50, #fff); }
  :root.dark { --ba-border: var(--theme-color-gray-700); --ba-border-strong: var(--theme-color-gray-600); --ba-text: var(--theme-color-gray-100);
    --ba-muted: var(--theme-color-gray-400); --ba-hover: var(--theme-color-gray-800); --ba-busy: var(--theme-color-gray-700); --ba-warn: oklch(0.769 0.188 70.08); }
  .ba-chunk { position: relative; box-shadow: inset 2px 0 0 transparent; padding-left: 14px !important; margin-left: -16px !important; margin-top: 0 !important; margin-bottom: 0 !important; padding-bottom: .55em !important; transition: box-shadow .2s; }
  .ba-chunk + p:not(.ba-chunk), .ba-chunk + .ba-first { margin-top: .8em !important; }
  .ba-chunk.sugg { box-shadow: inset 2px 0 0 var(--ba-accent-line); }
  .ba-chunk.unsure { box-shadow: inset 2px 0 0 color-mix(in oklch, var(--ba-warn) 55%, transparent); }
  .ba-chunk.busy { box-shadow: inset 2px 0 0 var(--ba-busy); }
  .ba-chunk.active.sugg { box-shadow: inset 2px 0 0 var(--ba-accent); }
  .ba-chunk.active.unsure { box-shadow: inset 2px 0 0 var(--ba-warn); }
  .ba-chunk.text { box-shadow: none; } .ba-chunk.text.active { box-shadow: inset 2px 0 0 var(--ba-border); }
  /* Pill floats right in the block's first line; field names right in each line */
  .ba-pills { float: right; display: inline-flex; gap: 6px; align-items: center; margin: 1px 0 0 14px; font: 500 12px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif); user-select: none; white-space: nowrap; }
  .ba-pill { font: inherit; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--ba-border); background: var(--ba-bg); color: var(--ba-text); cursor: pointer; transition: background-color .15s, border-color .15s, color .15s; }
  .ba-pill:focus-visible, .ba-btn:focus-visible, .ba-f:focus-visible { outline: 2px solid var(--ba-focus); outline-offset: 2px; }
  .ba-pill.busy { cursor: default; color: var(--ba-muted); } .ba-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ba-busy); animation: ba-pulse 1s ease-in-out infinite; }
  @keyframes ba-pulse { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .ba-pill .dot, .ba-new { animation: none; } }
  .ba-split { display: inline-flex; }
  .ba-pill.go { color: var(--ba-accent-text); border-color: var(--ba-accent-line); background: var(--ba-accent-soft); } .ba-pill.go:hover { background: var(--ba-accent); border-color: var(--ba-accent); color: var(--ba-on-accent); }
  .ba-split .go:first-child { border-radius: 999px 0 0 999px; } .ba-split .go.more { border-radius: 0 999px 999px 0; border-left-color: transparent; padding: 0 7px; margin-left: -1px; }
  .ba-pills.active .ba-pill.go { background: var(--ba-accent); border-color: var(--ba-accent); color: var(--ba-on-accent); } .ba-pills.active .ba-pill.go.more { border-left-color: color-mix(in oklch, var(--ba-on-accent) 30%, var(--ba-accent)); }
  .ba-pill.ask { color: var(--ba-warn); border-color: color-mix(in oklch, var(--ba-warn) 45%, var(--ba-bg)); } .ba-pill.ask:hover, .ba-pills.active .ba-pill.ask { background: var(--ba-warn-soft); border-color: var(--ba-warn); font-weight: 600; }
  .ba-pill.link, .ba-pill.quiet { color: var(--ba-muted); } .ba-pill.link:hover, .ba-pill.quiet:hover { color: var(--ba-text); border-color: var(--ba-border-strong); }
  .ba-pill.quiet { border-color: transparent; background: transparent; opacity: 0; } .ba-pills.active .ba-pill.quiet { opacity: 1; border-color: var(--ba-border); }
  .ba-pill.err { color: var(--ba-warn); cursor: help; }
  .ba-btn { font: 500 13px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif); height: 32px; padding: 0 12px; border: 1px solid var(--ba-border); background: var(--ba-bg); color: var(--ba-text); border-radius: var(--radius-lg, .5rem); cursor: pointer; }
  .ba-btn:hover { background: var(--ba-hover); }
  .ba-btn.go { background: var(--ba-accent); border-color: var(--ba-accent); color: var(--ba-on-accent); } .ba-btn.go:hover { background: color-mix(in oklch, var(--ba-accent) 100%, black 20%); }
  .ba-btn.quiet { border-color: transparent; color: var(--ba-muted); background: transparent; } .ba-btn.quiet:hover { color: var(--ba-text); background: var(--ba-hover); }
  .ba-f { float: right; clear: right; font: 12px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif); color: var(--ba-muted); margin: 3px 0 0 12px; user-select: none; border: 1px solid var(--ba-border); border-radius: var(--radius-md, .375rem); padding: 4px 7px; background: var(--ba-bg); cursor: pointer; opacity: 0; transition: opacity .15s; pointer-events: none; }
  .ba-chunk.active .ba-f { opacity: 1; pointer-events: auto; } .ba-chunk.active .ba-f:hover { border-color: var(--ba-border-strong); color: var(--ba-text); }
  .ba-pills + .ba-f { clear: none; }
  .ba-f.manual { color: var(--ba-accent-text); border-color: var(--ba-accent-line); }
  /* Narrow column (live preview): pill above the line, field names below */
  .ProseMirror:has(.ba-chunk) { container-type: inline-size; }
  @container (max-width: 480px) {
    .ba-pills { float: none; display: flex; justify-content: flex-end; margin: 0 0 6px; }
    .ba-f { float: none; display: none; }
    .ba-chunk.active .ba-f { display: inline-block; margin: 0 6px 0 0; }
  }
  .ba-bar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font: 13px/1.4 var(--font-sans, ui-sans-serif, system-ui, sans-serif); color: var(--ba-muted); padding: 2px 0 12px; border-bottom: 1px solid var(--ba-border); margin-bottom: 10px; user-select: none; }
  .ba-bar .who { color: var(--ba-accent-text); font-weight: 600; } .ba-bar .sp { flex: 1; } .ba-bar .undo { color: var(--ba-text); } .ba-bar .warn { color: var(--ba-warn); }
  /* Pill in the set card's header, left of Statamic's toggle and menu */
  .ba-sethold { position: relative; height: 0; z-index: 3; user-select: none; }
  .ba-sethold .setpill { position: absolute; right: 86px; top: 18px; height: 28px; font-size: 13px; }
  .ba-sethold .setpill::first-letter { color: var(--ba-accent-text); }
  .ba-sethold .setpill:hover { background: var(--ba-hover); border-color: var(--ba-border-strong); }
  .ba-new { animation: ba-flash 1.4s ease-out; border-radius: var(--radius-lg, .5rem); }
  @keyframes ba-flash { 0% { box-shadow: 0 0 0 3px var(--ba-accent-line); } 100% { box-shadow: 0 0 0 3px transparent; } }
  .ba-menu { position: fixed; z-index: 100; min-width: 230px; max-width: 300px; background: var(--ba-bg); border: 1px solid var(--ba-border); border-radius: var(--radius-xl, .75rem); box-shadow: 0 12px 32px rgba(0,0,0,.14); padding: 6px; font: 13px var(--font-sans, ui-sans-serif, system-ui, sans-serif); color: var(--ba-text); }
  .ba-menu .mh { font-size: 11.5px; color: var(--ba-muted); padding: 6px 8px 4px; }
  .ba-menu button { display: flex; width: 100%; justify-content: space-between; gap: 10px; align-items: center; border: 0; background: none; padding: 7px 8px; border-radius: var(--radius-md, .375rem); cursor: pointer; text-align: left; font: inherit; color: inherit; }
  .ba-menu button:hover, .ba-menu button:focus-visible { background: var(--ba-hover); outline: none; }
  .ba-menu button.on { color: var(--ba-accent-text); font-weight: 600; } .ba-menu button.on::after { content: "✓"; }
  .ba-menu button.pick { font-weight: 600; } .ba-menu button.pick.first { background: var(--ba-accent); color: var(--ba-on-accent); } .ba-menu button.pick.first:hover { background: color-mix(in oklch, var(--ba-accent) 100%, black 20%); }
  .ba-menu .kbd { font-size: 11px; opacity: .75; font-weight: 400; }
  .ba-menu .desc { display: block; font-size: 11.5px; color: var(--ba-muted); font-weight: 400; margin-top: 1px; }
  .ba-menu button.pick.first .desc { color: inherit; }
  .ba-menu .pct { flex: none; font-size: 11px; color: var(--ba-muted); font-variant-numeric: tabular-nums; }
  .ba-menu hr { border: 0; border-top: 1px solid var(--ba-border); margin: 6px 0; }`;
  const style = document.createElement("style"); style.id = "bard-assist-css"; style.textContent = css; document.head.appendChild(style);

  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgentData?.platform || navigator.userAgent);
  const kbd = isMac ? "⌥↩" : "Alt+↩";

  // Strings come from lang/{locale}/messages.php, which the CP ships to the browser.
  const t = (key, repl = {}) => {
    const full = "bard-assist::messages." + key;
    let s = typeof window.__ === "function" ? window.__(full) : full;
    if (s === full) s = key;
    for (const [k, v] of Object.entries(repl)) s = s.split(":" + k).join(String(v));
    return s;
  };
  const tc = (key, count, repl = {}) => t(key + (count === 1 ? "_one" : "_other"), { count, ...repl });

  // Own fetch wrapper: in Statamic 6, cp_url and $axios are no longer globals.
  const cfgGet = (k) => (window.Statamic?.$config?.get ? Statamic.$config.get(k) : window.StatamicConfig?.[k]);
  const cp = (p) => (cfgGet("cpUrl") || "/cp").replace(/\/$/, "") + "/bard-assist/" + p;
  const xsrf = () => decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
  async function request(path, body, accept) {
    const r = await fetch(cp(path), {
      method: body ? "POST" : "GET", credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: accept, "X-Requested-With": "XMLHttpRequest", "X-XSRF-TOKEN": xsrf() },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (accept !== "application/json") { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || "HTTP " + r.status);
    return data;
  }
  const call = (path, body) => request(path, body, "application/json");
  const callHtml = (path, body) => request(path, body, "text/html");

  // Only a successful answer is kept; after a failure the next suggestion asks again.
  let targets = null;
  const loadTargets = () => targets || (targets = call("targets").catch((e) => {
    targets = null;
    console.warn("[Bard Assist] Could not load link targets:", e.message || e);
    return [];
  }));
  const confOf = (probs) => { const v = Object.values(probs), n = v.length, p = Math.max(...v); return n > 1 ? (n * p - 1) / (n - 1) : 1; };

  Statamic.booting(() => {
    Statamic.$bard.addExtension(({ bard, tiptap }) => {
      if (!bard.config.bard_assist) return [];
      // Nested Bard fields (inside a Replicator, Grid or set) are not supported: the server
      // resolves top-level fields only, so do not offer suggestions it would refuse.
      try { if (String(bard.bardFieldPath()).includes(".")) return []; } catch { return []; }
      const settings = cfgGet("bardAssist") || {};
      const THRESHOLD = typeof settings.threshold === "number" ? settings.threshold : 0.6;
      const configured = settings.configured !== false;
      const { Extension } = tiptap.core;
      const { Plugin, PluginKey } = tiptap.pm.state;
      const { Decoration, DecorationSet } = tiptap.pm.view;
      const key = new PluginKey("bardAssist");
      const exKey = "bard-assist.examples." + bard.handle;

      const sets = () => bard.setConfigs.map((s) => ({
        handle: s.handle, display: s.display || s.handle, instructions: s.instructions || "",
        fields: (s.fields || []).map((f) => ({ handle: f.handle, ...(f.field || f) })),
      }));
      const setBy = (h) => sets().find((s) => s.handle === h);
      const classifyCall = async (state, questions) => (await call("evaluate", { ...auth(), state, questions })).answers;
      const label = (h) => (h === TEXT ? t("text") : setBy(h)?.display || h);
      const orLabel = (r) => topTwo(r).map(label).join(" " + t("or") + " ") + "?";

      // Shared per field: Statamic rebuilds the editor for live preview and fullscreen.
      const shared = (window.__bardAssist ||= {})[bard.handle] ||= { results: new Map(), originals: new Map() };
      const results = shared.results;     // block text → { type, probs, conf, fields, manual, link, busy, ctx, accepted }
      const originals = shared.originals; // set id → original lines, for "back to text"
      for (const [k, x] of results) if (x.busy) results.set(k, { ...x, busy: false, type: x.type ?? null }); // release aborted runs
      // focusKey: the block whose pill or field button has keyboard focus. It keeps that block
      // active while the editor itself is blurred, so Tab from the text does not redraw the pill away.
      let view = null, hoverKey = null, focusKey = null, flashId = null, lastAccepted = null, lastTimer = null;
      // A redraw that still replaces a focused button hands focus to its successor: the button
      // with the same data-ba-fid, which names the action, so focus never lands on a different one.
      // Without a successor, focus goes back to the text instead of the page.
      const refresh = () => {
        if (!view) return;
        const a = document.activeElement, fid = view.dom.contains(a) ? a.dataset?.baFid : null;
        view.dispatch(view.state.tr.setMeta(key, "refresh"));
        if (fid && !a.isConnected) {
          const next = view.dom.querySelector(`[data-ba-fid="${CSS.escape(fid)}"]`);
          if (next) next.focus(); else { focusKey = null; view.focus(); }
        }
      };
      // Focus left the block's buttons for good (not into one of our menus): the block may go quiet.
      const dropFocusKey = () => {
        if (focusKey && view && !view.dom.contains(document.activeElement) && !document.querySelector(".ba-menu")) { focusKey = null; refresh(); }
      };

      // Blocks: consecutive non-empty paragraphs. An empty paragraph or a set separates them.
      function chunksOf(doc) {
        const out = []; let cur = null, lastSet = null;
        doc.forEach((node, offset) => {
          const text = node.isTextblock ? node.textContent.trim() : "";
          if (node.type.name === "set") lastSet = node.attrs.values?.type || null;
          else if (text && node.type.name !== "paragraph") lastSet = null;
          if (node.type.name === "paragraph" && text) {
            if (!cur) { cur = { from: offset, to: offset, nodes: [], beforeSet: lastSet }; lastSet = null; }
            cur.nodes.push({ pos: offset, size: node.nodeSize, text });
            cur.to = offset + node.nodeSize;
          } else if (cur) { out.push(cur); cur = null; }
        });
        if (cur) out.push(cur);
        out.forEach((c) => { c.lines = c.nodes.map((n) => n.text); c.key = c.lines.join("\n"); });
        return out;
      }
      const findChunk = (k) => view && chunksOf(view.state.doc).find((c) => c.key === k);
      const activeKey = () => {
        const pos = view.state.selection.from;
        const c = chunksOf(view.state.doc).find((x) => pos >= x.from && pos <= x.to);
        return (view.hasFocus() && c && c.key) || focusKey || hoverKey;
      };
      const decided = (r) => r && (r.accepted || (r.type && r.conf >= THRESHOLD)) ? r.type : null;
      const stateOf = (r) => !r || r.busy || !r.type ? (r?.err ? "unsure" : "busy") : r.conf >= THRESHOLD ? "sugg" : "unsure";
      const topTwo = (r) => Object.entries(r.probs || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([h]) => h);

      // ---------- Ask the model ----------
      async function classify(c, prev, next, index) {
        // Directly before this block is either a finished set or the previous block.
        const ctxPrev = c.beforeSet || (prev ? decided(results.get(prev.key)) : null);
        const r = results.get(c.key) || {};
        if (r.busy || r.refreshing || r.accepted || (r.type && r.ctx === ctxPrev && !r.stale)) return;
        // An inherited suggestion stays visible until the new one arrives.
        results.set(c.key, { ...r, busy: !r.type, refreshing: !!r.type, ctx: ctxPrev, err: null }); refresh();
        const examples = store.get(exKey, []), all = sets();
        const optionOf = (h) => (h === TEXT ? TEXT_KEY : setBy(h)?.display || h);
        try {
          const a = await classifyCall({
            position: index + 1, paragraph: c.key,
            paragraph_before: c.beforeSet ? { text: null, set: optionOf(c.beforeSet) } : prev ? { text: prev.lines.slice(0, 2).join("\n"), set: ctxPrev ? optionOf(ctxPrev) : null } : null,
            paragraph_after: next ? next.lines.slice(0, 2).join("\n") : null,
          }, { set: {
            type: "choice",
            instructions: {
              task: "An editor writes a page as a sequence of paragraphs. `paragraph` is one paragraph, `position` its place on the page, `paragraph_before` the paragraph before it with its building block (null = still open), `paragraph_after` the paragraph after it. Which building block fits `paragraph`?",
              house_examples: examples.length ? examples.map((e) => ({ paragraph: e.text, correct_block: optionOf(e.type) })) : undefined,
              house_rule: examples.length ? "House examples are decisions by the editors and take precedence when in doubt." : undefined,
            },
            criteria: { [TEXT_KEY]: "Running prose in full sentences with no special form.", ...Object.fromEntries(all.map((s) => [s.display, s.instructions || s.display])) },
          } });
          const byOption = { [TEXT_KEY]: TEXT, ...Object.fromEntries(all.map((s) => [s.display, s.handle])) };
          const probs = Object.fromEntries(Object.entries(a.set.probabilities).map(([d, p]) => [byOption[d], p]));
          const type = byOption[a.set.choice];
          results.set(c.key, { type, probs, conf: confOf(a.set.probabilities), ctx: ctxPrev, ...(await mapFields(c, type)) });
          schedule(); // ask the successors again with the new predecessor
        } catch (e) {
          results.set(c.key, { ...r, busy: false, refreshing: false, err: String(e.message || e) });
        }
        refresh();
      }

      // While typing, the block text changes with every key. So hint and preview do not vanish
      // until the next answer, a changed block inherits its predecessor's suggestion at the same
      // place (provisional, "stale") as long as it is recognisably the same block.
      let lastKeys = [];
      function carryOver(cs) {
        cs.forEach((c, i) => {
          if (results.has(c.key)) return;
          const oldKey = lastKeys[i], old = oldKey && results.get(oldKey);
          if (!old || old.accepted || !old.type) return;
          const same = c.lines[0] === oldKey.split("\n")[0] || c.key.startsWith(oldKey) || oldKey.startsWith(c.key);
          if (!same) return;
          results.set(c.key, { ...old, fields: old.fields ? c.lines.map((_, j) => old.fields[j] ?? null) : null, stale: true, busy: false, refreshing: false });
        });
        lastKeys = cs.map((c) => c.key);
      }

      // Step 2: line → field; link → entry.
      async function mapFields(c, type) {
        const set = setBy(type);
        if (!set) return { fields: null, manual: {}, link: null };
        const lineFields = set.fields.filter((f) => LINE_TYPES.includes(f.type));
        if (!lineFields.length) return { fields: c.lines.map(() => null), manual: {}, link: null };
        const qs = {};
        c.lines.forEach((l, j) => {
          qs["l" + j] = { type: "choice", instructions: `The paragraph \`paragraph\` becomes the building block "${set.display}". Which field does line ${j + 1} of ${c.lines.length}, \`lines[${j}]\`, belong in?`,
            criteria: Object.fromEntries(lineFields.map((f) => [f.handle, f.instructions || f.display || f.handle])) };
        });
        const a = await classifyCall({ paragraph: c.key, lines: c.lines }, qs);
        const fields = fixOrder(c.lines.map((_, j) => a["l" + j]?.choice ?? null), set);
        return { fields, manual: {}, link: await linkFor(c, set, fields) };
      }
      // The line-type field directly before a link field is its label (e.g. button_text → button_link).
      function linkPair(set) {
        const i = set.fields.findIndex((f) => f.type === "link");
        const labelField = i > 0 && LINE_TYPES.includes(set.fields[i - 1].type) ? set.fields[i - 1] : null;
        return i < 0 ? null : { link: set.fields[i], label: labelField };
      }
      async function linkFor(c, set, fields) {
        const pair = linkPair(set);
        const text = pair?.label && c.lines[fields.indexOf(pair.label.handle)];
        return text ? chooseTarget(text, c.key) : null;
      }
      // The first two single-line text fields keep their blueprint order (eyebrow before heading).
      function fixOrder(f, set) {
        const [a, b] = set.fields.filter((x) => x.type === "text").map((x) => x.handle);
        if (!a || !b) return f;
        const ia = f.indexOf(a), ib = f.indexOf(b);
        if (ia > -1 && ib > -1 && ia > ib) { f[ia] = b; f[ib] = a; }
        if (ia === -1 && ib > -1 && f.indexOf(b, ib + 1) > -1) f[ib] = a;
        return f;
      }
      async function chooseTarget(text, paragraph) {
        const url = paragraph.match(/https?:\/\/\S+/);
        if (url) return { value: url[0], title: url[0], conf: 1, options: [] };
        const list = (await loadTargets()).filter((z) => !location.pathname.includes(z.id)); // never the page itself
        if (!list.length) return null;
        const a = await classifyCall({ label: text, paragraph }, { target: {
          type: "choice",
          instructions: "A link labelled `label` appears in the paragraph `paragraph`. Which page of the website should it link to? If none clearly fits, choose none.",
          criteria: { ...Object.fromEntries(list.map((z) => [z.id, `${z.title}: ${z.description}`])), none: "No page clearly fits" },
        } });
        const probs = a.target.probabilities, top = a.target.choice, conf = confOf(probs);
        const options = list.map((z) => ({ id: z.id, title: z.title, p: probs[z.id] || 0 })).sort((x, y) => y.p - x.p);
        return { value: top !== "none" && conf >= THRESHOLD ? "entry::" + top : null, title: list.find((z) => z.id === top)?.title, conf, options };
      }

      let timer;
      function schedule() {
        if (!configured) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          // Behind the live preview the normal editor lives on. Only the visible one asks.
          if (!view || !view.dom.isConnected || view.dom.offsetParent === null) return;
          const cs = chunksOf(view.state.doc);
          cs.forEach((c, i) => classify(c, cs[i - 1], cs[i + 1], i));
        }, 450); // typing pause before asking
      }

      // ---------- Accept and undo ----------
      function learn(c, type) {
        const ex = store.get(exKey, []).filter((e) => e.text !== c.key);
        store.set(exKey, [{ text: c.key.slice(0, 300), type }, ...ex].slice(0, 12)); // the 12 most recent corrections
        for (const [k, x] of results) if (!x.accepted && k !== c.key) results.set(k, { ...x, type: null }); // ask all open blocks again
      }

      // Lines → field values (lists collect, text appends), plus the link target.
      function valuesFor(c, res, type) {
        const set = setBy(type), values = {};
        c.lines.forEach((l, j) => {
          const f = set.fields.find((x) => x.handle === res.fields?.[j]);
          if (!f) return;
          if (f.type === "list") (values[f.handle] ||= []).push(l);
          else values[f.handle] = values[f.handle] ? values[f.handle] + " " + l : l;
        });
        const pair = linkPair(set);
        if (pair && res.link?.value) values[pair.link.handle] = res.link.value;
        return values;
      }
      // Every request carries the publish form's blueprint token and this field's path.
      const auth = () => ({ token: bard.publishContainer.blueprint.token, field: bard.bardFieldPath() });
      const setRequest = (type, values) => ({ ...auth(), reference: bard.publishContainer.reference, set: type, values });

      async function accept(c, type) {
        closeMenu();
        const r = results.get(c.key) || {};
        if (r.type !== type) learn(c, type);
        if (type === TEXT) { results.set(c.key, { ...r, type, conf: 1, accepted: true }); refresh(); schedule(); return; }
        try {
          let res = r;
          if (r.type !== type || !r.fields || r.stale) { results.set(c.key, { ...r, busy: true }); refresh(); res = { ...r, type, ...(await mapFields(c, type)) }; }
          // Values and meta pre-processed by the server, so e.g. a link field shows its target at once.
          const { values: pre, meta } = await call("set", setRequest(type, valuesFor(c, res, type)));
          const id = "ba" + Math.random().toString(36).slice(2, 12);
          bard.updateSetMeta(id, meta);
          const now = findChunk(c.key); if (!now) return;
          originals.set(id, { lines: c.lines, result: { ...res, accepted: false } });
          view.dispatch(view.state.tr.replaceWith(now.from, now.to, view.state.schema.nodes.set.create({ id, values: { type, ...pre } })));
          results.delete(c.key);
          flashId = id; lastAccepted = { id, type }; clearTimeout(lastTimer);
          lastTimer = setTimeout(() => { lastAccepted = null; flashId = null; refresh(); }, 7000);
        } catch (e) {
          results.set(c.key, { ...r, busy: false, err: String(e.message || e) });
        }
        refresh(); schedule();
      }

      async function acceptAll() {
        for (const c of chunksOf(view.state.doc).reverse()) { // bottom up, so positions above stay valid
          const r = results.get(c.key);
          if (r && !r.accepted && r.type && r.type !== TEXT && r.conf >= THRESHOLD) await accept(c, r.type);
        }
      }

      // Set back to paragraphs: the original lines, else the values in field order.
      function toText(id, thenMenu) {
        let pos = null, node = null;
        view.state.doc.forEach((n, off) => { if (n.type.name === "set" && n.attrs.id === id) { pos = off; node = n; } });
        if (pos === null) return;
        const orig = originals.get(id);
        const set = setBy(node.attrs.values.type);
        const lines = orig?.lines || (set?.fields || []).flatMap((f) => {
          const v = node.attrs.values[f.handle];
          return LINE_TYPES.includes(f.type) && v ? (Array.isArray(v) ? v : [String(v)]) : [];
        });
        const { schema } = view.state;
        const paras = lines.map((l) => schema.nodes.paragraph.create(null, schema.text(l)));
        if (!paras.length) return;
        const key2 = lines.join("\n");
        results.set(key2, orig?.result ? { ...orig.result, accepted: false } : { type: node.attrs.values.type, conf: 1, fields: null, probs: {} });
        view.dispatch(view.state.tr.replaceWith(pos, pos + node.nodeSize, paras));
        if (lastAccepted?.id === id) lastAccepted = null;
        refresh();
        if (thenMenu) setTimeout(() => { const b = view.dom.querySelector(`[data-ba-key="${CSS.escape(key2)}"] .ba-pills button:last-child`); if (b) openTypeMenu(findChunk(key2), b); }, 50);
      }

      // ---------- Suggestions in the live preview ----------
      // Statamic's live preview renders only what would be saved; suggestions are still paragraphs
      // there. The server draws the suggested set with the site's own partial, and we swap the
      // paragraphs in the preview document for it (same origin, so allowed).
      const rendered = new Map(); // signature → HTML ("" = no partial)
      const norm = (s) => s.replace(/\s+/g, " ").trim();
      const lpFrames = () => [...document.querySelectorAll("iframe")].filter((f) => {
        // A cross-origin frame throws on access; it is not our preview, so skip it.
        try { return f.contentDocument && /live-preview/.test(f.contentWindow.location.search); } catch { return false; }
      });
      const onFrameLoad = () => schedulePaint(0);

      // Everything that lives outside the editor, created when the editor mounts and
      // removed in destroy(): Statamic rebuilds the editor for live preview and fullscreen.
      function mount() {
        // The preview iframe lives outside the editor; there is no event for it appearing.
        const observer = new MutationObserver(() => lpFrames().forEach((f) => {
          if (f.dataset.baHooked) return;
          f.dataset.baHooked = "1";
          f.addEventListener("load", onFrameLoad);
          schedulePaint(0);
        }));
        observer.observe(document.body, { childList: true, subtree: true });
        // Statamic rewrites the preview after changes, not always with a load event.
        const poll = setInterval(() => { if (lpFrames().some((f) => f.contentDocument?.body && !f.contentDocument.getElementById("ba-lp-css"))) schedulePaint(0); }, 700);
        const onDown = (e) => { if (!e.target.closest(".ba-menu, .ba-pills, .ba-f, .ba-sethold, .ba-bar")) closeMenu(); };
        const onKey = (e) => { if (e.key === "Escape" && document.querySelector(".ba-menu")) closeMenu(true); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        const painters = (window.__bardAssistPainters ||= {});
        // The live preview builds a second editor for the same field; remember the one it
        // replaces, so closing the preview hands painting back to the normal editor.
        const previousPainter = painters[bard.handle];
        painters[bard.handle] = painter;
        return () => {
          observer.disconnect();
          clearInterval(poll);
          clearTimeout(paintTimer); clearTimeout(timer); clearTimeout(lastTimer);
          document.removeEventListener("mousedown", onDown);
          document.removeEventListener("keydown", onKey);
          lpFrames().forEach((f) => { f.removeEventListener("load", onFrameLoad); delete f.dataset.baHooked; });
          if (painters[bard.handle] === painter) {
            if (previousPainter) painters[bard.handle] = previousPainter; else delete painters[bard.handle];
          }
          closeMenu();
        };
      }

      let paintTimer, lastActive = null;
      function schedulePaint(ms = 250) { clearTimeout(paintTimer); paintTimer = setTimeout(paint, ms); }

      // Blocks with a suggestion and their signature (text, set, fields, link).
      function currentItems() {
        return chunksOf(view.state.doc).map((c) => ({ c, r: results.get(c.key) }))
          .filter(({ r }) => r && !r.accepted && !r.busy && r.type && r.type !== TEXT && r.fields)
          .map((it) => ({ ...it, sig: JSON.stringify([it.c.key, it.r.type, it.r.fields, it.r.link?.value]) }));
      }
      // Fetch missing HTML. True when something new arrived. Only answers are cached
      // ("" = the site has no partial for this set); a failed request is retried later.
      const failedAt = new Map(); // signature → time of the last failure
      async function ensureRendered(items) {
        const now = Date.now();
        const missing = items.filter((it) => !rendered.has(it.sig) && !(now - (failedAt.get(it.sig) || 0) < 10000));
        let added = false;
        await Promise.all(missing.map(async ({ c, r, sig }) => {
          try {
            rendered.set(sig, await callHtml("render", setRequest(r.type, valuesFor(c, r, r.type))));
            failedAt.delete(sig); added = true;
          } catch (e) {
            failedAt.set(sig, Date.now());
            console.warn("[Bard Assist] Live preview render failed:", e.message || e);
          }
        }));
        return added;
      }
      async function paint() {
        if (!view || !lpFrames().length) return;
        paintFrames(currentItems());
        if (await ensureRendered(currentItems())) paintFrames(currentItems());
      }
      // Called by the layout's morph with the new, still invisible document: fill it synchronously.
      const painter = (doc) => {
        if (!view) return;
        const items = currentItems();
        paintDoc(doc, items, activeKey());
        ensureRendered(items).then((added) => added && schedulePaint(0));
      };
      function paintFrames(items) {
        const act = activeKey();
        for (const f of lpFrames()) {
          const doc = f.contentDocument;
          if (!doc?.body) continue;
          ensureStyle(doc);
          paintDoc(doc, items, act);
          if (act && act !== lastActive) doc.querySelector(`[data-ba-key="${CSS.escape(act)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        lastActive = act;
      }
      function ensureStyle(doc) {
        if (doc.getElementById("ba-lp-css")) return;
        // The preview is the site's page, without the CP's theme variables: carry the resolved values over.
        const cpStyle = getComputedStyle(document.documentElement);
        const accent = cpStyle.getPropertyValue("--theme-color-primary").trim() || "#4f46e5";
        const onAccent = cpStyle.getPropertyValue("--theme-color-gray-50").trim() || "#fff";
        const s = doc.createElement("style"); s.id = "ba-lp-css";
        s.textContent = `:root{--ba-lp:${accent};--ba-lp-on:${onAccent};--ba-lp-warn:oklch(0.666 0.179 58.318)}
          .ba-proposal{position:relative;outline:2px dashed color-mix(in oklch,var(--ba-lp) 60%,transparent);outline-offset:6px;border-radius:2px;transition:outline-color .2s}
          .ba-proposal.unsure{outline-color:color-mix(in oklch,var(--ba-lp-warn) 70%,transparent)}
          .ba-proposal.active{outline-style:solid;outline-color:var(--ba-lp)}.ba-proposal.unsure.active{outline-color:var(--ba-lp-warn)}
          .ba-proposal::after{content:attr(data-ba-label);position:absolute;top:-16px;right:4px;font:600 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0;text-transform:none;background:var(--ba-lp);color:var(--ba-lp-on);padding:4px 7px;border-radius:5px;z-index:5}
          .ba-proposal.unsure::after{background:var(--ba-lp-warn)}`;
        doc.head.appendChild(s);
      }
      function paintDoc(doc, items, act) {
        for (const { c, r, sig } of items) {
          const html = rendered.get(sig);
          if (!html) continue;
          const unsure = r.conf < THRESHOLD;
          const labelText = unsure ? orLabel(r) : t("preview_label", { set: label(r.type) });
          let nodes = [...doc.querySelectorAll(`[data-ba-key="${CSS.escape(c.key)}"]`)];
          if (nodes.length && nodes[0].dataset.baSig !== sig) { // suggestion changed: replace it
            const tmp = doc.createElement("div"); tmp.innerHTML = html;
            const fresh = [...tmp.children]; nodes[0].replaceWith(...fresh); nodes.slice(1).forEach((n) => n.remove()); nodes = fresh;
            mark(nodes, c, sig, labelText);
          } else if (!nodes.length) {
            nodes = swapIn(doc, c, html);
            if (nodes) mark(nodes, c, sig, labelText);
          }
          (nodes || []).forEach((n) => { n.classList.toggle("active", c.key === act); n.classList.toggle("unsure", unsure); n.dataset.baLabel = labelText; });
        }
      }
      const mark = (nodes, c, sig, text) => nodes.forEach((n) => { n.classList.add("ba-proposal"); n.dataset.baKey = c.key; n.dataset.baSig = sig; n.dataset.baLabel = text; });

      // Find the block's paragraphs in the preview document and split the element around them,
      // so the suggestion sits in the page's own grid.
      function swapIn(doc, c, html) {
        const want = c.lines.map(norm);
        const ps = [...doc.querySelectorAll("p")].filter((p) => !p.closest(".ba-proposal"));
        const i = ps.findIndex((p, k) => want.every((w, j) => ps[k + j] && norm(ps[k + j].textContent) === w && ps[k + j].parentElement === p.parentElement));
        if (i < 0) return null;
        const parent = ps[i].parentElement, kids = [...parent.children];
        const start = kids.indexOf(ps[i]), end = start + want.length;
        const tmp = doc.createElement("div"); tmp.innerHTML = html;
        const fresh = [...tmp.children];
        if (parent === doc.body) { ps[i].replaceWith(...fresh); kids.slice(start + 1, end).forEach((n) => n.remove()); return fresh; }
        const part = (list) => { if (!list.length) return null; const d = parent.cloneNode(false); d.append(...list); return d; };
        parent.replaceWith(...[part(kids.slice(0, start)), ...fresh, part(kids.slice(end))].filter(Boolean));
        return fresh;
      }

      // ---------- Menus ----------
      // Fixed-position menus on body: inside the editor, any overflow: hidden ancestor would clip them.
      function place(m, anchor) {
        document.body.appendChild(m);
        const r0 = anchor.getBoundingClientRect();
        if (r0.top < 70 || r0.bottom > innerHeight - 70) anchor.scrollIntoView({ block: "center" });
        const r = anchor.getBoundingClientRect();
        m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + "px";
        m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + "px";
        menuAnchor = anchor; anchor.setAttribute("aria-expanded", "true");
        // Arrow keys move between items, Home/End jump, Tab leaves the menu.
        m.addEventListener("keydown", (e) => {
          const items = [...m.querySelectorAll("button")], i = items.indexOf(document.activeElement);
          const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
          if (to !== undefined) { e.preventDefault(); items[(to + items.length) % items.length]?.focus(); }
          else if (e.key === "Tab") closeMenu();
        });
        m.querySelectorAll("button").forEach((b) => (b.tabIndex = -1));
        m.querySelector("button")?.focus();
      }
      const menu = (html) => { const m = document.createElement("div"); m.className = "ba-menu"; m.setAttribute("role", "menu"); m.innerHTML = html; return m; };
      function openTypeMenu(c, anchor) {
        closeMenu(); if (!c) return;
        const r = results.get(c.key) || {};
        const unsure = r.type && r.conf < THRESHOLD;
        const top = unsure ? topTwo(r) : [];
        const opts = [TEXT, ...sets().map((s) => s.handle)].filter((h) => !top.includes(h)).sort((a, b) => (r.probs?.[b] || 0) - (r.probs?.[a] || 0));
        const row = (h) => {
          const s = setBy(h), p = Math.round((r.probs?.[h] || 0) * 100);
          return `<button role="menuitem" data-type="${esc(h)}" class="${h === r.type && !unsure ? "on" : ""}"><span>${esc(label(h))}<span class="desc">${esc(h === TEXT ? t("text_desc") : (s?.instructions || "").split(/[:.]/)[0])}</span></span>${p ? `<span class="pct">${p}%</span>` : ""}</button>`;
        };
        const m = menu(unsure
          ? `<div class="mh">${esc(t("menu_unsure"))}</div>` +
            top.map((h, n) => `<button role="menuitem" data-type="${esc(h)}" class="pick${n === 0 ? " first" : ""}"><span>${esc(t("accept_as", { set: label(h) }))}</span>${n === 0 ? `<span class="kbd">${kbd}</span>` : ""}</button>`).join("") +
            `<hr><div class="mh">${esc(t("menu_else"))}</div>` + opts.map(row).join("")
          : `<div class="mh">${esc(t("menu_which"))}</div>` + opts.map(row).join(""));
        m.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) accept(c, b.dataset.type); });
        place(m, anchor);
      }
      function openFieldMenu(c, j, anchor) {
        closeMenu();
        const r = results.get(c.key); const set = r && setBy(r.type); if (!set) return;
        const m = menu(`<div class="mh">${esc(t("menu_field", { line: c.lines[j].slice(0, 40) }))}</div>` +
          set.fields.filter((f) => LINE_TYPES.includes(f.type)).map((f) => `<button role="menuitem" data-f="${esc(f.handle)}" class="${r.fields[j] === f.handle ? "on" : ""}"><span>${esc(f.display || f.handle)}</span></button>`).join("") +
          `<hr><button role="menuitem" data-f=""><span>${esc(t("menu_skip"))}</span></button>`);
        m.addEventListener("click", async (e) => {
          const b = e.target.closest("button"); if (!b) return;
          const fields = [...r.fields]; fields[j] = b.dataset.f || null;
          const pair = linkPair(set);
          const moved = pair?.label && fields.indexOf(pair.label.handle) !== r.fields.indexOf(pair.label.handle);
          let link = r.link;
          if (moved) {
            try { link = await linkFor(c, set, fields); } catch (err) { console.warn("[Bard Assist] Link target lookup failed:", err.message || err); }
          }
          results.set(c.key, { ...r, fields, link, manual: { ...r.manual, [j]: true } }); closeMenu(); refresh();
        });
        place(m, anchor);
      }
      function openLinkMenu(c, anchor) {
        closeMenu();
        const r = results.get(c.key); if (!r?.link) return;
        const m = menu(`<div class="mh">${esc(t("menu_link"))}</div>` + r.link.options.slice(0, 6).map((o) =>
          `<button role="menuitem" data-id="${esc(o.id)}" class="${r.link.value === "entry::" + o.id ? "on" : ""}"><span>${esc(o.title)}</span><span class="pct">${Math.round(o.p * 100)}%</span></button>`).join("") +
          `<hr><button role="menuitem" data-id=""><span>${esc(t("menu_link_open"))}</span></button>`);
        m.addEventListener("click", (e) => {
          const b = e.target.closest("button"); if (!b) return;
          const o = r.link.options.find((x) => x.id === b.dataset.id);
          results.set(c.key, { ...r, link: { ...r.link, value: o ? "entry::" + o.id : null, title: o?.title, conf: 1 } }); closeMenu(); refresh();
        });
        place(m, anchor);
      }
      function openSetMenu(id, anchor) {
        closeMenu();
        const m = menu(`<div class="mh">${esc(t("menu_set"))}</div>
          <button role="menuitem" data-a="text"><span>${esc(t("back_to_text"))}<span class="desc">${esc(t("back_to_text_desc"))}</span></span></button>
          <button role="menuitem" data-a="other"><span>${esc(t("other_set_menu"))}<span class="desc">${esc(t("other_set_desc"))}</span></span></button>`);
        m.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; closeMenu(); toText(id, b.dataset.a === "other"); });
        place(m, anchor);
      }
      // refocus: return focus to the button that opened the menu (Esc).
      let menuAnchor = null;
      function closeMenu(refocus = false) {
        document.querySelectorAll(".ba-menu").forEach((m) => m.remove());
        if (menuAnchor) { menuAnchor.setAttribute("aria-expanded", "false"); if (refocus && menuAnchor.isConnected) menuAnchor.focus(); }
        menuAnchor = null;
        setTimeout(dropFocusKey, 0);
      }

      // ---------- Decorations ----------
      const el = (tag, cls, html) => { const x = document.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; };
      // mousedown keeps the editor's selection; click with detail 0 is Enter/Space on a focused button.
      const btn = (cls, html, fn) => {
        const b = el("button", cls.includes("ba-pill") ? cls : "ba-btn " + cls, html); b.type = "button";
        if (html.endsWith("▾")) { b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-expanded", "false"); }
        b.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); fn(b); });
        // Keyboard: when the action removed the button itself (accept, accept all), focus goes back
        // to the text instead of falling to the page.
        b.addEventListener("click", async (e) => {
          if (e.detail !== 0) return;
          e.preventDefault(); await fn(b);
          if (view && !b.isConnected && !view.dom.contains(document.activeElement) && !document.querySelector(".ba-menu")) view.focus();
        });
        return b;
      };

      // Pill in the block's first line: no line of its own, nothing jumps on hover.
      function controls(c, r, st, active) {
        const box = el("span", `ba-pills ${st}${active ? " active" : ""}`); box.contentEditable = "false";
        if (r.err) {
          const retry = btn("ba-pill err", `${esc(t("unavailable"))} · ${esc(t("retry"))}`, () => { results.set(c.key, { ...r, err: null, busy: false, refreshing: false }); refresh(); schedule(); });
          retry.title = r.err; box.appendChild(retry); return box;
        }
        if (st === "busy") { box.appendChild(el("span", "ba-pill busy", `<span class="dot"></span>${esc(t("reading"))}`)); return box; }
        if (st === "sugg" && r.type === TEXT) {
          box.appendChild(btn("ba-pill quiet", esc(t("text")) + " ▾", (b) => openTypeMenu(c, b))); return box;
        }
        if (st === "sugg") {
          const split = el("span", "ba-split");
          // Only the suggestion while quiet; ✓ and the verb on the active block. ✓ always means "accept now".
          const ok = btn("ba-pill go", esc(active ? t("accept_as", { set: label(r.type) }) : label(r.type)), () => accept(c, r.type)); ok.title = t("accept_title", { set: label(r.type), kbd });
          const more = btn("ba-pill go more", "▾", (b) => openTypeMenu(c, b)); more.title = t("other_set"); more.setAttribute("aria-label", t("other_set"));
          split.append(ok, more); box.appendChild(split);
          if (r.link) box.appendChild(btn("ba-pill link", r.link.value ? `→ ${esc(r.link.title)} ▾` : esc(t("link_open")) + " ▾", (b) => openLinkMenu(c, b)));
          return box;
        }
        // unsure: the question stays, the answers are real buttons in the menu
        const q = btn("ba-pill ask", `${esc(orLabel(r))} ▾`, (b) => openTypeMenu(c, b)); q.title = t("please_choose");
        box.appendChild(q);
        return box;
      }

      function decorations(doc) {
        if (!view) return DecorationSet.empty;
        if (!configured) {
          return DecorationSet.create(doc, [Decoration.widget(0, () => {
            const bar = el("div", "ba-bar"); bar.contentEditable = "false";
            bar.appendChild(el("span", "warn", `<span class="who">${esc(t("name"))}</span> · ${esc(t("not_configured"))}`));
            return bar;
          }, { side: -10, key: "bar-off", ignoreSelection: true, stopEvent: () => true })]);
        }
        const decos = [], cs = chunksOf(doc);
        carryOver(cs);
        const act = activeKey();
        let sure = 0, unsure = 0, lastErr = null;
        cs.forEach((c) => {
          const r = results.get(c.key);
          if (r?.accepted) return;
          const st = stateOf(r);
          const quietText = st === "sugg" && r.type === TEXT;
          if (st === "sugg" && !quietText) sure++;
          if (st === "unsure" && !r?.err) unsure++;
          if (r?.err) lastErr = r.err;
          const active = c.key === act;
          c.nodes.forEach((n, j) => {
            const cls = quietText ? `ba-chunk text${active ? " active" : ""}` : `ba-chunk ${st}${active ? " active" : ""}`;
            decos.push(Decoration.node(n.pos, n.pos + n.size, { class: cls, ...(j === 0 ? { "data-ba-key": c.key } : {}) }));
            const f = r?.fields?.[j] != null && !quietText && st !== "busy" ? setBy(r.type)?.fields.find((x) => x.handle === r.fields[j]) : null;
            if (f || (r?.fields && r.fields[j] === null && active && !quietText && st !== "busy")) {
              decos.push(Decoration.widget(n.pos + 1, () => {
                const b = el("button", "ba-f" + (r.manual?.[j] ? " manual" : ""), esc(f ? f.display || f.handle : t("not_used")) + " ▾");
                b.type = "button"; b.contentEditable = "false"; b.dataset.baOwner = c.key; b.dataset.baFid = `${c.key}|f${j}`;
                b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-expanded", "false");
                b.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); if (b.closest(".active")) openFieldMenu(c, j, b); });
                b.addEventListener("click", (e) => { if (e.detail === 0) openFieldMenu(c, j, b); });
                return b;
              }, { side: -1, key: `f${n.pos}-${r.fields[j]}-${r.manual?.[j] ? 1 : 0}`, ignoreSelection: true, stopEvent: () => true }));
            }
          });
          decos.push(Decoration.widget(c.from + 1, () => {
            const box = controls(c, r || {}, st, active);
            box.dataset.baOwner = c.key;
            // Named by action (and set), so a rebuilt pill never hands focus to a different action.
            box.querySelectorAll("button").forEach((b) => {
              const cl = b.classList, act = cl.contains("err") ? "retry" : cl.contains("quiet") ? "text" : cl.contains("more") ? "more"
                : cl.contains("link") ? "link" : cl.contains("ask") ? "ask" : cl.contains("go") ? `ok:${r?.type}` : "other";
              b.dataset.baFid = `${c.key}|${act}`;
            });
            return box;
          },
            { side: -2, key: `c${c.key}|${st}|${active}|${r?.type}|${r?.link?.value}|${r?.link?.title}|${r?.err || ""}`, ignoreSelection: true, stopEvent: () => true }));
        });

        // Accepted sets: a small pill in the card's header, next to Statamic's own controls.
        let taken = 0;
        doc.forEach((n, off) => {
          if (n.type.name !== "set" || !String(n.attrs.id).startsWith("ba")) return;
          taken++;
          const id = n.attrs.id;
          decos.push(Decoration.widget(off, () => {
            const hold = el("div", "ba-sethold"); hold.contentEditable = "false";
            hold.appendChild(btn("ba-pill setpill", esc(t("from_text")) + " ▾", (b) => openSetMenu(id, b))).dataset.baFid = `set|${id}`;
            return hold;
          }, { side: -1, key: `s${id}`, ignoreSelection: true, stopEvent: () => true }));
          if (id === flashId) decos.push(Decoration.node(off, off + n.nodeSize, { class: "ba-new" }));
        });

        // Header bar
        decos.push(Decoration.widget(0, () => {
          const bar = el("div", "ba-bar"); bar.contentEditable = "false";
          if (lastAccepted) {
            bar.appendChild(el("span", "undo", esc(t("accepted_one", { set: "✓ " + label(lastAccepted.type) }))));
            const id = lastAccepted.id; bar.appendChild(btn("quiet", esc(t("undo")), () => toText(id)));
          } else {
            const parts = [taken && t("taken", { count: taken }), sure && tc("suggestions", sure), unsure && tc("choices", unsure)].filter(Boolean);
            bar.appendChild(el("span", "", `<span class="who">${esc(t("name"))}</span> · ${esc(parts.length ? parts.join(" · ") : t("start_writing"))}`));
          }
          if (lastErr) bar.appendChild(el("span", "warn", esc(lastErr)));
          bar.appendChild(el("span", "sp"));
          if (sure) bar.appendChild(btn("go", esc(t("accept_all", { count: sure })), acceptAll));
          else if (unsure) bar.appendChild(btn("", esc(t("first_open")), () => {
            const c = cs.find((x) => stateOf(results.get(x.key)) === "unsure"); if (!c) return;
            hoverKey = c.key; refresh();
            view.dom.querySelector(`[data-ba-key="${CSS.escape(c.key)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
          }));
          bar.querySelectorAll("button").forEach((b) => { b.dataset.baFid = `bar|${b.classList.contains("go") ? "accept-all" : b.classList.contains("quiet") ? "undo" : "first-open"}`; });
          return bar;
        }, { side: -10, key: `bar${cs.length}-${sure}-${unsure}-${taken}-${lastAccepted?.id}-${lastErr || ""}`, ignoreSelection: true, stopEvent: () => true }));
        schedulePaint();
        return DecorationSet.create(doc, decos);
      }

      return Extension.create({
        name: "bardAssist",
        addKeyboardShortcuts() {
          return { "Alt-Enter": () => {
            const k = activeKey(), r = k && results.get(k), c = k && findChunk(k);
            if (!c || !r || r.accepted) return false;
            if (r.type && r.type !== TEXT) { accept(c, r.conf >= THRESHOLD ? r.type : topTwo(r)[0]); return true; } // unsure: the likeliest candidate
            return false;
          } };
        },
        addProseMirrorPlugins() {
          return [new Plugin({
            key,
            view(v) {
              view = v; schedule();
              const unmount = mount();
              const over = (e) => { const k = e.target.closest?.("[data-ba-key]")?.getAttribute("data-ba-key") ?? (e.target.closest?.(".ba-chunk") ? hoverKey : null); if (k !== hoverKey) { hoverKey = k; refresh(); } };
              const leave = () => { if (hoverKey && !document.querySelector(".ba-menu")) { hoverKey = null; refresh(); } };
              const blur = () => setTimeout(refresh, 150);
              // Keyboard focus on a block's button keeps that block active (see focusKey).
              const focusIn = (e) => { const k = e.target.closest?.("[data-ba-owner]")?.dataset.baOwner || null; if (k !== focusKey) { focusKey = k; refresh(); } };
              const focusOut = () => setTimeout(dropFocusKey, 150);
              v.dom.addEventListener("mousemove", over);
              v.dom.addEventListener("focus", refresh); v.dom.addEventListener("blur", blur);
              v.dom.addEventListener("focusin", focusIn); v.dom.addEventListener("focusout", focusOut);
              v.dom.addEventListener("mouseleave", leave);
              return {
                update(v2, prev) { view = v2; if (!prev.doc.eq(v2.state.doc)) schedule(); },
                destroy() {
                  v.dom.removeEventListener("mousemove", over); v.dom.removeEventListener("focus", refresh); v.dom.removeEventListener("blur", blur); v.dom.removeEventListener("mouseleave", leave);
                  v.dom.removeEventListener("focusin", focusIn); v.dom.removeEventListener("focusout", focusOut);
                  unmount();
                  if (view === v) view = null; // late answers and timers then do nothing
                },
              };
            },
            props: { decorations: (state) => decorations(state.doc) },
          })];
        },
      });
    });
  });
})();
