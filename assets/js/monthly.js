/* ============================================================
   monthly.js — Monthly stock update / physical verification
   ============================================================ */
(function (global) {
  'use strict';

  var state = { cat: 'medicine', q: '', month: null, physical: {}, remarks: {} };

  function month() {
    return state.month || UI.$('#monthPicker').value || Store.currentMonth();
  }

  function rows() {
    var list = Store.items(state.cat);
    if (state.q) {
      list = list.filter(function (i) {
        return [i.name, i.code, i.spec, i.batchNo, i.assetTag]
          .join(' ').toLowerCase().indexOf(state.q) !== -1;
      });
    }
    return list.map(function (it) {
      var s = Store.monthSummary(it.id, month());
      s.item = it;
      // an unsaved edit in this session wins over what is stored
      if (state.physical[it.id] !== undefined) s.physical = state.physical[it.id];
      if (state.remarks[it.id] !== undefined) s.remarks = state.remarks[it.id];
      return s;
    });
  }

  function banner() {
    var m = month();
    var closed = Store.isMonthClosed(m);
    var el = UI.$('#monthBanner');
    if (closed) {
      el.className = 'banner ok';
      el.innerHTML = '<b>' + Store.monthName(m) + '</b> has been closed. ' +
        'You can still correct the physical figures and save again — ' +
        'the closing balance carries forward as next month\'s opening.';
    } else {
      el.className = 'banner';
      el.innerHTML = 'Enter the <b>physical count</b> of each item as verified on ' +
        Store.monthEndDate(m) + '-' + m.slice(5, 7) + '-' + m.slice(0, 4) +
        ', then press <b>Close &amp; Save Month</b>.';
    }
  }

  function render() {
    banner();
    var list = rows();
    var t = UI.$('#monthTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No ' +
        UI.CAT_LABEL[state.cat].toLowerCase() + ' items in the master yet.</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['#', 'Item', 'Unit', 'Opening', 'Receipts', 'Issues', 'Expired/Dmg', 'Adj', 'Book balance', 'Physical count', 'Difference', 'Remarks']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.forEach(function (r, i) {
      var phys = r.physical;
      var diff = (phys === null || phys === '' || phys === undefined) ? null : Number(phys) - r.book;
      var diffCell = diff === null ? '<span class="dim">—</span>'
        : diff === 0 ? '<span class="good">0</span>'
          : '<span class="bad">' + (diff > 0 ? '+' : '') + UI.num(diff) + '</span>';

      html += '<tr data-id="' + UI.esc(r.itemId) + '">' +
        '<td class="dim">' + (i + 1) + '</td>' +
        '<td class="strong">' + UI.esc(r.item.name) +
        (r.item.spec ? ' <span class="dim">' + UI.esc(r.item.spec) + '</span>' : '') + '</td>' +
        '<td>' + UI.esc(r.item.unit || '') + '</td>' +
        '<td class="num">' + UI.num(r.opening) + '</td>' +
        '<td class="num good">' + UI.num(r.receipts) + '</td>' +
        '<td class="num">' + UI.num(r.issues) + '</td>' +
        '<td class="num">' + UI.num(r.writeOff) + '</td>' +
        '<td class="num">' + (r.adjust ? UI.num(r.adjust) : '—') + '</td>' +
        '<td class="num strong">' + UI.num(r.book) + '</td>' +
        '<td class="num"><input class="cell-input" type="number" step="any" data-phys="' +
        UI.esc(r.itemId) + '" value="' + (phys === null || phys === undefined ? '' : UI.esc(phys)) + '" /></td>' +
        '<td class="num">' + diffCell + '</td>' +
        '<td><input class="cell-input wide" type="text" data-rem="' + UI.esc(r.itemId) +
        '" value="' + UI.esc(r.remarks || '') + '" placeholder="reason for difference" /></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
  }

  function fillBook() {
    rows().forEach(function (r) { state.physical[r.itemId] = r.book; });
    render();
    UI.toast('Physical count filled from book balance — correct any that differ');
  }

  function closeMonth() {
    var m = month();
    var all = ['medicine', 'disposable', 'asset'].reduce(function (acc, cat) {
      Store.items(cat).forEach(function (it) {
        var s = Store.monthSummary(it.id, m);
        if (state.physical[it.id] !== undefined) s.physical = state.physical[it.id];
        if (state.remarks[it.id] !== undefined) s.remarks = state.remarks[it.id];
        s.item = it;
        acc.push(s);
      });
      return acc;
    }, []);

    if (!all.length) { UI.toast('Nothing to close — add items first', 'warn'); return; }

    var missing = all.filter(function (r) {
      return r.physical === null || r.physical === '' || r.physical === undefined;
    });

    if (missing.length) {
      var msg = missing.length + ' of ' + all.length +
        ' items have no physical count entered for ' + Store.monthName(m) + '.\n\n' +
        'Press OK to take their book balance as the physical count, or Cancel to go back and enter them.';
      if (!confirm(msg)) return;
      missing.forEach(function (r) { r.physical = r.book; });
    }

    all.forEach(function (r) {
      Store.saveClosing({
        itemId: r.itemId,
        month: m,
        opening: r.opening,
        receipts: r.receipts,
        issues: r.issues,
        writeOff: r.writeOff,
        adjust: r.adjust,
        book: r.book,
        physical: Number(r.physical),
        remarks: r.remarks || ''
      });
    });
    Store.save();

    state.physical = {};
    state.remarks = {};
    render();
    App.refresh();
    UI.toast(Store.monthName(m) + ' closed — ' + all.length + ' items recorded');
  }

  function init() {
    var mp = UI.$('#monthPicker');
    mp.value = Store.currentMonth();
    state.month = mp.value;

    mp.addEventListener('change', function () {
      state.month = mp.value || Store.currentMonth();
      state.physical = {};
      state.remarks = {};
      render();
    });

    UI.$('#btnFillBook').addEventListener('click', fillBook);
    UI.$('#btnCloseMonth').addEventListener('click', closeMonth);

    UI.$('#monthTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      UI.$$('.tab', UI.$('#monthTabs')).forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      state.cat = b.dataset.cat;
      render();
    });

    UI.$('#monthSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });

    UI.$('#monthTable').addEventListener('input', function (e) {
      var p = e.target.closest('[data-phys]');
      if (p) {
        state.physical[p.dataset.phys] = p.value === '' ? null : Number(p.value);
        // live-update just the difference cell so the cursor is not lost
        var tr = p.closest('tr');
        var r = Store.monthSummary(p.dataset.phys, month());
        var v = state.physical[p.dataset.phys];
        var cell = tr.children[10];
        if (v === null) cell.innerHTML = '<span class="dim">—</span>';
        else {
          var d = v - r.book;
          cell.innerHTML = d === 0 ? '<span class="good">0</span>'
            : '<span class="bad">' + (d > 0 ? '+' : '') + UI.num(d) + '</span>';
        }
        return;
      }
      var rem = e.target.closest('[data-rem]');
      if (rem) {
        state.remarks[rem.dataset.rem] = rem.value;
        var existing = Store.closingOf(rem.dataset.rem, month());
        if (existing) { existing.remarks = rem.value; Store.save(); }
      }
    });
  }

  global.Monthly = { init: init, render: render };

})(window);
