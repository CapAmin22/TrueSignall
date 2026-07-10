/**
 * Signal Clipper bookmarklet — PS-03 v1 (docs/05 §5.6).
 * User-initiated capture of a public post the user is lawfully viewing.
 * We never issue requests to LinkedIn — this runs in the user's own tab.
 *
 * Install: drag this to your bookmarks bar as
 * javascript:(function(){var s=document.createElement('script');s.src='https://app.truesignall.com/clipper.js';document.body.appendChild(s);})();
 */
(function () {
  var selection = String(window.getSelection() || "").slice(0, 1200);
  if (!selection || selection.length < 10) {
    alert("Signal Clipper: select the post text first, then click the bookmarklet.");
    return;
  }
  var appUrl = window.SIGNAL_AI_URL || "https://app.truesignall.com";
  fetch(appUrl + "/api/clip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: location.href,
      title: document.title.slice(0, 300),
      selection: selection,
    }),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.error) {
        alert("Signal Clipper: " + data.error.message);
      } else {
        alert("Clipped ✓ relevance: " + data.relevance + " — it's in your feed with a Draft button.");
      }
    })
    .catch(function () {
      alert("Signal Clipper: couldn't reach Signal AI — are you signed in?");
    });
})();
