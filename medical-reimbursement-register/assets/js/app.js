/* ============================================================
   app.js — router, dashboard, settings, backup
   Medical Reimbursement Register
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
    var m = Store.currentMonth();
    var fy = Store.currentFy();

    var staff = Store.staffList();
    var serving = staff.filter(function (s) { return (s.status || 'Serving') === 'Serving'; }).length;
    var deps = Store.load().deps.length;

    var hosp = Store.hospitalList();
    var live = hosp.filter(function (h) {
      var st = Store.empanelStatus(h);
      return st === 'active' || st === 'expiring' || st === 'open';
    }).length;
    var empanelDue = Store.empanelAlerts().length;

    var month = Store.claimTotals(Store.claimList({ month: m }));
    var year = Store.claimTotals(Store.claimList({ fy: fy }));
    var cashless = Store.claimTotals(Store.claimList({ fy: fy, type: 'HOSPITAL' }));
    var reimb = Store.claimTotals(Store.claimList({ fy: fy, type: 'REIMB' }));
    var due = Store.claimTotals(Store.claimsPending({ fy: fy }));

    var cards = [
      { k: 'Staff on register', v: staff.length, s: serving + ' serving · ' + deps + ' dependents', cls: '' },
      { k: 'Empanelled hospitals', v: live, s: empanelDue ? empanelDue + ' need an extension order' : 'all in force',
        cls: empanelDue ? 'warn' : live ? 'good' : '' },
      { k: 'Claims this month', v: month.count, s: UI.money(month.claimed) + ' claimed', cls: '' },
      { k: 'Claims this year', v: year.count, s: Store.fyName(fy), cls: '' },
      { k: 'Cashless — hospitals', v: UI.money(cashless.claimed), s: UI.money(cashless.reimbursed) + ' paid', cls: '' },
      { k: 'Reimbursement — staff', v: UI.money(reimb.claimed), s: UI.money(reimb.reimbursed) + ' paid', cls: '' },
      { k: 'Reimbursed this year', v: UI.money(year.reimbursed), s: 'of ' + UI.money(year.claimed) + ' claimed', cls: 'good' },
      { k: 'Outstanding', v: UI.money(due.balance), s: due.count + ' claim(s) still to be settled',
        cls: due.count ? 'warn' : 'good' }
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
    UI.$('#brandOffice').textContent = Store.settings().officeName || 'Medical Centre';

    miniList(UI.$('#pendingList'), Store.claimsPending().slice(0, 12).map(function (c) {
      var b = Store.claimant(c) || {};
      var bal = (Number(c.amountClaimed) || 0) - (Number(c.amountReimbursed) || 0);
      return {
        main: '<b>' + UI.esc(b.name || '—') + '</b> <span class="dim">' +
          UI.esc(Store.CLAIM_TYPE_SHORT[c.type] || '') + ' · ' + UI.esc(c.no || '') + '</span>',
        side: UI.money(bal),
        cls: (c.status || 'PENDING') === 'PENDING' ? 'warn' : ''
      };
    }), 'No claim is waiting to be settled. 👍');

    miniList(UI.$('#empanelList'), Store.empanelAlerts().slice(0, 12).map(function (r) {
      var expired = r.state === 'expired';
      return {
        main: '<b>' + UI.esc(r.hospital.name) + '</b> <span class="dim">' +
          UI.esc(r.hospital.city || '') + '</span>',
        side: (expired ? 'EXPIRED ' : 'upto ') + UI.dmy(r.hospital.empanelTo),
        cls: expired ? 'bad' : 'warn'
      };
    }), 'Every empanelment is in force.');

    // who has drawn the most this year — the question that gets asked
    miniList(UI.$('#topStaffList'), Store.claimsByStaff({ fy: Store.currentFy() })
      .slice(0, 8).map(function (g) {
        return {
          main: '<b>' + UI.esc(g.name) + '</b> <span class="dim">' +
            g.totals.count + ' claim' + (g.totals.count === 1 ? '' : 's') + '</span>',
          side: UI.money(g.totals.claimed),
          cls: ''
        };
      }), 'No claim drawn this year yet.');

    miniList(UI.$('#recentList'), Store.claimList().slice(0, 10).map(function (c) {
      var b = Store.claimant(c) || {};
      return {
        main: '<b>' + UI.esc(b.name || '—') + '</b> <span class="dim">' +
          UI.esc(c.hospitalName || '') + '</span>',
        side: UI.money(c.amountClaimed) + '  ·  ' + UI.dmy(c.treatFrom),
        cls: (c.status || 'PENDING') === 'PAID' ? 'good' : ''
      };
    }), 'No claim recorded yet. Enter the first one in Medical Claims.');
  }

  /* ---------------- settings & backup ---------------- */

  function loadSettings() {
    UI.fillForm(UI.$('#settingsForm'), Store.settings());
  }

  function saveSettings(e) {
    e.preventDefault();
    var o = UI.formToObject(UI.$('#settingsForm'));
    o.fyStartMonth = Number(o.fyStartMonth) || 4;
    o.empanelWarnDays = o.empanelWarnDays === '' ? 60 : Math.max(0, Number(o.empanelWarnDays) || 0);
    if (!o.currency) o.currency = '₹';
    Store.saveSettings(o);
    UI.$('#brandOffice').textContent = o.officeName || 'Medical Centre';
    document.title = (o.officeName || 'Medical Centre') + ' — Reimbursement Register';
    UI.toast('Settings saved');
    refresh();
  }

  function exportBackup() {
    var stamp = new Date().toISOString().slice(0, 10);
    var name = (Store.settings().officeName || 'office')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    UI.download('reimbursement-backup-' + name + '-' + stamp + '.json',
      JSON.stringify(Store.load(), null, 2));
    UI.toast('Backup downloaded');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); }
      catch (err) { UI.toast('That file is not a valid backup', 'bad'); return; }
      if (!data || !Array.isArray(data.claims) || !Array.isArray(data.staff)) {
        UI.toast('That file is not a reimbursement register backup', 'bad'); return;
      }
      var where = Store.backend === 'file' ? 'in this register' : 'in this browser';
      if (!confirm('Restore this backup?\n\n' + data.staff.length + ' staff, ' +
        (data.deps || []).length + ' dependents, ' + (data.hospitals || []).length +
        ' hospitals, ' + data.claims.length + ' claims.\n\nEVERYTHING currently ' + where +
        ' will be replaced.')) return;
      Store.replaceAll(data);
      loadSettings();
      refresh();
      UI.toast('Backup restored');
    };
    reader.readAsText(file);
  }

  /**
   * The registers export through the same builder the printed sheets use,
   * so a spreadsheet and a printed sheet never disagree.
   */
  function csvOf(type, filename) {
    var out = Statements.csv(type, { fy: 'all' });
    if (!out) return;
    UI.download(filename || out.name, UI.toCsv(out.rows), 'text/csv');
    UI.toast('Downloaded ' + (out.rows.length - 1) + ' line(s)');
  }

  /* ---------------- sample data ---------------- */

  function sample() {
    if (!confirm('Load a small set of demo staff, hospitals and claims?')) return;

    var people = [
      { empNo: '4471', name: 'Suresh Kumar P.', designation: 'Senior Assistant',
        department: 'Establishment', station: 'Head Office', idCardNo: 'MC/4471',
        dob: born(48), gender: 'Male', mobile: '9847012345', status: 'Serving',
        deps: [
          { name: 'Girija Suresh', relation: 'Spouse', dob: born(44), gender: 'Female', idCardNo: 'MC/4471/1' },
          { name: 'Arjun Suresh', relation: 'Son', dob: born(17), gender: 'Male', idCardNo: 'MC/4471/2' },
          { name: 'Kamalamma', relation: 'Mother', dob: born(74), gender: 'Female', idCardNo: 'MC/4471/3' }
        ] },
      { empNo: '5120', name: 'Anitha Joseph', designation: 'Technical Officer',
        department: 'Workshop', station: 'Head Office', idCardNo: 'MC/5120',
        dob: born(39), gender: 'Female', mobile: '9846098765', status: 'Serving',
        deps: [
          { name: 'Joseph Mathew', relation: 'Spouse', dob: born(42), gender: 'Male', idCardNo: 'MC/5120/1' },
          { name: 'Ann Maria Joseph', relation: 'Daughter', dob: born(9), gender: 'Female', idCardNo: 'MC/5120/2' }
        ] },
      { empNo: '3308', name: 'Ravindran Nair K.', designation: 'Driver',
        department: 'Transport', station: 'Sub Office', idCardNo: 'MC/3308',
        dob: born(56), gender: 'Male', mobile: '9895543210', status: 'Serving',
        deps: [
          { name: 'Sarasamma R.', relation: 'Spouse', dob: born(52), gender: 'Female', idCardNo: 'MC/3308/1' }
        ] },
      { empNo: '2201', name: 'Fathima Beevi', designation: 'Office Attendant',
        department: 'General', station: 'Head Office', idCardNo: 'MC/2201',
        dob: born(61), gender: 'Female', mobile: '9744112233', status: 'Retired',
        deps: [] }
    ];

    var staff = people.map(function (p) {
      var deps = p.deps;
      delete p.deps;
      var saved = Store.saveStaff(p);
      Store.saveDependents(saved.id, deps);
      return saved;
    });

    var hospitals = [
      { name: 'City Care Multi-speciality Hospital', address: 'M G Road', city: 'Ernakulam',
        phone: '0484-2200100', specialty: 'Multi-speciality', category: 'Multi-speciality',
        orderNo: 'HQ/EMP/2024/17', empanelFrom: shift(-700), empanelTo: shift(400),
        status: 'Empanelled', remarks: 'Cashless — all disciplines' },
      { name: 'Sunrise Eye Hospital', address: 'Bypass Road', city: 'Alappuzha',
        phone: '0477-2233445', specialty: 'Ophthalmology', category: 'Single speciality',
        orderNo: 'HQ/EMP/2024/22', empanelFrom: shift(-700), empanelTo: shift(45),
        status: 'Empanelled', remarks: '' },
      { name: 'St. Thomas Mission Hospital', address: 'Church Road', city: 'Cherthala',
        phone: '0478-2812345', specialty: 'General', category: 'General hospital',
        orderNo: 'HQ/EMP/2022/09', empanelFrom: shift(-1100), empanelTo: shift(-30),
        status: 'Empanelled', remarks: 'Extension order awaited' },
      { name: 'Lakeview Dental Clinic', address: 'Beach Road', city: 'Alappuzha',
        phone: '0477-2265588', specialty: 'Dental', category: 'Dental',
        orderNo: 'HQ/EMP/2025/04', empanelFrom: shift(-120), empanelTo: shift(600),
        status: 'Empanelled', remarks: '' }
    ].map(function (h) { return Store.saveHospital(h); });

    // the first hospital has been carrying an extension for a year already
    Store.extendEmpanelment(hospitals[0].id, {
      from: hospitals[0].empanelFrom, to: shift(400),
      order: 'HQ/EMP/2026/03', orderDate: shift(-40),
      remarks: 'Empanelment extended by one year'
    });

    [
      { s: 0, b: 2, h: 0, type: 'HOSPITAL', d: -95, days: 6, dx: 'Fracture right femur — surgery',
        claimed: 148500, passed: 132000, status: 'PAID', bill: 'CC/2026/8841' },
      { s: 1, b: 2, h: 0, type: 'HOSPITAL', d: -52, days: 2, dx: 'Acute gastroenteritis',
        claimed: 22400, passed: 22400, status: 'PAID', bill: 'CC/2026/9107' },
      { s: 0, b: 1, h: 1, type: 'HOSPITAL', d: -20, days: 1, dx: 'Cataract — left eye',
        claimed: 38000, passed: 0, status: 'PENDING', bill: 'SE/2026/331' },
      { s: 2, b: 1, h: 2, type: 'HOSPITAL', d: -8, days: 3, dx: 'Hypertension — evaluation',
        claimed: 17800, passed: 0, status: 'SANCTIONED', bill: 'ST/2026/552' },
      { s: 1, b: 0, h: 3, type: 'REIMB', d: -70, days: 1, dx: 'Root canal treatment',
        claimed: 9500, passed: 7000, status: 'PAID', bill: 'LD/771' },
      { s: 2, b: 0, h: -1, type: 'REIMB', d: -35, days: 1, dx: 'Emergency treatment while on tour',
        claimed: 6400, passed: 6400, status: 'PAID', bill: 'GH/2026/44',
        other: 'Government General Hospital, Thrissur' },
      { s: 0, b: 3, h: 2, type: 'REIMB', d: -14, days: 2, dx: 'Chest infection — medicines and tests',
        claimed: 12300, passed: 0, status: 'PENDING', bill: 'ST/2026/601' },
      { s: 3, b: 0, h: 0, type: 'REIMB', d: -4, days: 1, dx: 'Diabetic review and medicines',
        claimed: 4800, passed: 0, status: 'PENDING', bill: 'CC/2026/9330' }
    ].forEach(function (c) {
      var st = staff[c.s];
      var ben = Store.beneficiaries(st.id)[c.b] || Store.beneficiaries(st.id)[0];
      var from = shift(c.d);
      var to = shift(c.d + (c.days - 1));
      Store.saveClaim({
        no: Store.nextClaimNo(from, c.type),
        type: c.type,
        date: shift(c.d + c.days),
        staffId: st.id,
        beneficiaryId: ben.id,
        hospitalId: c.h >= 0 ? hospitals[c.h].id : '',
        hospitalName: c.other || '',
        treatFrom: from,
        treatTo: to,
        diagnosis: c.dx,
        billNo: c.bill,
        billDate: to,
        amountClaimed: c.claimed,
        amountReimbursed: c.passed,
        status: c.status,
        sanctionNo: c.status === 'PENDING' ? '' : 'SAN/' + c.bill.replace(/[^0-9]/g, '').slice(-4),
        sanctionDate: c.status === 'PENDING' ? '' : shift(c.d + c.days + 5),
        paidDate: c.status === 'PAID' ? shift(c.d + c.days + 12) : '',
        mode: c.status === 'PAID' ? 'Bank transfer' : '',
        remarks: ''
      });
    });

    refresh();
    UI.toast('Sample data loaded');
    go('dashboard');
  }

  /** A date of birth that makes somebody the given age today. */
  function born(years) {
    var d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(d.getDate() - 30);
    return iso(d);
  }

  function shift(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return iso(d);
  }

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  function wipe() {
    if (!confirm('Erase ALL staff, hospitals, claims and settings from this register?\n\n' +
      'This cannot be undone. Export a backup first.')) return;
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
      case 'staff': Staff.render(); break;
      case 'hospitals': Hospitals.render(); break;
      case 'claims': Claims.refreshSelects(); Claims.render(); break;
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
        case 'new-claim': go('claims'); Claims.reset(); break;
        case 'new-staff': go('staff'); Staff.reset(); break;
        case 'new-hospital': go('hospitals'); Hospitals.reset(); break;
        case 'print':
          if (current !== 'reports') Reports.openWith('monthly');
          setTimeout(function () { global.print(); }, 120);
          break;
        case 'pdf': savePdf(); break;
        case 'csv': if (current === 'reports') Reports.downloadCsv(); else go('reports'); break;
        case 'sample': go('settings'); sample(); break;
        case 'guide': go('settings'); UI.$('#guideCard').scrollIntoView({ behavior: 'smooth' }); break;
      }
    });
  }

  function savePdf() {
    if (!global.desktop || !global.desktop.savePdf) return;
    if (current !== 'reports') Reports.openWith('monthly');
    setTimeout(function () {
      var sel = UI.$('#reportType');
      var name = sel.options[sel.selectedIndex].text
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      var portrait = sel.value === 'voucher' || sel.value === 'card';
      global.desktop.savePdf(name + '.pdf', portrait).then(function (r) {
        if (r && r.ok) UI.toast('PDF saved');
        else if (r && !r.canceled) UI.toast('Could not save the PDF', 'bad');
      });
    }, 150);
  }

  /* ---------------- boot ---------------- */

  function init() {
    Store.load();

    Staff.init();
    Hospitals.init();
    Claims.init();
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
    UI.$('#btnCsvStaff').addEventListener('click', function () {
      csvOf('staff-register', 'staff-and-dependents.csv');
    });
    UI.$('#btnCsvHospitals').addEventListener('click', function () {
      csvOf('empanelled', 'empanelled-hospitals.csv');
    });
    UI.$('#btnCsvClaims').addEventListener('click', function () {
      csvOf('monthly', 'medical-claims.csv');
    });
    UI.$('#btnSample').addEventListener('click', sample);
    UI.$('#btnWipe').addEventListener('click', wipe);

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && current !== 'reports') {
        e.preventDefault();
        Reports.openWith('monthly');
      }
    });

    desktopSetup();

    loadSettings();
    var name = Store.settings().officeName || 'Medical Centre';
    UI.$('#brandOffice').textContent = name;
    document.title = name + ' — Reimbursement Register';

    go('dashboard');
  }

  global.App = { init: init, go: go, refresh: refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);
