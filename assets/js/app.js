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

    var m = Store.currentMonth();
    var rxMonth = Store.rxList({ month: m });
    var refMonth = Store.referralList({ month: m });
    var medsIssued = rxMonth.reduce(function (n, r) { return n + (r.lines || []).length; }, 0);

    var fab = Store.boxAlerts();
    var fabTotal = fab.length;
    var fabProblem = fab.filter(function (b) { return b.shortOf || b.expired; }).length;

    var cards = [
      { k: 'Medicines', v: meds.length, s: 'items in master', cls: '' },
      { k: 'Disposables', v: disp.length, s: 'items in master', cls: '' },
      { k: 'Permanent assets', v: ast.length, s: UI.money(assetValue) + ' book value', cls: '' },
      { k: 'Stock value', v: UI.money(value), s: 'medicines + disposables', cls: '' },
      { k: 'Below minimum', v: low, s: 'need indenting', cls: low ? 'warn' : 'good' },
      { k: 'Expiry alerts', v: exp.length, s: expired + ' already expired', cls: exp.length ? (expired ? 'bad' : 'warn') : 'good' },
      { k: 'Prescriptions', v: rxMonth.length, s: medsIssued + ' medicine lines this month', cls: '' },
      { k: 'Referrals', v: refMonth.length, s: 'this month', cls: '' },
      { k: 'First aid boxes', v: fabTotal, s: fabProblem ? fabProblem + ' need attention' : 'all in order',
        cls: fabProblem ? 'warn' : 'good' },
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

    miniList(UI.$('#fabList'), Store.boxAlerts().map(function (b) {
      var bad = b.expired > 0, warn = b.shortOf > 0;
      return {
        main: '<b>' + UI.esc(b.box.name) + '</b> <span class="dim">' +
          UI.esc(b.box.location || '') + '</span>',
        side: bad ? b.expired + ' expired' : warn ? b.shortOf + ' short' :
          b.lines ? 'complete' : 'empty',
        cls: bad ? 'bad' : warn ? 'warn' : b.lines ? 'good' : 'dim'
      };
    }), 'No first aid boxes set up.');

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

  function csvRx() {
    var rows = [['Date', 'Prescription No', 'Patient', 'Age', 'Sex', 'Problem / Diagnosis',
      'Prescribed by', 'Medicine', 'Quantity', 'Unit', 'Dosage', 'Remarks']];
    Store.rxList().forEach(function (r) {
      if (!r.lines || !r.lines.length) {
        rows.push([r.date, r.no, r.patient, r.age, r.sex, r.problem, r.doctor, '', '', '', '', r.remarks]);
        return;
      }
      r.lines.forEach(function (l) {
        var it = Store.item(l.itemId) || {};
        rows.push([r.date, r.no, r.patient, r.age, r.sex, r.problem, r.doctor,
          it.name || '(deleted item)', l.qty, it.unit, l.dose, r.remarks]);
      });
    });
    UI.download('prescriptions.csv', UI.toCsv(rows), 'text/csv');
  }

  function csvReferrals() {
    var rows = [['Date', 'Slip No', 'Patient', 'Age', 'Sex', 'Referred to hospital',
      'Under / Department', 'Reason', 'Accompanied by', 'Relation', 'Mode', 'Remarks']];
    Store.referralList().forEach(function (r) {
      rows.push([r.date, r.no, r.patient, r.age, r.sex, r.hospital, r.referredTo,
        r.reason, r.escort, r.relation, r.mode, r.remarks]);
    });
    UI.download('referrals.csv', UI.toCsv(rows), 'text/csv');
  }

  function csvBoxes() {
    var rows = [['Box', 'Location', 'In charge', 'Item', 'Unit', 'Required', 'In box', 'Short by',
      'Batch', 'Expiry']];
    Store.boxes().forEach(function (b) {
      var list = Store.boxItems(b.id);
      if (!list.length) { rows.push([b.name, b.location, b.incharge, '(empty)', '', '', '', '', '', '']); return; }
      list.forEach(function (r) {
        var short = r.required > 0 ? Math.max(0, r.required - r.inBox) : 0;
        rows.push([b.name, b.location, b.incharge, r.item.name, r.item.unit,
          r.required || '', r.inBox, short || '', r.item.batchNo, r.item.expiry]);
      });
    });
    UI.download('first-aid-boxes.csv', UI.toCsv(rows), 'text/csv');
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

    // a few OP prescriptions — these issue their medicines from stock
    [
      { patient: 'Lakshmi Menon', age: '46 y', sex: 'Female', problem: 'Fever with body ache',
        doctor: 'Dr. S. Menon', d: 5,
        lines: [{ i: 0, qty: 2, dose: '1-0-1 for 3 days' }, { i: 2, qty: 3, dose: 'SOS' }] },
      { patient: 'Rajan P.', age: '61 y', sex: 'Male', problem: 'Sore throat, productive cough',
        doctor: 'Dr. S. Menon', d: 8,
        lines: [{ i: 1, qty: 1, dose: '1-1-1 for 5 days' }, { i: 0, qty: 1, dose: 'SOS for fever' }] },
      { patient: 'Aisha Beevi', age: '29 y', sex: 'Female', problem: 'Dressing — laceration on left forearm',
        doctor: 'Dr. A. Thomas', d: 12,
        lines: [{ i: 7, qty: 1, dose: 'Daily dressing' }, { i: 6, qty: 2, dose: '' }] }
    ].forEach(function (r) {
      Store.saveRx({
        no: Store.nextRxNo(day(r.d)), date: day(r.d), patient: r.patient, age: r.age,
        sex: r.sex, problem: r.problem, doctor: r.doctor, remarks: '',
        lines: r.lines.map(function (l) {
          return { itemId: made[l.i].id, qty: l.qty, dose: l.dose };
        })
      });
    });

    [
      { patient: 'Rajan P.', age: '61 y', sex: 'Male', hospital: 'District Hospital, Alappuzha',
        referredTo: 'Dept. of Medicine', reason: 'Uncontrolled hypertension, needs evaluation',
        escort: 'Manoj R.', relation: 'Son', mode: 'Ambulance', d: 8 },
      { patient: 'Baby of Sunitha', age: '8 m', sex: 'Female', hospital: 'Medical College Hospital',
        referredTo: 'Paediatrics', reason: 'Persistent high fever, dehydration',
        escort: 'Sunitha K.', relation: 'Mother', mode: 'Ambulance', d: 11 },
      { patient: 'Devassy Joseph', age: '54 y', sex: 'Male', hospital: 'Taluk Hospital, Cherthala',
        referredTo: 'Dept. of Surgery', reason: 'Suspected appendicitis',
        escort: 'Mary Joseph', relation: 'Wife', mode: 'Own arrangement', d: 13 }
    ].forEach(function (r) {
      Store.saveReferral({
        no: Store.nextReferralNo(day(r.d)), date: day(r.d), patient: r.patient, age: r.age,
        sex: r.sex, hospital: r.hospital, referredTo: r.referredTo, reason: r.reason,
        escort: r.escort, relation: r.relation, mode: r.mode, remarks: ''
      });
    });

    // stock two of the first aid boxes, and set a scale on the first
    var boxes = Store.boxes();
    if (boxes.length) {
      var scale = [[5, 6], [6, 10], [7, 2], [0, 2]];   // syringe, gloves, cotton, paracetamol
      scale.forEach(function (pair) {
        Store.setBoxScale(boxes[0].id, made[pair[0]].id, pair[1]);
      });
      Store.saveBoxEntry({
        no: Store.nextBoxNo(day(4)), date: day(4), boxId: boxes[0].id, type: 'FILL',
        by: 'K. Ramesh', remarks: 'Monthly refill',
        lines: scale.map(function (pair) {
          return { itemId: made[pair[0]].id, qty: pair[1], remarks: '' };
        })
      });
      Store.saveBoxEntry({
        no: Store.nextBoxNo(day(9)), date: day(9), boxId: boxes[0].id, type: 'USE',
        by: 'Security', remarks: 'Minor cut — workshop',
        lines: [{ itemId: made[6].id, qty: 2, remarks: '' }, { itemId: made[7].id, qty: 1, remarks: '' }]
      });
    }
    if (boxes.length > 4) {
      Store.saveBoxEntry({
        no: Store.nextBoxNo(day(6)), date: day(6), boxId: boxes[4].id, type: 'FILL',
        by: 'K. Ramesh', remarks: 'Guest house box',
        lines: [
          { itemId: made[0].id, qty: 2, remarks: '' },
          { itemId: made[6].id, qty: 6, remarks: '' },
          { itemId: made[8].id, qty: 10, remarks: '' }
        ]
      });
    }

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
      case 'rx': Rx.refreshSelects(); Rx.render(); break;
      case 'referrals': Referrals.render(); break;
      case 'firstaid': FirstAid.render(); break;
      case 'reports': Reports.render(); break;
      case 'settings': loadSettings(); break;
    }
  }

  /* ---------------- desktop build ---------------- */

  /**
   * When running inside the Electron shell the register is a file on
   * disk, the native menu drives the app, and backup/restore go
   * through the operating system's own dialogs.
   */
  function desktopSetup() {
    var d = global.desktop;
    if (!d || !d.isDesktop) return;

    document.body.classList.add('is-desktop');

    // the browser-storage warning does not apply to the desktop build
    UI.$$('.browser-only').forEach(function (el) { el.classList.add('hidden'); });
    UI.$$('.desktop-only').forEach(function (el) { el.classList.remove('hidden'); });

    var p = d.paths ? d.paths() : null;
    if (p) {
      var el = UI.$('#dataPath');
      if (el) el.textContent = p.dataFile;
      var bk = UI.$('#backupPath');
      if (bk) bk.textContent = p.backupDir;
      var vr = UI.$('#appVersion');
      if (vr) vr.textContent = 'v' + p.version;
    }

    UI.$('#sidebarHint').innerHTML =
      'Saved automatically to a file on this computer.<br />A snapshot is kept each day.';

    var pdfBtn = UI.$('#btnPdfReport');
    if (pdfBtn) {
      pdfBtn.classList.remove('hidden');
      pdfBtn.addEventListener('click', savePdf);
    }

    d.onMenu(function (cmd) {
      if (cmd.indexOf('go:') === 0) { go(cmd.slice(3)); return; }
      switch (cmd) {
        case 'new-item': go('items'); Items.open(null); break;
        case 'new-txn': go('txns'); break;
        case 'new-rx': go('rx'); Rx.reset(); break;
        case 'new-referral': go('referrals'); Referrals.reset(); break;
        case 'new-box-entry': go('firstaid'); FirstAid.reset(); break;
        case 'print':
          if (current !== 'reports') Reports.openWith('monthly-all');
          setTimeout(function () { global.print(); }, 120);
          break;
        case 'pdf': savePdf(); break;
        case 'sample': go('settings'); sample(); break;
        case 'guide': go('settings'); UI.$('#guideCard').scrollIntoView({ behavior: 'smooth' }); break;
      }
    });
  }

  function savePdf() {
    if (!global.desktop || !global.desktop.savePdf) return;
    if (current !== 'reports') Reports.openWith('monthly-all');
    setTimeout(function () {
      var name = UI.$('#reportType').options[UI.$('#reportType').selectedIndex].text
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      global.desktop.savePdf(name + '.pdf').then(function (r) {
        if (r && r.ok) UI.toast('PDF saved');
        else if (r && !r.canceled) UI.toast('Could not save the PDF', 'bad');
      });
    }, 150);
  }

  /* ---------------- boot ---------------- */

  function init() {
    Store.load();

    Items.init();
    Txns.init();
    Monthly.init();
    Maint.init();
    Rx.init();
    Referrals.init();
    FirstAid.init();
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
    UI.$('#btnCsvRx').addEventListener('click', csvRx);
    UI.$('#btnCsvReferrals').addEventListener('click', csvReferrals);
    UI.$('#btnCsvBoxes').addEventListener('click', csvBoxes);
    UI.$('#btnSample').addEventListener('click', sample);
    UI.$('#btnWipe').addEventListener('click', wipe);

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && current !== 'reports') {
        e.preventDefault();
        Reports.openWith('monthly-all');
      }
    });

    desktopSetup();

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
