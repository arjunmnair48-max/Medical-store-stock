/* ============================================================
   hospitals.js — empanelled hospital list

   Each hospital carries the period its empanelment currently runs
   for. When head office extends an empanelment the period is moved
   to the new end date and the one it replaced is kept on file, so
   the list always shows the empanelment in force today while the
   earlier orders remain available for verification.
   ============================================================ */
(function (global) {
  'use strict';

  var state = { editing: null, q: '', status: 'all', extending: null };

  function form() { return UI.$('#hosForm'); }
  function extModal() { return UI.$('#extModal'); }

  var STATE_LABEL = {
    active: 'Empanelled', expiring: 'Expiring soon', expired: 'Empanelment expired',
    future: 'Not yet in force', ended: 'De-empanelled', open: 'No end date'
  };
  var STATE_CHIP = {
    active: 'chip-good', expiring: 'chip-warn', expired: 'chip-bad',
    future: 'chip-info', ended: 'chip-bad', open: 'chip-info'
  };

  /* ---------------- form ---------------- */

  function reset() {
    state.editing = null;
    form().reset();
    form().elements.status.value = 'Empanelled';
    UI.$('#hosFormTitle').textContent = 'Add Empanelled Hospital';
    UI.$('#hosSaveBtn').textContent = 'Save Hospital';
    UI.$('#hosCancelEdit').classList.add('hidden');
  }

  function edit(id) {
    var h = Store.hospital(id);
    if (!h) return;
    state.editing = id;
    UI.fillForm(form(), h);
    form().elements.id.value = h.id;
    UI.$('#hosFormTitle').textContent = 'Edit ' + (h.name || 'Hospital');
    UI.$('#hosSaveBtn').textContent = 'Update Hospital';
    UI.$('#hosCancelEdit').classList.remove('hidden');
    UI.$('#hosFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.name) { UI.toast('Enter the name of the hospital', 'warn'); return; }
    if (o.empanelFrom && o.empanelTo && o.empanelTo < o.empanelFrom) {
      UI.toast('The empanelment cannot end before it starts', 'warn');
      return;
    }
    if (!state.editing) delete o.id;

    var saved = Store.saveHospital(o);
    reset();
    render();
    App.refresh();
    UI.toast(saved.name + ' saved');
  }

  function remove(id) {
    var h = Store.hospital(id);
    if (!h) return;
    if (!confirm('Remove ' + h.name + ' from the empanelled list?')) return;
    var r = Store.deleteHospital(id);
    if (!r.ok) {
      alert('Cannot remove ' + h.name + ' — ' + r.count + ' claim(s) refer to it.\n\n' +
        'Set its status to De-empanelled instead, so the old claims stay traceable.');
      return;
    }
    if (state.editing === id) reset();
    render();
    App.refresh();
    UI.toast(h.name + ' removed', 'warn');
  }

  /* ---------------- extension of empanelment ---------------- */

  function openExtend(id) {
    var h = Store.hospital(id);
    if (!h) return;
    state.extending = id;
    var f = UI.$('#extForm');
    f.reset();
    f.elements.from.value = h.empanelFrom || '';
    f.elements.to.value = '';
    f.elements.orderDate.value = UI.today();
    UI.$('#extHospital').textContent = h.name;
    UI.$('#extCurrent').textContent = h.empanelFrom || h.empanelTo
      ? UI.dmy(h.empanelFrom) + ' to ' + (h.empanelTo ? UI.dmy(h.empanelTo) : 'no end date')
      : 'no period recorded yet';
    UI.$('#extHistory').innerHTML = historyHtml(h);
    extModal().classList.remove('hidden');
    setTimeout(function () { f.elements.to.focus(); }, 30);
  }

  function closeExtend() {
    extModal().classList.add('hidden');
    state.extending = null;
  }

  function historyHtml(h) {
    var list = (h.extensions || []).slice().reverse();
    if (!list.length) return '<div class="mini-empty">No earlier period on file.</div>';
    return list.map(function (x) {
      return '<div class="mini-row">' +
        '<div class="mini-main">' + UI.dmy(x.from) + ' – ' +
        (x.to ? UI.dmy(x.to) : 'open') +
        (x.order ? ' <span class="dim">· order ' + UI.esc(x.order) + '</span>' : '') + '</div>' +
        '<div class="mini-side dim">' + (x.orderDate ? UI.dmy(x.orderDate) : '') + '</div></div>';
    }).join('');
  }

  function submitExtend(e) {
    e.preventDefault();
    if (!state.extending) return;
    var o = UI.formToObject(UI.$('#extForm'));
    if (!o.to) { UI.toast('Enter the date the empanelment is extended up to', 'warn'); return; }
    var h = Store.hospital(state.extending);
    if (h && h.empanelTo && o.to <= h.empanelTo) {
      if (!confirm('That date is not later than the present end date (' +
        UI.dmy(h.empanelTo) + ').\n\nRecord it anyway?')) return;
    }
    var saved = Store.extendEmpanelment(state.extending, o);
    closeExtend();
    render();
    App.refresh();
    UI.toast(saved.name + ' extended up to ' + UI.dmy(saved.empanelTo));
  }

  function undo(id) {
    var h = Store.hospital(id);
    if (!h || !(h.extensions || []).length) return;
    var last = h.extensions[h.extensions.length - 1];
    if (!confirm('Undo the last extension of ' + h.name + '?\n\nThe period will go back to ' +
      UI.dmy(last.from) + ' – ' + (last.to ? UI.dmy(last.to) : 'no end date') + '.')) return;
    Store.undoExtension(id);
    render();
    App.refresh();
    UI.toast('Extension undone', 'warn');
  }

  /* ---------------- importing the list ---------------- */

  var IMPORT_COLS = ['name', 'address', 'city', 'phone', 'email', 'specialty',
    'category', 'orderno', 'empanelfrom', 'empanelto', 'remarks'];

  var HEADER_ALIASES = {
    'name of hospital': 'name', 'hospital': 'name', 'hospital name': 'name',
    'place': 'city', 'town': 'city', 'district': 'city',
    'phone no': 'phone', 'contact': 'phone', 'contact no': 'phone', 'telephone': 'phone',
    'speciality': 'specialty', 'discipline': 'specialty',
    'order no': 'orderno', 'order number': 'orderno', 'letter no': 'orderno',
    'from': 'empanelfrom', 'valid from': 'empanelfrom', 'empanelled from': 'empanelfrom',
    'empanelment from': 'empanelfrom', 'w e f': 'empanelfrom',
    'to': 'empanelto', 'valid to': 'empanelto', 'valid upto': 'empanelto',
    'empanelled to': 'empanelto', 'empanelment to': 'empanelto', 'upto': 'empanelto',
    'remark': 'remarks'
  };

  function normHeader(h) {
    var k = String(h || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (HEADER_ALIASES[k]) return HEADER_ALIASES[k];
    var squashed = k.replace(/ /g, '');
    return IMPORT_COLS.indexOf(squashed) !== -1 ? squashed : '';
  }

  /**
   * Accepts the date as the office writes it — 01-04-2026, 01/04/2026 or
   * the ISO form a spreadsheet exports — and returns ISO, or '' when the
   * cell holds something that is not a date at all.
   */
  function toIsoDate(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
    if (m) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    }
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
        '-' + String(d.getDate()).padStart(2, '0');
    }
    return '';
  }

  function importCsv(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var rows = UI.parseCsv(String(reader.result));
      if (rows.length < 2) {
        UI.toast('That file has no hospital rows in it', 'bad');
        return;
      }
      var head = rows[0].map(normHeader);
      if (head.indexOf('name') === -1) {
        alert('Could not find a hospital name column.\n\n' +
          'The first row must name the columns. Download the sample file for the ' +
          'column names this list understands.');
        return;
      }

      var added = 0, updated = 0, skipped = 0, badDates = 0;
      rows.slice(1).forEach(function (r) {
        var o = {};
        head.forEach(function (k, i) { if (k) o[k] = (r[i] || '').trim(); });
        if (!o.name) { skipped++; return; }

        var from = toIsoDate(o.empanelfrom), to = toIsoDate(o.empanelto);
        if ((o.empanelfrom && !from) || (o.empanelto && !to)) badDates++;

        // matching on the name keeps a re-uploaded list from doubling up
        var existing = Store.hospitalList().filter(function (h) {
          return (h.name || '').toLowerCase() === o.name.toLowerCase();
        })[0];

        var rec = existing ? existing : {};
        rec.name = o.name;
        rec.address = o.address || rec.address || '';
        rec.city = o.city || rec.city || '';
        rec.phone = o.phone || rec.phone || '';
        rec.email = o.email || rec.email || '';
        rec.specialty = o.specialty || rec.specialty || '';
        rec.category = o.category || rec.category || '';
        rec.orderNo = o.orderno || rec.orderNo || '';
        rec.remarks = o.remarks || rec.remarks || '';
        rec.status = rec.status || 'Empanelled';

        // an uploaded period that moves the end date forward is an
        // extension, and is recorded as one so the earlier one is kept
        if (existing && to && existing.empanelTo && to > existing.empanelTo) {
          Store.extendEmpanelment(existing.id, {
            from: from || existing.empanelFrom, to: to,
            order: o.orderno || '', orderDate: '', remarks: 'From uploaded list'
          });
          updated++;
          return;
        }

        if (from) rec.empanelFrom = from;
        if (to) rec.empanelTo = to;
        Store.saveHospital(rec);
        if (existing) updated++; else added++;
      });

      render();
      App.refresh();
      var msg = added + ' hospital(s) added, ' + updated + ' updated';
      if (skipped) msg += ', ' + skipped + ' row(s) without a name skipped';
      if (badDates) msg += ' — ' + badDates + ' date(s) could not be read';
      alert('Empanelled hospital list uploaded.\n\n' + msg + '.');
      UI.toast('Hospital list uploaded');
    };
    reader.readAsText(file);
  }

  function sampleCsv() {
    UI.download('empanelled-hospitals-sample.csv', UI.toCsv([
      ['Name', 'Address', 'City', 'Phone', 'Email', 'Specialty', 'Category',
        'Order No', 'Empanel From', 'Empanel To', 'Remarks'],
      ['City Care Hospital', 'M G Road', 'Ernakulam', '0484-2200100', '',
        'Multi-speciality', 'Multi-speciality', 'HQ/EMP/2024/17',
        '01-04-2024', '31-03-2027', 'Cashless — all disciplines'],
      ['Sunrise Eye Hospital', 'Bypass Road', 'Alappuzha', '0477-2233445', '',
        'Ophthalmology', 'Single speciality', 'HQ/EMP/2024/22',
        '01-04-2024', '31-03-2026', '']
    ]), 'text/csv');
    UI.toast('Sample list downloaded — fill it in and upload');
  }

  /* ---------------- list ---------------- */

  function matches(h) {
    if (state.status !== 'all' && Store.empanelStatus(h) !== state.status) return false;
    if (!state.q) return true;
    return [h.name, h.city, h.address, h.specialty, h.category, h.orderNo, h.phone]
      .join(' ').toLowerCase().indexOf(state.q) !== -1;
  }

  function periodCell(h) {
    var st = Store.empanelStatus(h);
    var period = (h.empanelFrom ? UI.dmy(h.empanelFrom) : '—') + ' to ' +
      (h.empanelTo ? UI.dmy(h.empanelTo) : 'no end date');
    var n = (h.extensions || []).length;
    return '<div class="nowrap">' + UI.esc(period) + '</div>' +
      '<span class="chip ' + STATE_CHIP[st] + '">' + STATE_LABEL[st] + '</span>' +
      (n ? ' <span class="dim">' + n + ' earlier period' + (n === 1 ? '' : 's') + '</span>' : '');
  }

  function render() {
    var list = Store.hospitalList().filter(matches);
    var t = UI.$('#hosTable');

    UI.$$('#hosTabs .tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.status === state.status);
    });

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">' +
        (Store.hospitalList().length ? 'No hospital matches that filter.'
          : 'No empanelled hospital entered yet. Add one above, or upload the list.') +
        '</td></tr></tbody>';
      UI.$('#hosCount').textContent = '';
      return;
    }

    var html = '<thead><tr>' +
      ['Name of hospital', 'Place', 'Specialty', 'Empanelment order',
        'Empanelled from — to', 'Claims', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.forEach(function (h) {
      var tot = Store.claimTotals(Store.claimList({ hospitalId: h.id }));
      html += '<tr' + (state.editing === h.id ? ' class="row-editing"' : '') + '>' +
        '<td class="strong">' + UI.esc(h.name) +
        (h.phone ? '<br><span class="dim">' + UI.esc(h.phone) + '</span>' : '') + '</td>' +
        '<td>' + UI.esc(h.city || '—') + '</td>' +
        '<td>' + UI.esc(h.specialty || h.category || '—') + '</td>' +
        '<td class="nowrap">' + UI.esc(h.orderNo || '—') + '</td>' +
        '<td>' + periodCell(h) + '</td>' +
        '<td class="nowrap">' + (tot.count
          ? tot.count + ' · ' + UI.money(tot.claimed)
          : '<span class="dim">—</span>') + '</td>' +
        '<td class="row-act nowrap">' +
        '<button class="link" data-ext="' + UI.esc(h.id) + '">Extend</button> ' +
        ((h.extensions || []).length
          ? '<button class="link" data-undo="' + UI.esc(h.id) + '">Undo</button> ' : '') +
        '<button class="link" data-edit="' + UI.esc(h.id) + '">Edit</button> ' +
        '<button class="link danger" data-del="' + UI.esc(h.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';

    var alerts = Store.empanelAlerts().length;
    UI.$('#hosCount').textContent = list.length + ' hospital(s)' +
      (alerts ? ' · ' + alerts + ' need an extension order' : '');
  }

  /* ---------------- init ---------------- */

  function init() {
    reset();
    form().addEventListener('submit', submit);
    UI.$('#hosCancelEdit').addEventListener('click', function () { reset(); render(); });

    UI.$('#hosSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });
    UI.$('#hosTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.status = b.dataset.status;
      render();
    });

    UI.$('#hosImport').addEventListener('click', function () { UI.$('#hosImportFile').click(); });
    UI.$('#hosImportFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importCsv(e.target.files[0]);
      e.target.value = '';
    });
    UI.$('#hosSampleCsv').addEventListener('click', sampleCsv);

    UI.$('#hosTable').addEventListener('click', function (e) {
      var ex = e.target.closest('[data-ext]');
      if (ex) { openExtend(ex.dataset.ext); return; }
      var un = e.target.closest('[data-undo]');
      if (un) { undo(un.dataset.undo); return; }
      var ed = e.target.closest('[data-edit]');
      if (ed) { edit(ed.dataset.edit); render(); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) remove(dl.dataset.del);
    });

    UI.$('#extForm').addEventListener('submit', submitExtend);
    UI.$('#extClose').addEventListener('click', closeExtend);
    UI.$('#extCancel').addEventListener('click', closeExtend);
    extModal().addEventListener('click', function (e) {
      if (e.target === extModal()) closeExtend();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !extModal().classList.contains('hidden')) closeExtend();
    });
  }

  global.Hospitals = {
    init: init, render: render, reset: reset,
    STATE_LABEL: STATE_LABEL, STATE_CHIP: STATE_CHIP
  };

})(window);
