/* mindlab-clean.js: hides leftover assistant chat lines outside the idea window. */
(function () {
  var BAD = [
    "Lovely, I've marked", "Marked as right", "Thanks for being honest",
    "Thanks for checking", "Tell me the part", "Now let's check",
    "Here's my understanding"
  ];

  function isBad(t) {
    t = (t || '').trim();
    for (var i = 0; i < BAD.length; i++) {
      if (t.indexOf(BAD[i]) === 0) return true;
    }
    return false;
  }

  function clean() {
    var els = document.querySelectorAll('div, section, p, span, li');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!isBad(el.textContent)) continue;
      if (el.closest && el.closest('#ideaBody')) continue;
      var kids = el.children, childBad = false;
      for (var k = 0; k < kids.length; k++) {
        if (isBad(kids[k].textContent)) { childBad = true; break; }
      }
      if (childBad) continue;
      el.style.display = 'none';
    }
  }

  var timer = 0;
  new MutationObserver(function () {
    clearTimeout(timer);
    timer = setTimeout(clean, 200);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  clean();
})();