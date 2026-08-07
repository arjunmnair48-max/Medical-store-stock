/* ============================================================
   app.js — router, dashboard, settings, backup
   ============================================================ */
(function (global) {
  'use strict';

  var current = 'dashboard';

  /* ---------------- routing ---------------- */

  function go(view) {
    current = view;
    UI.$$('.view').forEach(function (v) {
      v.classList.toggle('hidden', v.id !== 'view-' + view);
    });
    UI.$$('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === view);
    });
    document.body.dataset.view = view;
    refresh();
    global.scrollTo(0, 0);
  }

  /* ---------------- dashboard ---------------- */

  function stats() {
    var meds = Store.items('medicine'), disp = Store.items('disposable'), ast = Store.items('asset');
    var value = 0;
    Store.items().forEach(function (i) {
      if (i.category === 'asset') return;
      value += (Number(i.rate) || 0) * Store.balance(i.id);
    });
    var assetValue = ast.reduce(function (s, i) {
      return s + (Number(i.purchaseCost) || 0) * (Store.balance(i.id) || 1);
    }, 0);

    var low = Store.lowStock().length;
    var exp = Store.expiring();
    var expired = exp.filter(function (e) { return e.expired; }).length;

    var lastClosed = Store.load().closings.map(function (c) { return c.month; })
      .sort().slice(-1)[0];

    var cards = [
      { k: 'Medicines', v: meds.length, s: 'items in master', cls: '' },
      { k: 'Disposables', v: disp.length, s: 'items in master', cls: '' },
      { k: 'Permanent assets', v: ast.length, s: UI.money(assetValue) + ' book value', cls: '' },
      { k: 'Stock value', v: UI.money(value), s: 'medicines + disposables', cls: '' },
      { k: 'Below minimum', v: low, s: 'need indenting', cls: low ? 'warn' : 'good' },
      { k: 'Expiry alerts', v: exp.length, s: expired + ' already expired', cls: exp.length ? (expired ? 'bad' : 'warn') : 'good' },
      { k: 'Last month closed', v: lastClosed ? Store.monthName(lastClosed) : '—', s: 'monthly register', cls: lastClosed === Store.prevMonth(Store.currentMonth()) || lastClosed === Store.currentMonth() ? 'good' : 'warn' }
    ];

    UI.$('#statGrid').innerHTML = cards.map(function (c) {
      return '<div class="stat ' + c.cls + '">' +
        '<div class="stat-k">' + UI.esc(c.k) + '</div>' +
        '<div class="stat-v">' + c.v + '</div>' +
        '<div class="stat-s">' + c.s + '</div></div>';
    }).join('');
  }

  function miniList(el, rows, emptyMsg) {
    if (!rows.length) {
      el.innerHTML = '<div class="mini-empty">' + emptyMsg + '</div>';
      return;
    }
    el.innerHTML = rows.map(function (r) {
      return '<div class="mini-row">' +
        '<div class="mini-main">' + r.main + '</div>' +
        '<div class="mini-side ' + (r.cls || '') + '">' + r.side + '</div></div>';
    }).join('');
  }

  function dashboard() {
    stats();
    UI.$('#brandCentre').textContent = Store.settings().centreName || 'Medical Centre';

    miniList(UI.$('#lowStockList'), Store.lowStock().slice(0, 12).map(function (r) {
      return {
        main: '<b>' + UI.esc(r.item.name) + '</b> <span class="dim">' + UI.esc(r.item.unit || '') + '</span>',
        side: UI.num(r.balance) + ' / min ' + UI.num(r.min),
        cls: r.balance <= 0 ? 'bad' : 'warn'
      };
    }), 'Nothing below the minimum level. 👍');

    miniList(UI.$('#expiryList'), Store.expiring().slice(0, 12).map(function (r) {
      return {
        main: '<b>' + UI.esc(r.item.name) + '</b> <span class="dim">batch ' + UI.esc(r.item.batchNo || '—') + '</span>',
        side: r.expired ? 'EXPIRED ' + UI.dmy(r.item.expiry) : UI.dmy(r.item.expiry) + ' · ' + r.daysLeft + 'd',
        cls: r.expired ? 'bad' : 'warn'
      };
    }), 'No item is near expiry.');

    miniList(UI.$('#maintDueList'), Store.maintDue().slice(0, 8).map(function (r) {
      var over = r.due < new Date();
      return {
        main: '<b>' + UI.esc(r.item.name) + '</b> <span class="dim">' + UI.esc(r.rec.type || '') + '</span>',
        side: (over ? 'Overdue ' : 'Due ') + UI.dmy(r.rec.nextDue),
        cls: over ? 'bad' : 'warn'
      };
    }), 'No maintenance due in the next 30 days.');

    miniList(UI.$('#recentList'), Store.txns().slice(0, 10).map(function (t) {
      var it = Store.item(t.itemId) || {};
      var sg = Store.signed(t);
      return {
        main: '<b>' + UI.esc(it.name || '(deleted)') + '</b> <span class="dim">' +
          UI.TYPE_LABEL[t.type] + (t.ref ? ' · ' + UI.esc(t.ref) : '') + '</span>',
        side: (sg > 0 ? '+' : '') + UI.num(sg) + '  ·  ' + UI.dmy(t.date),
        cls: sg < 0 ? 'bad' : 'good'
      };
    }), 'No entries yet. Record a receipt or an issue to begin.');
  }

  /* ---------------- settings & backup ---------------- */

  function loadSettings() {
    UI.fillForm(UI.$('#settingsForm'), Store.settings());
  }

  function saveSettings(e) {
    e.preventDefault();
    var o = UI.formToObject(UI.$('#settingsForm'));
    o.expiryDays = Number(o.expiryDays) || 90;
    if (!o.currency) o.currency = '₹';
    Store.saveSettings(o);
    UI.$('#brandCentre').textContent = o.centreName || 'Medical Centre';
    document.title = (o.centreName || 'Medical Centre') + ' — Stock Register';
    UI.toast('Settings saved');
    refresh();
  }

  function exportBackup() {
    var stamp = new Date().toISOString().slice(0, 10);
    var name = (Store.settings().centreName || 'medical-centre')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    UI.download('stock-backup-' + name + '-' + stamp + '.json',
      JSON.stringify(Store.load(), null, 2));
    UI.toast('Backup downloaded');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); }
      catch (err) { UI.toast('That file is not a valid backup', 'bad'); return; }
      if (!data || !Array.isArray(data.items)) {
        UI.toast('That file is not a stock backup', 'bad'); return;
      }
      if (!confirm('Restore this backup?\n\n' + data.items.length + ' items, ' +
        (data.txns || []).length + ' entries.\n\nEVERYTHING currently in this browser will be replaced.')) return;
      Store.replaceAll(data);
      loadSettings();
      refresh();
      UI.toast('Backup restored');
    };
    reader.readAsText(file);
  }

  function csvItems() {
    var head = ['Category', 'Name', 'Code', 'Unit', 'Spec', 'Form', 'Batch', 'Expiry',
      'Manufacturer', 'Asset tag', 'Serial', 'Purchase date', 'Purchase cost',
      'Warranty upto', 'Condition', 'Supplier', 'Location', 'Rate', 'Min level',
      'Opening stock', 'Opening month', 'Stock in hand', 'Remarks'];
    var rows = [head];
    Store.items().forEach(function (i) {
      rows.push([UI.CAT_LABEL[i.category], i.name, i.code, i.unit, i.spec, i.form, i.batchNo,
        i.expiry, i.manufacturer, i.assetTag, i.serialNo, i.purchaseDate, i.purchaseCost,
        i.warrantyUpto, i.condition, i.supplier, i.location, i.rate, i.minLevel,
        i.openingStock, i.openingMonth, Store.balance(i.id), i.remarks]);
    });
    UI.download('stock-items.csv', UI.toCsv(rows), 'text/csv');
  }

  function csvTxns() {
    var rows = [['Date', 'Item', 'Category', 'Type', 'Qty', 'Signed qty', 'Unit',
      'Bill/Indent', 'From/To', 'Batch', 'Expiry', 'Rate', 'Remarks']];
    Store.txns().forEach(function (t) {
      var it = Store.item(t.itemId) || {};
      rows.push([t.date, it.name, UI.CAT_LABEL[it.category] || '', UI.TYPE_LABEL[t.type],
        t.qty, Store.signed(t), it.unit, t.ref, t.party, t.batchNo, t.expiry, t.rate, t.remarks]);
    });
    UI.download('stock-transactions.csv', UI.toCsv(rows), 'text/csv');
  }

  /* ---------------- sample data ---------------- */

  function sample() {
    if (!confirm('Load a set of demo items and entries into this browser?')) return;
    var m = Store.currentMonth();
    var demo = [
      { category: 'medicine', name: 'Paracetamol 500 mg', spec: '500 mg', form: 'Tablet', unit: 'Strip', batchNo: 'PC2401', expiry: nextExp(8), manufacturer: 'Cipla', rate: 12, minLevel: 50, openingStock: 220, location: 'A-1' },
      { category: 'medicine', name: 'Amoxicillin 500 mg', spec: '500 mg', form: 'Capsule', unit: 'Strip', batchNo: 'AM7712', expiry: nextExp(2), manufacturer: 'Alkem', rate: 48, minLevel: 30, openingStock: 34, location: 'A-2' },
      { category: 'medicine', name: 'ORS Powder', spec: '21.8 g', form: 'Powder', unit: 'Packet', batchNo: 'ORS55', expiry: nextExp(14), rate: 18, minLevel: 100, openingStock: 400, location: 'A-4' },
      { category: 'medicine', name: 'Inj. Diclofenac', spec: '75 mg/3 ml', form: 'Injection', unit: 'Ampoule', batchNo: 'DF3390', expiry: nextExp(-1), manufacturer: 'Sun', rate: 9, minLevel: 40, openingStock: 60, location: 'B-1' },
      { category: 'medicine', name: 'Normal Saline 0.9%', spec: '500 ml', form: 'IV Fluid', unit: 'Bottle', batchNo: 'NS8821', expiry: nextExp(18), rate: 42, minLevel: 25, openingStock: 90, location: 'B-3' },
      { category: 'disposable', name: 'Disposable Syringe', spec: '5 ml', unit: 'Nos', batchNo: 'SY9001', expiry: nextExp(24), rate: 4, minLevel: 200, openingStock: 900, location: 'C-1' },
      { category: 'disposable', name: 'Examination Gloves', spec: 'Medium', unit: 'Pair', batchNo: 'GL221', expiry: nextExp(20), rate: 6, minLevel: 300, openingStock: 260, location: 'C-2' },
      { category: 'disposable', name: 'Cotton Roll', spec: '500 g', unit: 'Roll', rate: 120, minLevel: 10, openingStock: 24, location: 'C-3' },
      { category: 'disposable', name: 'Surgical Face Mask', spec: '3 ply', unit: 'Nos', rate: 2, minLevel: 500, openingStock: 1500, location: 'C-4' },
      { category: 'disposable', name: 'IV Cannula', spec: '20G', unit: 'Nos', batchNo: 'CN44', expiry: nextExp(1), rate: 22, minLevel: 50, openingStock: 75, location: 'C-5' },
      { category: 'asset', name: 'Autoclave', spec: 'Horizontal 40 L', assetTag: 'PA-001', serialNo: 'AC-77213', purchaseDate: '2023-06-12', purchaseCost: 68000, warrantyUpto: '2026-06-11', condition: 'Working', supplier: 'Medline Systems', unit: 'Nos', openingStock: 1, location: 'Dressing room' },
      { category: 'asset', name: 'Examination Table', assetTag: 'PA-002', purchaseDate: '2022-01-20', purchaseCost: 14500, condition: 'Working', unit: 'Nos', openingStock: 3, location: 'OP room' },
      { category: 'asset', name: 'Refrigerator (vaccine)', spec: '165 L', assetTag: 'PA-003', serialNo: 'RF-9921', purchaseDate: '2024-03-05', purchaseCost: 32000, warrantyUpto: '2027-03-04', condition: 'Working', unit: 'Nos', openingStock: 1, location: 'Cold chain room' },
      { category: 'asset', name: 'BP Apparatus (aneroid)', assetTag: 'PA-004', purchaseDate: '2021-11-02', purchaseCost: 2200, condition: 'Under repair', unit: 'Nos', openingStock: 4, location: 'OP room' },
      { category: 'asset', name: 'Nebuliser', assetTag: 'PA-005', serialNo: 'NB-1180', purchaseDate: '2020-08-19', purchaseCost: 3800, condition: 'Condemned', unit: 'Nos', openingStock: 1, location: 'Store' }
    ];

    var made = [];
    demo.forEach(function (d) {
      d.openingMonth = Store.prevMonth(m);
      made.push(Store.saveItem(d));
    });

    var day = function (n) { return m + '-' + String(n).padStart(2, '0'); };
    [
      { i: 0, type: 'IN', qty: 100, ref: 'INV-4471', party: 'District Medical Store', d: 3 },
      { i: 0, type: 'OUT', qty: 45, ref: 'OP-DAILY', party: 'OP Pharmacy', d: 9 },
      { i: 1, type: 'OUT', qty: 12, ref: 'OP-DAILY', party: 'OP Pharmacy', d: 6 },
      { i: 2, type: 'IN', qty: 200, ref: 'INV-4471', party: 'District Medical Store', d: 3 },
      { i: 2, type: 'OUT', qty: 130, ref: 'FIELD-2', party: 'Field camp', d: 11 },
      { i: 3, type: 'EXP', qty: 20, party: 'Write-off', d: 12, remarks: 'Expired batch destroyed' },
      { i: 5, type: 'OUT', qty: 260, ref: 'INJ-ROOM', party: 'Injection room', d: 8 },
      { i: 6, type: 'OUT', qty: 90, ref: 'DRESS-1', party: 'Dressing room', d: 7 },
      { i: 9, type: 'OUT', qty: 30, ref: 'CAS-3', party: 'Casualty', d: 10 },
      { i: 4, type: 'IN', qty: 50, ref: 'INV-4498', party: 'District Medical Store', d: 14 }
    ].forEach(function (t) {
      var it = made[t.i];
      Store.saveTxn({
        itemId: it.id, date: day(t.d), type: t.type, qty: t.qty,
        ref: t.ref || '', party: t.party || '', batchNo: it.batchNo || '',
        expiry: it.expiry || '', rate: it.rate || '', remarks: t.remarks || ''
      });
    });

    Store.saveMaint({
      itemId: made[10].id, date: shift(-40), type: 'Service', doneBy: 'Medline Systems',
      cost: 2500, nextDue: shift(140), remarks: 'Gasket replaced'
    });
    Store.saveMaint({
      itemId: made[12].id, date: shift(-120), type: 'Calibration', doneBy: 'Cold Chain Cell',
      cost: 0, nextDue: shift(15), remarks: 'Thermometer calibrated'
    });
    Store.saveMaint({
      itemId: made[13].id, date: shift(-10), type: 'Repair', doneBy: 'Local technician',
      cost: 450, nextDue: shift(-2), remarks: 'Cuff leaking — pending'
    });

    refresh();
    UI.toast('Sample data loaded');
    go('dashboard');
  }

  function nextExp(monthsFromNow) {
    var d = new Date();
    d.setMonth(d.getMonth() + monthsFromNow);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function shift(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  function wipe() {
    if (!confirm('Erase ALL items, entries, closings and settings from this browser?\n\nThis cannot be undone. Export a backup first.')) return;
    if (!confirm('Really erase everything?')) return;
    Store.replaceAll(Store.defaults());
    loadSettings();
    refresh();
    go('dashboard');
    UI.toast('All data erased', 'warn');
  }

  /* ---------------- refresh ---------------- */

  function refresh() {
    switch (current) {
      case 'dashboard': dashboard(); break;
      case 'items': Items.render(); break;
      case 'txns': Txns.refreshSelect(); Txns.render(); break;
      case 'monthly': Monthly.render(); break;
      case 'maint': Maint.refreshSelect(); Maint.render(); break;
      case 'reports': Reports.render(); break;
      case 'settings': loadSettings(); break;
    }
  }

  /* ---------------- boot ---------------- */

  function init() {
    Store.load();

    Items.init();
    Txns.init();
    Monthly.init();
    Maint.init();
    Reports.init();

    UI.$$('.nav-item').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.view); });
    });
    UI.$$('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.goto); });
    });
    UI.$$('[data-report]').forEach(function (b) {
      b.addEventListener('click', function () { Reports.openWith(b.dataset.report); });
    });

    UI.$('#settingsForm').addEventListener('submit', saveSettings);
    UI.$('#btnExport').addEventListener('click', exportBackup);
    UI.$('#btnImport').addEventListener('click', function () { UI.$('#importFile').click(); });
    UI.$('#importFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = '';
    });
    UI.$('#btnCsvItems').addEventListener('click', csvItems);
    UI.$('#btnCsvTxns').addEventListener('click', csvTxns);
    UI.$('#btnSample').addEventListener('click', sample);
    UI.$('#btnWipe').addEventListener('click', wipe);

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && current !== 'reports') {
        e.preventDefault();
        Reports.openWith('monthly-all');
      }
    });

    loadSettings();
    var name = Store.settings().centreName || 'Medical Centre';
    UI.$('#brandCentre').textContent = name;
    document.title = name + ' — Stock Register';

    go('dashboard');
  }

  global.App = { init: init, go: go, refresh: refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
