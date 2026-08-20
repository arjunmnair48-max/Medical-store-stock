/* ============================================================
   reports.js — the printed sheet, and the picker that drives it

   Everything the register prints comes off one A4 sheet with the
   office's name at the top, a totals row and a signature block at the
   foot. This file owns that furniture and the picker; the statements
   themselves are built in statements.js.
   ============================================================ */
(function (global) {
  'use strict';

  var esc = null, num = null, dmy = null, money = null;

  function bind() { esc = UI.esc; num = UI.num; dmy = UI.dmy; money = UI.money; }

  /* ---------------- shared page furniture ---------------- */

  function header(title, subtitle) {
    var s = Store.settings();
    return '<div class="rp-head">' +
      '<div class="rp-centre">' + esc(s.officeName || 'Medical Centre') + '</div>' +
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
      '<div>Dealing Assistant</div>' +
      '<div class="sign-name">' + esc(s.dealingAssistant || '') + '</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div>' +
      '<div>Verified by</div><div class="sign-name">&nbsp;</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div>' +
      '<div>Sanctioning Authority</div>' +
      '<div class="sign-name">' + esc(s.sanctioning || s.officer || '') + '</div></div>' +
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

  function slipHead(title, no, date) {
    var st = Store.settings();
    return '<div class="slip-head">' +
      '<div class="rp-centre">' + esc(st.officeName || 'Medical Centre') + '</div>' +
      (st.address ? '<div class="rp-addr">' + esc(st.address) + '</div>' : '') +
      '<div class="slip-title">' + esc(title) + '</div>' +
      '</div>' +
      '<div class="slip-meta">' +
      '<span><b>No.</b> ' + esc(no || '—') + '</span>' +
      '<span><b>Date</b> ' + dmy(date) + '</span>' +
      '</div>';
  }

  function slipField(label, value, wide) {
    return '<div class="slip-field' + (wide ? ' wide' : '') + '">' +
      '<span class="slip-label">' + esc(label) + '</span>' +
      '<span class="slip-value">' + (value || '&nbsp;') + '</span></div>';
  }

  /* ---------------- what each sheet needs asked for ---------------- */

  function needsMonth(t) { return t === 'monthly'; }
  function needsYear(t) {
    return t === 'annual' || t === 'staff-statement' || t === 'hospital-statement' ||
      t === 'hospital-reimb' || t === 'staff-reimb';
  }
  function needsStaff(t) { return t === 'staff-statement'; }
  function needsHospital(t) { return t === 'hospital-statement'; }
  function needsRecord(t) { return t === 'voucher' || t === 'card'; }

  /** The vouchers and cards read better upright; every other sheet is wide. */
  function isPortrait(t) { return needsRecord(t); }

  /* ---------------- the pickers ---------------- */

  function fillRecords() {
    var t = UI.$('#reportType').value;
    var sel = UI.$('#reportRecord');
    if (!needsRecord(t)) { sel.innerHTML = ''; return; }
    var keep = sel.value;
    var list, label, describe;

    if (t === 'voucher') {
      list = Store.claimList(); label = 'Claim';
      describe = function (c) {
        return (c.no || '—') + ' · ' + UI.dmy(c.treatFrom) + ' · ' + (c.benName || '');
      };
    } else {
      list = Store.staffList(); label = 'Staff member';
      describe = function (s) { return s.name + (s.empNo ? ' [' + s.empNo + ']' : ''); };
    }

    UI.$('#repRecordLabel').textContent = label;
    sel.innerHTML = list.length
      ? list.map(function (r) {
        return '<option value="' + esc(r.id) + '"' + (r.id === keep ? ' selected' : '') + '>' +
          esc(describe(r)) + '</option>';
      }).join('')
      : '<option value="">— nothing recorded yet —</option>';
  }

  function fillYears() {
    var sel = UI.$('#reportYear');
    var keep = sel.value;
    sel.innerHTML = Store.fyList().map(function (f) {
      return '<option value="' + esc(f) + '"' + (f === keep ? ' selected' : '') + '>' +
        esc(Store.fyName(f)) + '</option>';
    }).join('') + '<option value="all"' + (keep === 'all' ? ' selected' : '') +
      '>All years</option>';
    if (keep) sel.value = keep;
  }

  function fillStaff() {
    var sel = UI.$('#reportStaff');
    var keep = sel.value;
    var list = Store.staffList();
    sel.innerHTML = list.length
      ? list.map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (s.id === keep ? ' selected' : '') + '>' +
          esc(s.name + (s.empNo ? ' [' + s.empNo + ']' : '')) + '</option>';
      }).join('')
      : '<option value="">— no staff entered yet —</option>';
  }

  function fillHospitals() {
    var sel = UI.$('#reportHospital');
    var keep = sel.value;
    var list = Store.hospitalList();
    sel.innerHTML = list.length
      ? list.map(function (h) {
        return '<option value="' + esc(h.id) + '"' + (h.id === keep ? ' selected' : '') + '>' +
          esc(h.name + (h.city ? ', ' + h.city : '')) + '</option>';
      }).join('')
      : '<option value="">— no hospital entered yet —</option>';
  }

  function syncPickers() {
    var t = UI.$('#reportType').value;
    UI.$('#repMonthWrap').classList.toggle('hidden', !needsMonth(t));
    UI.$('#repYearWrap').classList.toggle('hidden', !needsYear(t));
    UI.$('#repStaffWrap').classList.toggle('hidden', !needsStaff(t));
    UI.$('#repHospitalWrap').classList.toggle('hidden', !needsHospital(t));
    UI.$('#repRecordWrap').classList.toggle('hidden', !needsRecord(t));
    UI.$('#btnCsvReport').classList.toggle('hidden', needsRecord(t));
    fillYears();
    fillStaff();
    fillHospitals();
    fillRecords();
  }

  /**
   * The pickers, gathered into the shape the statements read.
   *
   * The month goes in only for the sheet that is actually cut by month —
   * the month picker always holds a value, and a stray month would quietly
   * narrow a statement that was asked for by year.
   */
  function context(type) {
    var c = {
      fy: UI.$('#reportYear').value,
      staffId: UI.$('#reportStaff').value,
      hospitalId: UI.$('#reportHospital').value,
      recordId: UI.$('#reportRecord').value
    };
    if (needsMonth(type)) c.month = UI.$('#reportMonth').value;
    return c;
  }

  function build(type, ctx) {
    bind();
    return Statements.build(type, ctx || context(type));
  }

  function show() {
    var t = UI.$('#reportType').value;
    var html = build(t);
    UI.$('#reportArea').innerHTML =
      '<div class="sheet' + (isPortrait(t) ? ' sheet-portrait' : '') + '">' + html + '</div>';
  }

  /** Hands the sheet on screen over as a spreadsheet file. */
  function downloadCsv() {
    var t = UI.$('#reportType').value;
    var out = Statements.csv(t, context(t));
    if (!out) { UI.toast('This sheet cannot be downloaded as a spreadsheet', 'warn'); return; }
    UI.download(out.name, UI.toCsv(out.rows), 'text/csv');
    UI.toast('Downloaded ' + (out.rows.length - 1) + ' line(s)');
  }

  /* ---------------- init ---------------- */

  function init() {
    bind();
    UI.$('#reportMonth').value = Store.currentMonth();
    UI.$('#reportType').addEventListener('change', function () { syncPickers(); show(); });
    ['#reportMonth', '#reportYear', '#reportStaff', '#reportHospital', '#reportRecord']
      .forEach(function (sel) {
        UI.$(sel).addEventListener('change', show);
      });
    UI.$('#btnBuildReport').addEventListener('click', show);
    UI.$('#btnCsvReport').addEventListener('click', downloadCsv);
    UI.$('#btnPrintReport').addEventListener('click', function () {
      show();
      setTimeout(function () { window.print(); }, 60);
    });
    syncPickers();
  }

  function render() {
    fillYears();
    fillStaff();
    fillHospitals();
    fillRecords();
    show();
  }

  /** Jump straight to one sheet. */
  function openWith(type) {
    App.go('reports');
    UI.$('#reportType').value = type;
    syncPickers();
    render();
  }

  /** Jump straight to a voucher or a card for one record. */
  function openSlip(type, recordId) {
    App.go('reports');
    UI.$('#reportType').value = type;
    syncPickers();
    UI.$('#reportRecord').value = recordId;
    show();
    UI.$('#reportArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  global.Reports = {
    init: init, render: render, build: build, openWith: openWith, openSlip: openSlip,
    downloadCsv: downloadCsv,

    /* the page furniture every printed sheet shares */
    parts: {
      bind: bind, header: header, table: table, footer: footer,
      slipHead: slipHead, slipField: slipField
    }
  };

})(window);
