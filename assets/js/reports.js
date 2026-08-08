/* ============================================================
   reports.js — printable A4 reports for the register
   ============================================================ */
(function (global) {
  'use strict';

  var esc = null, num = null, dmy = null, money = null;

  function bind() { esc = UI.esc; num = UI.num; dmy = UI.dmy; money = UI.money; }

  /* ---------------- shared page furniture ---------------- */

  function header(title, subtitle) {
    var s = Store.settings();
    return '<div class="rp-head">' +
      '<div class="rp-centre">' + esc(s.centreName || 'Medical Centre') + '</div>' +
      (s.address ? '<div class="rp-addr">' + esc(s.address) + '</div>' : '') +
      '<div class="rp-title">' + esc(title) + '</div>' +
      (subtitle ? '<div class="rp-sub">' + esc(subtitle) + '</div>' : '') +
      '</div>';
  }

  function footer(extraNote) {
    var s = Store.settings();
    var d = new Date();
    var printed = String(d.getDate()).padStart(2, '0') + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
    return (extraNote ? '<div class="rp-note">' + esc(extraNote) + '</div>' : '') +
      '<div class="rp-sign">' +
      '<div class="sign-box"><div class="sign-line"></div>' +
      '<div>Store Keeper / Pharmacist</div>' +
      '<div class="sign-name">' + esc(s.storeKeeper || '') + '</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div>' +
      '<div>Verified by</div><div class="sign-name">&nbsp;</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div>' +
      '<div>Medical Officer in charge</div>' +
      '<div class="sign-name">' + esc(s.officer || '') + '</div></div>' +
      '</div>' +
      '<div class="rp-printed">Printed on ' + printed + '</div>';
  }

  function table(cols, rows, opts) {
    opts = opts || {};
    var h = '<table class="rp-table"><thead><tr>' +
      cols.map(function (c) {
        return '<th' + (c.w ? ' style="width:' + c.w + '"' : '') +
          (c.align ? ' class="ta-' + c.align + '"' : '') + '>' + esc(c.label) + '</th>';
      }).join('') + '</tr></thead><tbody>';

    if (!rows.length) {
      h += '<tr><td colspan="' + cols.length + '" class="rp-empty">— no entries —</td></tr>';
    }
    rows.forEach(function (r) {
      h += '<tr>' + r.map(function (cell, i) {
        var c = cols[i] || {};
        return '<td' + (c.align ? ' class="ta-' + c.align + '"' : '') + '>' +
          (cell === null || cell === undefined ? '' : cell) + '</td>';
      }).join('') + '</tr>';
    });

    // blank ruled lines so the sheet can be written on by hand
    var blanks = opts.blanks === undefined ? 3 : opts.blanks;
    for (var i = 0; i < blanks; i++) {
      h += '<tr class="rp-blank">' + cols.map(function () { return '<td>&nbsp;</td>'; }).join('') + '</tr>';
    }

    if (opts.total) {
      h += '<tr class="rp-total">' + opts.total.map(function (cell, i) {
        var c = cols[i] || {};
        return '<td' + (c.align ? ' class="ta-' + c.align + '"' : '') + '><b>' +
          (cell === null || cell === undefined ? '' : cell) + '</b></td>';
      }).join('') + '</tr>';
    }

    return h + '</tbody></table>';
  }

  /* ---------------- individual reports ---------------- */

  function monthlyStock(cats, month, title) {
    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Name of item', w: '23%' },
      { label: 'Unit', w: '7%' },
      { label: 'Batch / Expiry', w: '12%' },
      { label: 'Opening', w: '7%', align: 'right' },
      { label: 'Received', w: '7%', align: 'right' },
      { label: 'Issued', w: '7%', align: 'right' },
      { label: 'Exp/Dmg', w: '7%', align: 'right' },
      { label: 'Closing (book)', w: '8%', align: 'right' },
      { label: 'Physical', w: '8%', align: 'right' },
      { label: 'Diff.', w: '5%', align: 'right' },
      { label: 'Remarks', w: '10%' }
    ];

    var rows = [], sl = 0;
    var tOpen = 0, tIn = 0, tOut = 0, tExp = 0, tBook = 0, tPhys = 0;

    cats.forEach(function (cat) {
      Store.items(cat).forEach(function (it) {
        var s = Store.monthSummary(it.id, month);
        sl++;
        var phys = (s.physical === null || s.physical === undefined) ? null : Number(s.physical);
        var diff = phys === null ? null : phys - s.book;

        tOpen += s.opening; tIn += s.receipts; tOut += s.issues;
        tExp += s.writeOff; tBook += s.book; tPhys += (phys || 0);

        rows.push([
          sl,
          '<b>' + esc(it.name) + '</b>' + (it.spec ? '<br><span class="rp-dim">' + esc(it.spec) + '</span>' : ''),
          esc(it.unit || ''),
          esc(it.batchNo || '—') + (it.expiry ? '<br><span class="rp-dim">' + dmy(it.expiry) + '</span>' : ''),
          num(s.opening), num(s.receipts), num(s.issues), num(s.writeOff),
          '<b>' + num(s.book) + '</b>',
          phys === null ? '' : num(phys),
          diff === null ? '' : (diff > 0 ? '+' : '') + num(diff),
          esc(s.remarks || '')
        ]);
      });
    });

    return header(title, 'Stock register for the month of ' + Store.monthName(month)) +
      table(cols, rows, {
        blanks: 4,
        total: ['', 'TOTAL', '', '', num(tOpen), num(tIn), num(tOut), num(tExp), num(tBook), num(tPhys), '', '']
      }) +
      footer('Certified that the physical stock has been verified and found as entered above.');
  }

  function assetRegister() {
    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Asset tag', w: '9%' },
      { label: 'Name of asset', w: '20%' },
      { label: 'Serial / Model', w: '12%' },
      { label: 'Date of purchase', w: '9%', align: 'center' },
      { label: 'Supplier', w: '11%' },
      { label: 'Cost', w: '9%', align: 'right' },
      { label: 'Qty', w: '5%', align: 'right' },
      { label: 'Condition', w: '9%' },
      { label: 'Location', w: '12%' }
    ];

    var rows = [], sl = 0, total = 0, qty = 0;
    Store.items('asset').forEach(function (it) {
      sl++;
      var b = Store.balance(it.id);
      var cost = Number(it.purchaseCost) || 0;
      total += cost * (b || 1);
      qty += b;
      rows.push([
        sl, esc(it.assetTag || '—'),
        '<b>' + esc(it.name) + '</b>' + (it.spec ? '<br><span class="rp-dim">' + esc(it.spec) + '</span>' : ''),
        esc(it.serialNo || '—'),
        dmy(it.purchaseDate),
        esc(it.supplier || '—'),
        it.purchaseCost ? money(it.purchaseCost) : '',
        num(b),
        esc(it.condition || 'Working'),
        esc(it.location || '—')
      ]);
    });

    return header('Permanent Asset Register', 'Dead stock / non-consumable articles') +
      table(cols, rows, {
        blanks: 4,
        total: ['', '', 'TOTAL', '', '', '', money(total), num(qty), '', '']
      }) +
      footer('Certified that the above articles have been physically verified and are in the custody of this centre.');
  }

  function expiryReport() {
    var cols = [
      { label: 'Sl.', w: '5%', align: 'center' },
      { label: 'Name of item', w: '28%' },
      { label: 'Batch No.', w: '13%' },
      { label: 'Expiry', w: '10%', align: 'center' },
      { label: 'Qty in hand', w: '10%', align: 'right' },
      { label: 'Unit', w: '8%' },
      { label: 'Value', w: '10%', align: 'right' },
      { label: 'Status', w: '16%' }
    ];

    var rows = [], sl = 0, value = 0;
    Store.expiring().forEach(function (r) {
      sl++;
      var v = (Number(r.item.rate) || 0) * r.balance;
      value += v;
      rows.push([
        sl,
        '<b>' + esc(r.item.name) + '</b>' + (r.item.spec ? ' <span class="rp-dim">' + esc(r.item.spec) + '</span>' : ''),
        esc(r.item.batchNo || '—'),
        dmy(r.item.expiry),
        num(r.balance),
        esc(r.item.unit || ''),
        r.item.rate ? money(v) : '',
        r.expired ? '<b>EXPIRED</b>' : 'Expires in ' + r.daysLeft + ' days'
      ]);
    });

    var days = Number(Store.settings().expiryDays) || 90;
    return header('Expiry / Near-Expiry Report',
      'Items expired or expiring within ' + days + ' days') +
      table(cols, rows, { blanks: 3, total: ['', 'TOTAL VALUE', '', '', '', '', money(value), ''] }) +
      footer('Expired items are to be segregated, entered as write-off and disposed of as per procedure.');
  }

  function indentList() {
    var cols = [
      { label: 'Sl.', w: '5%', align: 'center' },
      { label: 'Name of item', w: '30%' },
      { label: 'Unit', w: '8%' },
      { label: 'Stock in hand', w: '11%', align: 'right' },
      { label: 'Minimum level', w: '11%', align: 'right' },
      { label: 'Qty required', w: '11%', align: 'right' },
      { label: 'Approx. rate', w: '10%', align: 'right' },
      { label: 'Remarks', w: '14%' }
    ];

    var rows = [], sl = 0;
    Store.lowStock().forEach(function (r) {
      sl++;
      var need = Math.max(0, r.min * 2 - r.balance);
      rows.push([
        sl,
        '<b>' + esc(r.item.name) + '</b>' + (r.item.spec ? ' <span class="rp-dim">' + esc(r.item.spec) + '</span>' : ''),
        esc(r.item.unit || ''),
        num(r.balance), num(r.min), num(need),
        r.item.rate ? money(r.item.rate) : '',
        r.balance <= 0 ? '<b>NIL STOCK</b>' : ''
      ]);
    });

    return header('Indent — Items Below Minimum Level',
      'Stock position as on ' + dmy(UI.today())) +
      table(cols, rows, { blanks: 6 }) +
      footer('Suggested quantity is twice the minimum level less the stock in hand. Revise as required before indenting.');
  }

  function maintReport() {
    var cols = [
      { label: 'Sl.', w: '5%', align: 'center' },
      { label: 'Asset', w: '24%' },
      { label: 'Date', w: '10%', align: 'center' },
      { label: 'Nature of work', w: '13%' },
      { label: 'Done by', w: '16%' },
      { label: 'Cost', w: '10%', align: 'right' },
      { label: 'Next due', w: '10%', align: 'center' },
      { label: 'Remarks', w: '12%' }
    ];

    var rows = [], sl = 0, total = 0;
    Store.maint().forEach(function (m) {
      var it = Store.item(m.itemId);
      sl++;
      total += Number(m.cost) || 0;
      rows.push([
        sl,
        '<b>' + esc(it ? it.name : '(deleted)') + '</b>' +
        (it && it.assetTag ? '<br><span class="rp-dim">' + esc(it.assetTag) + '</span>' : ''),
        dmy(m.date), esc(m.type || ''), esc(m.doneBy || '—'),
        m.cost ? money(m.cost) : '', m.nextDue ? dmy(m.nextDue) : '—',
        esc(m.remarks || '')
      ]);
    });

    return header('Asset Maintenance Register', 'Service, repair and calibration record') +
      table(cols, rows, { blanks: 4, total: ['', 'TOTAL', '', '', '', money(total), '', ''] }) +
      footer();
  }

  function ledger(itemId, month) {
    var it = Store.item(itemId);
    if (!it) return '<div class="rp-empty-page">Select an item to print its ledger.</div>';

    var s = Store.monthSummary(itemId, month);
    var list = Store.txns({ itemId: itemId, month: month }).slice().reverse();

    var cols = [
      { label: 'Date', w: '10%', align: 'center' },
      { label: 'Particulars', w: '24%' },
      { label: 'Bill / Indent No.', w: '13%' },
      { label: 'Batch', w: '10%' },
      { label: 'Received', w: '9%', align: 'right' },
      { label: 'Issued', w: '9%', align: 'right' },
      { label: 'Balance', w: '9%', align: 'right' },
      { label: 'Remarks', w: '16%' }
    ];

    var running = s.opening;
    var rows = [[
      '', '<b>Opening balance</b>', '', '', '', '', '<b>' + num(running) + '</b>', ''
    ]];

    list.forEach(function (t) {
      running += Store.signed(t);
      var inQ = t.type === 'IN' ? Math.abs(t.qty) : (t.type === 'ADJ' && t.qty > 0 ? t.qty : '');
      var outQ = (t.type === 'OUT' || t.type === 'EXP') ? Math.abs(t.qty)
        : (t.type === 'ADJ' && t.qty < 0 ? Math.abs(t.qty) : '');
      rows.push([
        dmy(t.date),
        esc(t.party || UI.TYPE_LABEL[t.type]),
        esc(t.ref || '—'),
        esc(t.batchNo || '—'),
        inQ === '' ? '' : num(inQ),
        outQ === '' ? '' : num(outQ),
        num(running),
        esc(t.remarks || (t.type === 'EXP' ? 'Expired / damaged' : ''))
      ]);
    });

    var detail = '<div class="rp-meta">' +
      '<span><b>Item:</b> ' + esc(it.name) + (it.spec ? ' (' + esc(it.spec) + ')' : '') + '</span>' +
      '<span><b>Unit:</b> ' + esc(it.unit || '') + '</span>' +
      '<span><b>Category:</b> ' + UI.CAT_LABEL[it.category] + '</span>' +
      (it.code ? '<span><b>Code:</b> ' + esc(it.code) + '</span>' : '') +
      (it.location ? '<span><b>Rack:</b> ' + esc(it.location) + '</span>' : '') +
      '</div>';

    return header('Item Stock Ledger', Store.monthName(month)) + detail +
      table(cols, rows, {
        blanks: 6,
        total: ['', 'CLOSING BALANCE', '', '', num(s.receipts), num(s.issues + s.writeOff), num(s.book), '']
      }) +
      footer();
  }

  function daybook(month) {
    var cols = [
      { label: 'Date', w: '9%', align: 'center' },
      { label: 'Name of item', w: '24%' },
      { label: 'Entry', w: '10%' },
      { label: 'Qty', w: '7%', align: 'right' },
      { label: 'Unit', w: '6%' },
      { label: 'Bill / Indent No.', w: '13%' },
      { label: 'Received from / Issued to', w: '19%' },
      { label: 'Remarks', w: '12%' }
    ];

    var list = Store.txns({ month: month }).slice().reverse();
    var rows = list.map(function (t) {
      var it = Store.item(t.itemId) || {};
      return [
        dmy(t.date),
        '<b>' + esc(it.name || '(deleted)') + '</b>',
        UI.TYPE_LABEL[t.type],
        num(Math.abs(t.qty)),
        esc(it.unit || ''),
        esc(t.ref || '—'),
        esc(t.party || '—'),
        esc(t.remarks || '')
      ];
    });

    return header('Receipt & Issue Day Book', Store.monthName(month)) +
      table(cols, rows, { blanks: 5 }) + footer();
  }

  function rxRegister(month) {
    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Date', w: '8%', align: 'center' },
      { label: 'Prescription No.', w: '11%' },
      { label: 'Name of patient', w: '17%' },
      { label: 'Age / Sex', w: '8%', align: 'center' },
      { label: 'Problem / Diagnosis', w: '19%' },
      { label: 'Medicines issued', w: '23%' },
      { label: 'Prescribed by', w: '10%' }
    ];

    var list = Store.rxList({ month: month }).slice().reverse();
    var rows = [], sl = 0, medCount = 0;

    list.forEach(function (r) {
      sl++;
      var meds = (r.lines || []).map(function (l) {
        var it = Store.item(l.itemId);
        medCount += 1;
        return esc(it ? it.name : '(deleted item)') + ' — ' + num(l.qty) +
          (it && it.unit ? ' ' + esc(it.unit) : '') +
          (l.dose ? ' <span class="rp-dim">(' + esc(l.dose) + ')</span>' : '');
      }).join('<br>') || '<span class="rp-dim">—</span>';

      rows.push([
        sl, dmy(r.date), esc(r.no || '—'),
        '<b>' + esc(r.patient || '') + '</b>',
        esc([r.age, r.sex].filter(Boolean).join(' / ')) || '—',
        esc(r.problem || '—'),
        meds,
        esc(r.doctor || '—')
      ]);
    });

    return header('Prescription Register — Out-Patients', Store.monthName(month)) +
      table(cols, rows, {
        blanks: 4,
        total: ['', '', 'TOTAL', sl + ' patients', '', '', medCount + ' medicine lines issued', '']
      }) +
      footer('Medicines shown above have been issued from the stock and are accounted for in the monthly stock register.');
  }

  function referralRegister(month) {
    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Date', w: '8%', align: 'center' },
      { label: 'Slip No.', w: '10%' },
      { label: 'Name of patient', w: '15%' },
      { label: 'Age / Sex', w: '7%', align: 'center' },
      { label: 'Referred to (hospital)', w: '17%' },
      { label: 'Under / Dept.', w: '11%' },
      { label: 'Reason for referral', w: '15%' },
      { label: 'Accompanied by (relation)', w: '13%' }
    ];

    var list = Store.referralList({ month: month }).slice().reverse();
    var rows = [], sl = 0;

    list.forEach(function (r) {
      sl++;
      var escort = r.escort ? esc(r.escort) +
        (r.relation ? ' <span class="rp-dim">(' + esc(r.relation) + ')</span>' : '') : '—';
      rows.push([
        sl, dmy(r.date), esc(r.no || '—'),
        '<b>' + esc(r.patient || '') + '</b>',
        esc([r.age, r.sex].filter(Boolean).join(' / ')) || '—',
        esc(r.hospital || '—'),
        esc(r.referredTo || '—'),
        esc(r.reason || '—') + (r.mode ? '<br><span class="rp-dim">' + esc(r.mode) + '</span>' : ''),
        escort
      ]);
    });

    return header('Referral Register', Store.monthName(month)) +
      table(cols, rows, {
        blanks: 5,
        total: ['', '', 'TOTAL', sl + ' patients referred', '', '', '', '', '']
      }) +
      footer();
  }

  function firstAidSheet() {
    var cols = [
      { label: 'Sl.', w: '5%', align: 'center' },
      { label: 'Name of item', w: '27%' },
      { label: 'Unit', w: '8%' },
      { label: 'Required', w: '9%', align: 'right' },
      { label: 'Found in box', w: '11%', align: 'right' },
      { label: 'Short by', w: '9%', align: 'right' },
      { label: 'Batch', w: '11%' },
      { label: 'Expiry', w: '10%', align: 'center' },
      { label: 'Remarks', w: '10%' }
    ];

    var today = new Date();
    var out = header('First Aid Box Check Sheet',
      'Contents verified as on ' + dmy(UI.today()));

    var list = Store.boxes();
    if (!list.length) {
      return out + '<div class="rp-empty-page">No first aid boxes have been set up.</div>';
    }

    list.forEach(function (b) {
      var rows = [], sl = 0;
      Store.boxItems(b.id).forEach(function (r) {
        sl++;
        var short = r.required > 0 ? Math.max(0, r.required - r.inBox) : 0;
        var note = '';
        if (r.item.expiry) {
          var y = +r.item.expiry.slice(0, 4), mo = +r.item.expiry.slice(5, 7);
          if (new Date(y, mo, 0) < today && r.inBox > 0) note = '<b>EXPIRED — replace</b>';
        }
        rows.push([
          sl,
          '<b>' + esc(r.item.name) + '</b>' +
          (r.item.spec ? ' <span class="rp-dim">' + esc(r.item.spec) + '</span>' : ''),
          esc(r.item.unit || ''),
          r.required > 0 ? num(r.required) : '—',
          num(r.inBox),
          short > 0 ? '<b>' + num(short) + '</b>' : '—',
          esc(r.item.batchNo || '—'),
          r.item.expiry ? dmy(r.item.expiry) : '—',
          note
        ]);
      });

      out += '<div class="rp-boxhead">' + esc(b.name) +
        (b.location ? ' — ' + esc(b.location) : '') +
        (b.incharge ? '  <span class="rp-dim">(in charge: ' + esc(b.incharge) + ')</span>' : '') +
        '</div>' + table(cols, rows, { blanks: 3 });
    });

    return out + footer('Certified that the first aid boxes listed above have been ' +
      'checked, the shortages made good and expired items replaced.');
  }

  function firstAidMovement(month) {
    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Date', w: '9%', align: 'center' },
      { label: 'Entry No.', w: '11%' },
      { label: 'Box', w: '16%' },
      { label: 'What happened', w: '16%' },
      { label: 'Items', w: '24%' },
      { label: 'By', w: '10%' },
      { label: 'Remarks', w: '10%' }
    ];

    var list = Store.boxEntries({ month: month }).slice().reverse();
    var rows = [], sl = 0;
    list.forEach(function (e) {
      sl++;
      var b = Store.box(e.boxId);
      var items = (e.lines || []).map(function (l) {
        var it = Store.item(l.itemId);
        return esc(it ? it.name : '(deleted item)') + ' — ' + num(l.qty) +
          (it && it.unit ? ' ' + esc(it.unit) : '');
      }).join('<br>') || '—';
      rows.push([
        sl, dmy(e.date), esc(e.no || '—'),
        '<b>' + esc(b ? b.name : '(deleted box)') + '</b>',
        esc(Store.BOX_TYPES[e.type] || e.type),
        items, esc(e.by || '—'), esc(e.remarks || '')
      ]);
    });

    return header('First Aid Box Movement Register', Store.monthName(month)) +
      table(cols, rows, { blanks: 4, total: ['', '', 'TOTAL', sl + ' entries', '', '', '', ''] }) +
      footer('Items filled into a box are issued from the main stock and appear in the monthly stock register.');
  }

  /* ---------------- controller ---------------- */

  function build(type, month, itemId) {
    bind();
    month = month || Store.currentMonth();
    switch (type) {
      case 'monthly-medicine': return monthlyStock(['medicine'], month, 'Monthly Stock Register — Medicines');
      case 'monthly-disposable': return monthlyStock(['disposable'], month, 'Monthly Stock Register — Disposable Items');
      case 'monthly-all': return monthlyStock(['medicine', 'disposable'], month, 'Monthly Stock Register — Medicines & Disposables');
      case 'asset': return assetRegister();
      case 'expiry': return expiryReport();
      case 'indent': return indentList();
      case 'maint': return maintReport();
      case 'rx-register': return rxRegister(month);
      case 'referral-register': return referralRegister(month);
      case 'firstaid': return firstAidSheet();
      case 'firstaid-movement': return firstAidMovement(month);
      case 'ledger': return ledger(itemId, month);
      case 'daybook': return daybook(month);
      default: return '';
    }
  }

  function needsMonth(t) {
    return t.indexOf('monthly') === 0 || t === 'ledger' || t === 'daybook' ||
      t === 'rx-register' || t === 'referral-register' || t === 'firstaid-movement';
  }
  function needsItem(t) { return t === 'ledger'; }

  function syncPickers() {
    var t = UI.$('#reportType').value;
    UI.$('#repMonthWrap').classList.toggle('hidden', !needsMonth(t));
    UI.$('#repItemWrap').classList.toggle('hidden', !needsItem(t));
  }

  function show() {
    var t = UI.$('#reportType').value;
    var html = build(t, UI.$('#reportMonth').value, UI.$('#reportItem').value);
    UI.$('#reportArea').innerHTML = '<div class="sheet">' + html + '</div>';
  }

  function init() {
    bind();
    UI.$('#reportMonth').value = Store.currentMonth();
    UI.$('#reportType').addEventListener('change', function () { syncPickers(); show(); });
    UI.$('#reportMonth').addEventListener('change', show);
    UI.$('#reportItem').addEventListener('change', show);
    UI.$('#btnBuildReport').addEventListener('click', show);
    UI.$('#btnPrintReport').addEventListener('click', function () { show(); setTimeout(function () { window.print(); }, 60); });
    syncPickers();
  }

  function render() {
    UI.itemOptions(UI.$('#reportItem'), 'all', UI.$('#reportItem').value);
    show();
  }

  function openWith(type) {
    App.go('reports');
    UI.$('#reportType').value = type;
    syncPickers();
    render();
  }

  global.Reports = { init: init, render: render, build: build, openWith: openWith };

})(window);
