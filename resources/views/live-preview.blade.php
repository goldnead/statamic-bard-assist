<script>
  // Bard Assist: swap the live preview in place and let the control panel paint
  // its suggestions into the new document before it becomes visible.
  window.StatamicLivePreviewMorph = function (current, updated) {
    try {
      Object.values(parent.__bardAssistPainters || {}).forEach(function (paint) { paint(updated); });
    } catch (e) {}
    current.body.innerHTML = updated.body.innerHTML;
  };
  // With a preview target set to `refresh: false`, Statamic only posts this message.
  // Fetch the new HTML ourselves; only the latest response counts.
  (function () {
    var latest = 0;
    window.addEventListener("message", function (e) {
      if (!e.data || e.data.name !== "statamic.preview.updated" || !e.data.url) return;
      var mine = ++latest;
      fetch(e.data.url, { credentials: "same-origin" })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          if (mine !== latest) return;
          window.StatamicLivePreviewMorph(document, new DOMParser().parseFromString(html, "text/html"));
        });
    });
  })();
</script>
