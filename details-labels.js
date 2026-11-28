/* details-labels.js: renames the Details tile and labels its three settings. */
(function () {
  var LABELS = {
    eStatus: 'Status: is this inbox, active, or done?',
    ePriority: 'Priority: how urgent is it?',
    eDue: 'Due date: when should it be finished?'
  };

  function fix() {
    var tile = document.querySelector('button.hv-tile[data-tile="details"]');
    if (tile && tile.textContent.indexOf('Status & due date') < 0) {
      tile.textContent = '📌 Status & due date';
    }
    var sec = document.querySelector('.hv-sec[data-sec="details"]');
    if (!sec) return;
    Object.keys(LABELS).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !sec.contains(el)) return;
      var prev = el.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('hv-lbl')) return;
      var lb = document.createElement('div');
      lb.className = 'hv-lbl';
      lb.textContent = LABELS[id];
      lb.style.cssText = 'font-size:13px;opacity:.85;margin:10px 0 4px;';
      el.parentNode.insertBefore(lb, el);
    });
  }

  new MutationObserver(fix).observe(document.body, { childList: true, subtree: true });
  fix();
})();