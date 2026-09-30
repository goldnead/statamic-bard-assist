<script>
  // Bard Assist: swap the live preview in place and let the control panel paint
  // its suggestions into the new document before it becomes visible.
  window.StatamicLivePreviewMorph = function (current, updated) {
    try {
      Object.values(parent.__bardAssistPainters || {}).forEach(function (paint) { paint(updated); });
    } catch (e) {
      // A cross-origin parent (preview opened elsewhere) or a painter error: show the page without suggestions.
      console.warn("[Bard Assist] Could not paint suggestions:", e);
    }
    current.body.innerHTML = updated.body.innerHTML;
  };
  // With a preview target set to `refresh: false`, Statamic only posts this message.
  // Fetch the new HTML ourselves; only the latest response counts. Only the control
  // panel that embeds this page (same origin) may trigger it, and only for a same-origin URL.
  (function () {
    var latest = 0;
    window.addEventListener("message", function (e) {
      if (e.source !== window.parent || e.origin !== location.origin) return;
      if (!e.data || e.data.name !== "statamic.preview.updated" || !e.data.url) return;
      var url;
      try { url = new URL(e.data.url, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      var mine = ++latest;
      fetch(url.href, { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(function (html) {
          if (mine !== latest) return;
          window.StatamicLivePreviewMorph(document, new DOMParser().parseFromString(html, "text/html"));
        })
        .catch(function (err) { console.warn("[Bard Assist] Live preview update failed:", err); });
    });
  })();
</script>
