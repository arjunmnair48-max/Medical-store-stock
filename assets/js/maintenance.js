/* ============================================================
   maintenance.js — Asset maintenance register
   ============================================================ */
(function (global) {
  'use strict';

  function form() { return UI.$('#maintForm'); }

  function refreshSelect() {
    var sel = UI.$('#maintItemSelect');
    var keep = sel.value;
    var list = Store.items('asset');
    var html = '<option value="">— select asset —</option>';
    list.forEach(function (i) {
      html += '<option value="' + UI.esc(i.id) + '"' + (i.id === keep ? ' selected' : '') + '>' +
        UI.esc(i.assetTag ? i.assetTag + ' — ' + i.name : i.name) + '</option>';
    });
    if (!list.length) html = '<option value="">No permanent assets in the master yet</option>';
    sel.innerHTML = html;
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.itemId) { UI.toast('Choose an asset', 'warn'); return; }
    o.cost = o.cost === '' ? '' : Number(o.cost);
    delete o.id;
    Store.saveMaint(o);
    form().reset();
    render();
    App.refresh();
    UI.toast('Maintenance record saved');
  }

  function render() {
    var list = Store.maint();
    var t = UI.$('#maintTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No maintenance recorded yet.</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Date', 'Asset', 'Work', 'Done by', 'Cost', 'Next due', 'Remarks', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    var soon = new Date(); soon.setDate(soon.getDate() + 30);

    list.forEach(function (m) {
      var it = Store.item(m.itemId);
      var dueCls = '';
      if (m.nextDue) {
        var d = new Date(m.nextDue);
        dueCls = d < new Date() ? 'bad' : d <= soon ? 'warn' : '';
      }
      html += '<tr>' +
        '<td class="nowrap">' + UI.dmy(m.date) + '</td>' +
        '<td class="strong">' + UI.esc(it ? (it.assetTag ? it.assetTag + ' — ' + it.name : it.name) : '(deleted)') + '</td>' +
        '<td>' + UI.esc(m.type || '') + '</td>' +
        '<td>' + UI.esc(m.doneBy || '—') + '</td>' +
        '<td class="num">' + UI.money(m.cost) + '</td>' +
        '<td class="nowrap ' + dueCls + '">' + (m.nextDue ? UI.dmy(m.nextDue) : '—') + '</td>' +
        '<td class="dim">' + UI.esc(m.remarks || '') + '</td>' +
        '<td class="row-act"><button class="link danger" data-del="' + UI.esc(m.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
  }

  function init() {
    form().elements.date.value = UI.today();
    form().addEventListener('submit', submit);
    form().addEventListener('reset', function () {
      setTimeout(function () { form().elements.date.value = UI.today(); }, 0);
    });
    UI.$('#maintTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      if (!confirm('Delete this maintenance record?')) return;
      Store.deleteMaint(b.dataset.del);
      render();
      App.refresh();
      UI.toast('Record deleted', 'warn');
    });
  }

  global.Maint = { init: init, render: render, refreshSelect: refreshSelect };

})(window);
