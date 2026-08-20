/* ============================================================
   statements.js — the printed statements

   The office needs the same figures cut several ways: by month and by
   year for the accounts, by staff member when somebody asks what he
   has drawn, by hospital when a bill is queried, and separately for
   the two payees — the hospitals we settle with and the staff we
   reimburse. Each one is built here and printed on the sheet
   reports.js lays out.
   ============================================================ */
(function (global) {
  'use strict';

  var P = null;                       // shared page furniture from reports.js
  var esc, num, dmy, money;

  function bind() {
    P = Reports.parts;
    P.bind();
    esc = UI.esc; num = UI.num; dmy = UI.dmy; money = UI.money;
  }

  /* ---------------- the period a report covers ---------------- */

  /**
   * Reports are cut either by one month or by one financial year, and a
   * year of 'all' means the whole register. Everything downstream only
   * needs the filter and something to print in the sub-heading.
   */
  function period(ctx) {
    var c = ctx || {};
    if (c.month) {
      return { filter: { month: c.month }, label: Store.monthName(c.month) };
    }
    if (!c.fy || c.fy === 'all') {
      return { filter: {}, label: 'All years on the register' };
    }
    var r = Store.fyRange(c.fy);
    return {
      filter: { fy: c.fy },
      label: Store.fyName(c.fy) + '  (' + dmy(r.from) + ' to ' + dmy(r.to) + ')'
    };
  }

  function typeLabel(c) { return Store.CLAIM_TYPE_SHORT[c.type] || ''; }

  /** A small note under a name saying what is still holding its claims up. */
  function stageNote(t, word) {
    var bits = [];
    if (t.awaitingCount) bits.push(t.awaitingCount + ' ' + word + '(s) still to be examined');
    if (t.toSanctionCount) bits.push(t.toSanctionCount + ' awaiting sanction');
    return bits.length ? '<br><span class="rp-dim">' + bits.join(', ') + '</span>' : '';
  }

  function statusLabel(c) {
    return Store.CLAIM_STATUS[c.status || 'PENDING'] || '';
  }

  function who(c) {
    var b = Store.claimant(c) || {};
    var age = Store.ageOf(b, c.treatFrom);
    return '<b>' + esc(b.name || '—') + '</b>' +
      '<br><span class="rp-dim">' + esc(b.relation || '—') +
      (age === '' ? '' : ', ' + esc(age) + ' y') + '</span>';
  }

  function treatDates(c) {
    if (!c.treatTo || c.treatTo === c.treatFrom) return dmy(c.treatFrom);
    return dmy(c.treatFrom) + '<br><span class="rp-dim">to ' + dmy(c.treatTo) + '</span>';
  }

  function hospitalName(c) {
    var h = Store.hospital(c.hospitalId);
    return h ? h.name : (c.hospitalName || '—');
  }

  /* ---------------- the claim register, month or year ---------------- */

  /** Every particular the office asked to keep, one claim to a line. */
  function claimTable(list, opts) {
    opts = opts || {};
    // the widths add to 100 — over that and the headings wrap mid-word
    var cols = [
      { label: 'Sl.', w: '3%', align: 'center' },
      { label: 'Date of treatment', w: '7.5%', align: 'center' },
      { label: 'Claim No.', w: '9.5%' },
      { label: 'Type', w: '6%' },
      { label: 'Name', w: '12%' },
      { label: 'Dependency', w: '7.5%' },
      { label: 'ID card no.', w: '8%' },
      { label: 'Hospital', w: '14.5%' },
      { label: 'Amount claimed', w: '8%', align: 'right' },
      { label: 'Amount admitted', w: '8%', align: 'right' },
      { label: 'Disallowed', w: '8%', align: 'right' },
      { label: 'Status', w: '8%' }
    ];

    var rows = [], sl = 0;
    var t = Store.claimTotals(list);

    list.slice().reverse().forEach(function (c) {
      sl++;
      var claimed = Number(c.amountClaimed) || 0;
      var passed = Number(c.amountReimbursed) || 0;
      var cut = Store.disallowedOn(c);
      var b = Store.claimant(c) || {};
      var age = Store.ageOf(b, c.treatFrom);
      rows.push([
        sl,
        treatDates(c),
        esc(c.no || '—') + (c.billNo ? '<br><span class="rp-dim">bill ' + esc(c.billNo) + '</span>' : ''),
        esc(typeLabel(c)),
        '<b>' + esc(b.name || '—') + '</b>' +
        (age === '' ? '' : '<br><span class="rp-dim">' + esc(age) + ' y</span>'),
        esc(b.relation || '—'),
        esc(b.idCardNo || '—'),
        esc(hospitalName(c)) +
        (c.diagnosis ? '<br><span class="rp-dim">' + esc(c.diagnosis) + '</span>' : ''),
        money(claimed),
        passed ? money(passed) : '',
        // nothing is disallowed on a claim nobody has examined yet
        cut === null ? '<span class="rp-dim">—</span>' : (cut ? money(cut) : ''),
        esc(statusLabel(c))
      ]);
    });

    return P.table(cols, rows, {
      blanks: opts.blanks === undefined ? 4 : opts.blanks,
      total: ['', '', 'TOTAL', sl + ' claims', '', '', '', '',
        money(t.claimed), money(t.reimbursed), money(t.disallowed), '']
    });
  }

  /** A short table of the two claim kinds side by side. */
  function typeSummary(list) {
    var cols = [
      { label: 'Kind of claim', w: '24%' },
      { label: 'No. of claims', w: '9%', align: 'right' },
      { label: 'Amount claimed', w: '13%', align: 'right' },
      { label: 'Amount admitted', w: '13%', align: 'right' },
      { label: 'Disallowed', w: '12%', align: 'right' },
      { label: 'Sanctioned, not paid', w: '15%', align: 'right' },
      { label: 'Still to be examined', w: '14%', align: 'right' }
    ];
    var rows = ['HOSPITAL', 'REIMB'].map(function (k) {
      var sub = list.filter(function (c) { return c.type === k; });
      var t = Store.claimTotals(sub);
      return [Store.CLAIM_TYPES[k], t.count, money(t.claimed), money(t.reimbursed),
        money(t.disallowed), t.payable ? money(t.payable) : '—',
        t.awaitingCount ? t.awaitingCount + ' · ' + money(t.awaiting) : '—'];
    });
    var all = Store.claimTotals(list);
    return P.table(cols, rows, {
      blanks: 0,
      total: ['TOTAL', all.count, money(all.claimed), money(all.reimbursed),
        money(all.disallowed), all.payable ? money(all.payable) : '—',
        all.awaitingCount ? all.awaitingCount + ' · ' + money(all.awaiting) : '—']
    });
  }

  function monthlyRegister(ctx) {
    var p = period({ month: (ctx && ctx.month) || Store.currentMonth() });
    var list = Store.claimList(p.filter);
    return P.header('Monthly Claim Register', p.label + '  ·  by date of treatment') +
      claimTable(list) +
      '<div class="rp-section">Summary for the month</div>' +
      typeSummary(list) +
      P.footer('Certified that the claims entered above have been checked with the ' +
        'bills and admissible under the rules.');
  }

  /* ---------------- the year at a glance ---------------- */

  function annualStatement(ctx) {
    var fy = (ctx && ctx.fy) || Store.currentFy();
    var p = period({ fy: fy });
    var list = Store.claimList(p.filter);

    var cols = [
      { label: 'Month', w: '13%' },
      { label: 'Cashless — claims', w: '8%', align: 'right' },
      { label: 'Cashless — billed', w: '11%', align: 'right' },
      { label: 'Cashless — admitted', w: '11%', align: 'right' },
      { label: 'Reimbursement — claims', w: '8%', align: 'right' },
      { label: 'Reimbursement — claimed', w: '11%', align: 'right' },
      { label: 'Reimbursement — admitted', w: '11%', align: 'right' },
      { label: 'Total claimed', w: '9%', align: 'right' },
      { label: 'Total admitted', w: '9%', align: 'right' },
      { label: 'Disallowed', w: '9%', align: 'right' }
    ];

    // walk the year month by month so a month with no claim still prints
    var range = fy === 'all' ? null : Store.fyRange(fy);
    var months = [];
    if (range) {
      var m = Store.toMonth(range.from), last = Store.toMonth(range.to);
      while (m <= last) { months.push(m); m = Store.nextMonth(m); }
    } else {
      var seen = {};
      list.forEach(function (c) { seen[Store.toMonth(Store.claimDate(c))] = true; });
      months = Object.keys(seen).sort();
    }

    var rows = [];
    var gc = { n: 0, cl: 0, ad: 0 }, gr = { n: 0, cl: 0, ad: 0 }, gcut = 0;

    months.forEach(function (mo) {
      var inMonth = list.filter(function (c) { return Store.toMonth(Store.claimDate(c)) === mo; });
      var hosp = Store.claimTotals(inMonth.filter(function (c) { return c.type === 'HOSPITAL'; }));
      var reim = Store.claimTotals(inMonth.filter(function (c) { return c.type === 'REIMB'; }));
      var cut = hosp.disallowed + reim.disallowed;

      gc.n += hosp.count; gc.cl += hosp.claimed; gc.ad += hosp.reimbursed;
      gr.n += reim.count; gr.cl += reim.claimed; gr.ad += reim.reimbursed;
      gcut += cut;

      rows.push([
        Store.monthName(mo),
        hosp.count || '', hosp.claimed ? money(hosp.claimed) : '',
        hosp.reimbursed ? money(hosp.reimbursed) : '',
        reim.count || '', reim.claimed ? money(reim.claimed) : '',
        reim.reimbursed ? money(reim.reimbursed) : '',
        (hosp.claimed + reim.claimed) ? money(hosp.claimed + reim.claimed) : '',
        (hosp.reimbursed + reim.reimbursed) ? money(hosp.reimbursed + reim.reimbursed) : '',
        cut ? money(cut) : ''
      ]);
    });

    var whole = Store.claimTotals(list);
    var staffCount = Store.claimsByStaff(p.filter).length;
    var hospCount = Store.claimsByHospital(p.filter)
      .filter(function (r) { return r.claims.some(function (c) { return c.type === 'HOSPITAL'; }); }).length;

    return P.header('Annual Claim Statement', p.label) +
      P.table(cols, rows, {
        blanks: 0,
        total: ['TOTAL', gc.n, money(gc.cl), money(gc.ad), gr.n, money(gr.cl), money(gr.ad),
          money(gc.cl + gr.cl), money(gc.ad + gr.ad), money(gcut)]
      }) +
      '<div class="rp-section">For the year as a whole</div>' +
      typeSummary(list) +
      '<div class="rp-note">' + staffCount + ' staff member(s) drew medical benefit during the ' +
      'year, and ' + hospCount + ' empanelled hospital(s) were billed. Of ' +
      money(whole.claimed) + ' claimed, <b>' + money(whole.reimbursed) + '</b> was admitted ' +
      'and ' + money(whole.disallowed) + ' disallowed under the rules. ' +
      (whole.payable
        ? '<b>' + money(whole.payable) + '</b> stands sanctioned and is yet to be released. '
        : 'Nothing sanctioned is awaiting release. ') +
      (whole.toSanctionCount
        ? whole.toSanctionCount + ' claim(s) admitting ' + money(whole.toSanction) +
          ' have been checked and await a sanction order. '
        : '') +
      (whole.awaitingCount
        ? whole.awaitingCount + ' claim(s) billing ' + money(whole.awaiting) +
          ' are still to be examined.'
        : 'No claim is left to be examined.') + '</div>' +
      P.footer();
  }

  /* ---------------- one staff member ---------------- */

  function staffStatement(ctx) {
    var c = ctx || {};
    var s = Store.staffMember(c.staffId);
    if (!s) return '<div class="rp-empty-page">Choose a staff member for this statement.</div>';

    var p = period(c);
    var list = Store.claimList({ staffId: s.id, fy: p.filter.fy, month: p.filter.month });
    var t = Store.claimTotals(list);

    var fam = Store.beneficiaries(s.id).map(function (b) {
      var age = Store.ageOf(b);
      var mine = list.filter(function (x) { return x.beneficiaryId === b.id; });
      var bt = Store.claimTotals(mine);
      return [esc(b.name), esc(b.relation), age === '' ? '—' : num(age),
        esc(b.idCardNo || '—'), bt.count || '', bt.claimed ? money(bt.claimed) : '',
        bt.reimbursed ? money(bt.reimbursed) : '',
        bt.disallowed ? money(bt.disallowed) : ''];
    });

    return P.header('Individual Claim Statement',
      s.name + (s.empNo ? '  ·  Emp. No. ' + s.empNo : '') + '  ·  ' + p.label) +
      '<div class="rp-meta">' +
      '<span><b>Designation:</b> ' + esc(s.designation || '—') + '</span>' +
      '<span><b>Department:</b> ' + esc(s.department || '—') + '</span>' +
      '<span><b>Card No.:</b> ' + esc(s.idCardNo || '—') + '</span>' +
      '<span><b>Status:</b> ' + esc(s.status || 'Serving') + '</span>' +
      '</div>' +
      '<div class="rp-section">Members covered by this card</div>' +
      P.table([
        { label: 'Name', w: '26%' },
        { label: 'Dependency', w: '14%' },
        { label: 'Age', w: '8%', align: 'right' },
        { label: 'ID card no.', w: '16%' },
        { label: 'Claims', w: '7%', align: 'right' },
        { label: 'Amount claimed', w: '13%', align: 'right' },
        { label: 'Amount admitted', w: '13%', align: 'right' },
        { label: 'Disallowed', w: '11%', align: 'right' }
      ], fam, {
        blanks: 1,
        total: ['TOTAL', '', '', '', t.count, money(t.claimed), money(t.reimbursed),
          money(t.disallowed)]
      }) +
      '<div class="rp-section">Claims during the period</div>' +
      claimTable(list, { blanks: 2 }) +
      P.footer('Certified that ' + s.name + ' has been admitted medical benefit of ' +
        money(t.reimbursed) + ' during ' + p.label + ', against ' + money(t.claimed) +
        ' claimed' + (t.disallowed ? ', ' + money(t.disallowed) + ' having been disallowed' : '') +
        '.');
  }

  /* ---------------- one hospital ---------------- */

  function hospitalStatement(ctx) {
    var c = ctx || {};
    var h = Store.hospital(c.hospitalId);
    if (!h) return '<div class="rp-empty-page">Choose a hospital for this statement.</div>';

    var p = period(c);
    var list = Store.claimList({ hospitalId: h.id, fy: p.filter.fy, month: p.filter.month });
    var t = Store.claimTotals(list);
    var st = Store.empanelStatus(h);

    var history = (h.extensions || []).slice().reverse().map(function (x) {
      return [dmy(x.from) + ' to ' + (x.to ? dmy(x.to) : 'no end date'),
        esc(x.order || '—'), x.orderDate ? dmy(x.orderDate) : '—', esc(x.remarks || '')];
    });

    return P.header('Hospital-wise Claim Statement', h.name + '  ·  ' + p.label) +
      '<div class="rp-meta">' +
      '<span><b>Place:</b> ' + esc(h.city || '—') + '</span>' +
      '<span><b>Specialty:</b> ' + esc(h.specialty || h.category || '—') + '</span>' +
      '<span><b>Empanelment order:</b> ' + esc(h.orderNo || '—') + '</span>' +
      '<span><b>Empanelled:</b> ' + (h.empanelFrom ? dmy(h.empanelFrom) : '—') + ' to ' +
      (h.empanelTo ? dmy(h.empanelTo) : 'no end date') + '</span>' +
      '<span><b>Position today:</b> ' + esc(Hospitals.STATE_LABEL[st] || '') + '</span>' +
      '</div>' +
      (history.length
        ? '<div class="rp-section">Earlier empanelment periods</div>' +
        P.table([
          { label: 'Period', w: '30%' },
          { label: 'Order no.', w: '22%' },
          { label: 'Dated', w: '15%', align: 'center' },
          { label: 'Remarks', w: '33%' }
        ], history, { blanks: 0 })
        : '') +
      '<div class="rp-section">Claims treated at this hospital</div>' +
      claimTable(list, { blanks: 3 }) +
      P.footer('Total billed by this hospital during ' + p.label + ': ' + money(t.claimed) +
        ', of which ' + money(t.reimbursed) + ' was admitted and ' + money(t.disallowed) +
        ' disallowed. ' + (t.payable ? money(t.payable) + ' stands sanctioned and is yet to be ' +
          'released.' : 'Nothing sanctioned is awaiting release.'));
  }

  /* ---------------- the two payee reports ---------------- */

  /**
   * What the empanelled hospitals are owed. Only cashless claims appear,
   * because a reimbursement claim is money paid to the employee and never
   * to the hospital.
   */
  function hospitalReimbursement(ctx) {
    var p = period(ctx);
    var groups = Store.claimsByHospital(p.filter).map(function (g) {
      g.claims = g.claims.filter(function (c) { return c.type === 'HOSPITAL'; });
      g.totals = Store.claimTotals(g.claims);
      return g;
    }).filter(function (g) { return g.claims.length; })
      .sort(function (a, b) { return b.totals.claimed - a.totals.claimed; });

    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Name of hospital', w: '19%' },
      { label: 'Place', w: '9%' },
      { label: 'Empanelled upto', w: '8%', align: 'center' },
      { label: 'No. of claims', w: '6%', align: 'right' },
      { label: 'Patients', w: '6%', align: 'right' },
      { label: 'Amount billed', w: '11%', align: 'right' },
      { label: 'Amount admitted', w: '11%', align: 'right' },
      { label: 'Disallowed', w: '9%', align: 'right' },
      { label: 'Already paid', w: '9%', align: 'right' },
      { label: 'Now payable', w: '8%', align: 'right' }
    ];

    var rows = [], sl = 0;
    var tc = 0, tb = 0, tad = 0, tcut = 0, tpaid = 0, tpay = 0;

    groups.forEach(function (g) {
      sl++;
      var h = g.hospital;
      var t = g.totals;
      var patients = {};
      g.claims.forEach(function (c) { patients[c.beneficiaryId || c.benName] = true; });

      tc += t.count; tb += t.claimed; tad += t.reimbursed;
      tcut += t.disallowed; tpaid += t.paid; tpay += t.payable;

      rows.push([
        sl,
        '<b>' + esc(g.name) + '</b>' +
        (h && h.orderNo ? '<br><span class="rp-dim">order ' + esc(h.orderNo) + '</span>' : '') +
        stageNote(t, 'bill'),
        esc(h ? (h.city || '—') : '—'),
        h && h.empanelTo ? dmy(h.empanelTo) : '—',
        t.count,
        Object.keys(patients).length,
        money(t.claimed),
        money(t.reimbursed),
        t.disallowed ? money(t.disallowed) : '—',
        t.paid ? money(t.paid) : '—',
        t.payable ? '<b>' + money(t.payable) + '</b>' : '—'
      ]);
    });

    return P.header('Hospital Reimbursement Report',
      'Cashless treatment billed by empanelled hospitals  ·  ' + p.label) +
      P.table(cols, rows, {
        blanks: 3,
        total: ['', 'TOTAL', '', '', tc, '', money(tb), money(tad), money(tcut),
          money(tpaid), money(tpay)]
      }) +
      P.footer('Certified that the bills of the hospitals listed above have been verified and ' +
        'that the amount admitted is the amount finally payable under the rules. ' +
        (tpay ? money(tpay) + ' stands sanctioned and is yet to be released.'
          : 'Nothing sanctioned is awaiting release.'));
  }

  /**
   * What the staff are owed on bills they have already paid. The mirror of
   * the hospital report, and the one an employee actually asks about.
   */
  function staffReimbursement(ctx) {
    var p = period(ctx);
    var groups = Store.claimsByStaff(p.filter).map(function (g) {
      g.claims = g.claims.filter(function (c) { return c.type === 'REIMB'; });
      g.totals = Store.claimTotals(g.claims);
      return g;
    }).filter(function (g) { return g.claims.length; })
      .sort(function (a, b) { return b.totals.claimed - a.totals.claimed; });

    var cols = [
      { label: 'Sl.', w: '3%', align: 'center' },
      { label: 'Emp. No.', w: '6.5%' },
      { label: 'Name of staff', w: '14%' },
      { label: 'Designation', w: '10%' },
      { label: 'ID card no.', w: '7.5%' },
      { label: 'Treated persons', w: '12%' },
      { label: 'No. of claims', w: '5%', align: 'right' },
      { label: 'Amount claimed', w: '8.5%', align: 'right' },
      { label: 'Amount admitted', w: '8.5%', align: 'right' },
      { label: 'Disallowed', w: '8.5%', align: 'right' },
      { label: 'Already paid', w: '8%', align: 'right' },
      { label: 'Now payable', w: '8.5%', align: 'right' }
    ];

    var rows = [], sl = 0;
    var tc = 0, tcl = 0, tad = 0, tcut = 0, tpaid = 0, tpay = 0;

    groups.forEach(function (g) {
      sl++;
      var s = g.staff || {};
      var t = g.totals;
      var names = {};
      g.claims.forEach(function (c) {
        var b = Store.claimant(c) || {};
        if (b.name) names[b.name] = b.relation || '';
      });
      var whoList = Object.keys(names).map(function (n) {
        return esc(n) + ' <span class="rp-dim">(' + esc(names[n]) + ')</span>';
      }).join('<br>');

      tc += t.count; tcl += t.claimed; tad += t.reimbursed;
      tcut += t.disallowed; tpaid += t.paid; tpay += t.payable;

      rows.push([
        sl, esc(s.empNo || '—'),
        '<b>' + esc(g.name) + '</b>' +
        stageNote(t, 'claim'),
        esc(s.designation || '—'),
        esc(s.idCardNo || '—'),
        whoList || '—',
        t.count,
        money(t.claimed),
        money(t.reimbursed),
        t.disallowed ? money(t.disallowed) : '—',
        t.paid ? money(t.paid) : '—',
        t.payable ? '<b>' + money(t.payable) + '</b>' : '—'
      ]);
    });

    return P.header('Staff Reimbursement Report',
      'Reimbursement of treatment expenses to staff  ·  ' + p.label) +
      P.table(cols, rows, {
        blanks: 3,
        total: ['', '', 'TOTAL', '', '', '', tc, money(tcl), money(tad), money(tcut),
          money(tpaid), money(tpay)]
      }) +
      P.footer('Certified that the claims listed above are admissible to the extent shown and ' +
        'that the amount admitted is final under the rules. ' +
        (tpay ? money(tpay) + ' stands sanctioned and is yet to be released to the staff ' +
          'members concerned.' : 'Nothing sanctioned is awaiting release.'));
  }

  /* ---------------- the two master lists ---------------- */

  function empanelledList() {
    var cols = [
      { label: 'Sl.', w: '4%', align: 'center' },
      { label: 'Name of hospital', w: '20%' },
      { label: 'Address / Place', w: '17%' },
      { label: 'Contact', w: '10%' },
      { label: 'Specialty', w: '12%' },
      { label: 'Order no.', w: '11%' },
      { label: 'Empanelled from', w: '9%', align: 'center' },
      { label: 'Valid upto', w: '9%', align: 'center' },
      { label: 'Position', w: '8%' }
    ];

    var rows = [], sl = 0, live = 0;
    Store.hospitalList().forEach(function (h) {
      sl++;
      var st = Store.empanelStatus(h);
      if (st === 'active' || st === 'expiring' || st === 'open') live++;
      var n = (h.extensions || []).length;
      rows.push([
        sl,
        '<b>' + esc(h.name) + '</b>',
        esc([h.address, h.city].filter(Boolean).join(', ') || '—'),
        esc(h.phone || '—'),
        esc(h.specialty || h.category || '—'),
        esc(h.orderNo || '—') +
        (n ? '<br><span class="rp-dim">' + n + ' extension' + (n === 1 ? '' : 's') + '</span>' : ''),
        h.empanelFrom ? dmy(h.empanelFrom) : '—',
        h.empanelTo ? dmy(h.empanelTo) : 'no end date',
        esc(Hospitals.STATE_LABEL[st] || '')
      ]);
    });

    return P.header('List of Empanelled Hospitals',
      'Position as on ' + dmy(UI.today())) +
      P.table(cols, rows, {
        blanks: 4,
        total: ['', 'TOTAL', sl + ' hospitals on the list', '', '', '', '', '',
          live + ' in force']
      }) +
      P.footer('Cashless treatment is admissible only at a hospital shown above and only ' +
        'within the period of its empanelment.');
  }

  function staffRegister() {
    var cols = [
      { label: 'Sl.', w: '3%', align: 'center' },
      { label: 'Emp. No.', w: '7.5%' },
      { label: 'Name of staff', w: '17%' },
      { label: 'Designation / Dept.', w: '14%' },
      { label: 'Card no.', w: '9.5%' },
      { label: 'Age', w: '4.5%', align: 'right' },
      { label: 'Name of dependent', w: '17%' },
      { label: 'Dependency', w: '11%' },
      { label: 'Age', w: '4.5%', align: 'right' },
      { label: 'Card no.', w: '12%' }
    ];

    var rows = [], sl = 0, deps = 0;
    Store.staffList().forEach(function (s) {
      sl++;
      var age = Store.ageOf(s);
      var family = Store.dependentsOf(s.id);
      var head = [
        sl, esc(s.empNo || '—'),
        '<b>' + esc(s.name) + '</b>' +
        ((s.status || 'Serving') !== 'Serving'
          ? ' <span class="rp-dim">(' + esc(s.status) + ')</span>' : ''),
        esc(s.designation || '—') +
        (s.department ? '<br><span class="rp-dim">' + esc(s.department) + '</span>' : ''),
        esc(s.idCardNo || '—'),
        age === '' ? '—' : num(age)
      ];

      if (!family.length) {
        rows.push(head.concat(['<span class="rp-dim">— no dependent —</span>', '', '', '']));
        return;
      }
      family.forEach(function (d, i) {
        deps++;
        var dAge = Store.ageOf(d);
        // the staff member's own particulars print once, against his first
        // dependent, so the family reads as one block on the sheet
        var lead = i === 0 ? head : ['', '', '', '', '', ''];
        rows.push(lead.concat([
          esc(d.name), esc(d.relation || '—'),
          dAge === '' ? '—' : num(dAge), esc(d.idCardNo || '—')
        ]));
      });
    });

    return P.header('Register of Staff and Dependents',
      'Members entitled to medical benefit  ·  as on ' + dmy(UI.today())) +
      P.table(cols, rows, {
        blanks: 4,
        total: ['', '', sl + ' staff members', '', '', '', deps + ' dependents', '', '', '']
      }) +
      P.footer('Certified that the particulars of the staff and their dependents shown above ' +
        'have been verified with the records.');
  }

  /* ---------------- single-record slips ---------------- */

  function claimVoucher(id) {
    var c = Store.claim(id);
    if (!c) return '<div class="rp-empty-page">Choose a claim to print.</div>';
    var st = Store.settings();
    var b = Store.claimant(c) || {};
    var s = Store.staffMember(c.staffId) || {};
    var h = Store.hospital(c.hospitalId);
    var cashless = c.type !== 'REIMB';
    var claimed = Number(c.amountClaimed) || 0;
    var passed = Number(c.amountReimbursed) || 0;
    var cut = Store.disallowedOn(c);
    var age = Store.ageOf(b, c.treatFrom);

    return P.slipHead(cashless ? 'Medical Claim — Cashless Treatment'
      : 'Medical Claim — Reimbursement of Expenses', c.no, c.date || c.treatFrom) +
      '<div class="slip-grid">' +
      P.slipField('Name of staff member', '<b>' + esc(s.name || '—') + '</b>', true) +
      P.slipField('Employee No.', esc(s.empNo || '—')) +
      P.slipField('Designation', esc(s.designation || '—')) +
      P.slipField('Name of patient', '<b>' + esc(b.name || '—') + '</b>', true) +
      P.slipField('Dependency', esc(b.relation || '—')) +
      P.slipField('Age', age === '' ? '—' : esc(age) + ' years') +
      P.slipField('ID card no.', '<b>' + esc(b.idCardNo || '—') + '</b>') +
      P.slipField('Date of treatment', dmy(c.treatFrom) +
        (c.treatTo && c.treatTo !== c.treatFrom ? ' to ' + dmy(c.treatTo) : '')) +
      P.slipField('Hospital', esc(hospitalName(c)), true) +
      P.slipField('Empanelment', h
        ? (h.empanelFrom ? dmy(h.empanelFrom) : '—') + ' to ' +
        (h.empanelTo ? dmy(h.empanelTo) : 'no end date') +
        (Store.isEmpanelledOn(h, c.treatFrom) ? '' : '  — OUTSIDE THE PERIOD')
        : 'not on the empanelled list') +
      P.slipField('Bill no. / date', esc(c.billNo || '—') +
        (c.billDate ? ' · ' + dmy(c.billDate) : '')) +
      '</div>' +
      '<div class="slip-block"><span class="slip-label">Diagnosis / treatment taken</span>' +
      '<div class="slip-box">' + esc(c.diagnosis || '') + '</div></div>' +
      '<table class="rp-table slip-table"><tbody>' +
      '<tr><td style="width:60%">Amount claimed</td>' +
      '<td class="ta-right"><b>' + money(claimed) + '</b></td></tr>' +
      '<tr><td>Amount admitted after restriction — final</td>' +
      '<td class="ta-right"><b>' + money(passed) + '</b></td></tr>' +
      '<tr><td>Amount disallowed under the rules</td>' +
      '<td class="ta-right">' + (cut === null
        ? '<span class="rp-dim">not assessed yet</span>' : money(cut)) + '</td></tr>' +
      '<tr><td>Sanction no. / date</td><td class="ta-right">' +
      esc(c.sanctionNo || '—') + (c.sanctionDate ? ' · ' + dmy(c.sanctionDate) : '') + '</td></tr>' +
      '<tr><td>Payment released on</td><td class="ta-right">' +
      (c.paidDate ? dmy(c.paidDate) : '—') + (c.mode ? ' · ' + esc(c.mode) : '') + '</td></tr>' +
      '<tr><td>Present position</td><td class="ta-right"><b>' +
      esc(statusLabel(c)) + '</b></td></tr>' +
      '</tbody></table>' +
      (c.remarks ? '<div class="slip-note"><b>Remarks:</b> ' + esc(c.remarks) + '</div>' : '') +
      '<div class="slip-note">Payable to <b>' +
      (cashless ? esc(hospitalName(c)) : esc(s.name || 'the staff member')) + '</b>.</div>' +
      '<div class="slip-sign">' +
      '<div class="sign-box"><div class="sign-line"></div><div>Claimant</div>' +
      '<div class="sign-name">' + esc(s.name || '') + '</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div>Verified by</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div>Sanctioning authority</div>' +
      '<div class="sign-name">' + esc(st.sanctioning || st.officer || '') + '</div></div>' +
      '</div>';
  }

  function familyCard(staffId) {
    var s = Store.staffMember(staffId);
    if (!s) return '<div class="rp-empty-page">Choose a staff member to print the card.</div>';
    var st = Store.settings();
    var family = Store.beneficiaries(s.id);

    var body = family.map(function (b, i) {
      var age = Store.ageOf(b);
      return '<tr>' +
        '<td class="ta-center">' + (i + 1) + '</td>' +
        '<td><b>' + esc(b.name) + '</b></td>' +
        '<td>' + esc(b.relation || '—') + '</td>' +
        '<td class="ta-right">' + (age === '' ? '—' : num(age)) + '</td>' +
        '<td>' + esc(b.idCardNo || '—') + '</td></tr>';
    }).join('');

    var blanks = '';
    for (var i = family.length; i < 8; i++) {
      blanks += '<tr class="rp-blank"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>' +
        '<td>&nbsp;</td><td>&nbsp;</td></tr>';
    }

    return P.slipHead('Medical Card — Staff and Dependents', s.empNo || s.idCardNo, UI.today()) +
      '<div class="slip-grid">' +
      P.slipField('Name of staff member', '<b>' + esc(s.name) + '</b>', true) +
      P.slipField('Employee No.', esc(s.empNo || '—')) +
      P.slipField('ID card no.', '<b>' + esc(s.idCardNo || '—') + '</b>') +
      P.slipField('Designation', esc(s.designation || '—')) +
      P.slipField('Department', esc(s.department || '—')) +
      P.slipField('Station', esc(s.station || '—')) +
      P.slipField('Mobile', esc(s.mobile || '—')) +
      '</div>' +
      '<div class="slip-block"><span class="slip-label">Members entitled to treatment on this card</span></div>' +
      '<table class="rp-table slip-table"><thead><tr>' +
      '<th style="width:7%" class="ta-center">Sl.</th>' +
      '<th style="width:38%">Name</th>' +
      '<th style="width:20%">Dependency</th>' +
      '<th style="width:10%" class="ta-right">Age</th>' +
      '<th style="width:25%">ID card no.</th>' +
      '</tr></thead><tbody>' + body + blanks + '</tbody></table>' +
      '<div class="slip-note">Treatment is admissible for the members shown above, at an ' +
      'empanelled hospital within the period of its empanelment.</div>' +
      '<div class="slip-sign">' +
      '<div class="sign-box"><div class="sign-line"></div><div>Signature of staff member</div></div>' +
      '<div class="sign-box"><div class="sign-line"></div><div>Issuing authority</div>' +
      '<div class="sign-name">' + esc(st.sanctioning || st.officer || '') + '</div></div>' +
      '</div>';
  }

  /* ---------------- the same figures as a spreadsheet ---------------- */

  /**
   * Every report can also come off as a CSV, which is what the accounts
   * section actually wants when the figures have to be worked on further.
   */
  function csv(type, ctx) {
    bind();
    var p = period(ctx);
    var money0 = function (v) { return Number(v) || 0; };
    var rows, name;

    function claimRows(list) {
      var out = [['Date of treatment', 'Treated upto', 'Claim No', 'Type', 'Staff', 'Emp No',
        'Name', 'Dependency', 'ID card no', 'Age', 'Hospital', 'Diagnosis / treatment',
        'Bill no', 'Amount claimed', 'Amount admitted', 'Amount disallowed', 'Status',
        'Sanction no', 'Date of payment', 'Remarks']];
      list.slice().reverse().forEach(function (c) {
        var b = Store.claimant(c) || {};
        var s = Store.staffMember(c.staffId) || {};
        out.push([c.treatFrom, c.treatTo, c.no, Store.CLAIM_TYPE_SHORT[c.type] || c.type,
          s.name || '', s.empNo || '', b.name || '', b.relation || '', b.idCardNo || '',
          Store.ageOf(b, c.treatFrom), hospitalName(c), c.diagnosis || '', c.billNo || '',
          money0(c.amountClaimed), money0(c.amountReimbursed),
          Store.disallowedOn(c) === null ? '' : Store.disallowedOn(c),
          statusLabel(c), c.sanctionNo || '', c.paidDate || '', c.remarks || '']);
      });
      return out;
    }

    switch (type) {
      // asked for by month from the picker, but the whole register when a
      // year is asked for instead — which is how the export button uses it
      case 'monthly':
        name = (ctx && ctx.month) ? 'claims-' + ctx.month : 'claims-' + p.label;
        rows = claimRows(Store.claimList(p.filter));
        break;

      case 'annual':
        name = 'claims-annual-' + ((ctx && ctx.fy) || Store.currentFy());
        rows = [['Month', 'Cashless claims', 'Cashless billed', 'Cashless admitted',
          'Reimbursement claims', 'Reimbursement claimed', 'Reimbursement admitted',
          'Total claimed', 'Total admitted', 'Disallowed']];
        var list = Store.claimList(p.filter);
        var byMonth = {};
        list.forEach(function (c) {
          var m = Store.toMonth(Store.claimDate(c));
          (byMonth[m] = byMonth[m] || []).push(c);
        });
        Object.keys(byMonth).sort().forEach(function (m) {
          var hosp = Store.claimTotals(byMonth[m].filter(function (c) { return c.type === 'HOSPITAL'; }));
          var reim = Store.claimTotals(byMonth[m].filter(function (c) { return c.type === 'REIMB'; }));
          rows.push([Store.monthName(m), hosp.count, hosp.claimed, hosp.reimbursed,
            reim.count, reim.claimed, reim.reimbursed,
            hosp.claimed + reim.claimed, hosp.reimbursed + reim.reimbursed,
            hosp.disallowed + reim.disallowed]);
        });
        break;

      case 'staff-statement':
        var s = Store.staffMember(ctx && ctx.staffId);
        name = 'claims-' + ((s && s.name) || 'staff');
        rows = claimRows(Store.claimList({
          staffId: ctx && ctx.staffId, fy: p.filter.fy, month: p.filter.month
        }));
        break;

      case 'hospital-statement':
        var h = Store.hospital(ctx && ctx.hospitalId);
        name = 'claims-' + ((h && h.name) || 'hospital');
        rows = claimRows(Store.claimList({
          hospitalId: ctx && ctx.hospitalId, fy: p.filter.fy, month: p.filter.month
        }));
        break;

      case 'hospital-reimb':
        name = 'hospital-reimbursement';
        rows = [['Hospital', 'Place', 'Order no', 'Empanelled from', 'Empanelled upto',
          'No of claims', 'Amount billed', 'Amount admitted', 'Amount disallowed',
          'Already paid', 'Now payable', 'Awaiting sanction',
          'Claims still to be examined']];
        Store.claimsByHospital(p.filter).forEach(function (g) {
          var only = g.claims.filter(function (c) { return c.type === 'HOSPITAL'; });
          if (!only.length) return;
          var t = Store.claimTotals(only);
          var hh = g.hospital || {};
          rows.push([g.name, hh.city || '', hh.orderNo || '', hh.empanelFrom || '',
            hh.empanelTo || '', t.count, t.claimed, t.reimbursed, t.disallowed,
            t.paid, t.payable, t.toSanction, t.awaitingCount]);
        });
        break;

      case 'staff-reimb':
        name = 'staff-reimbursement';
        rows = [['Emp No', 'Name of staff', 'Designation', 'ID card no',
          'No of claims', 'Amount claimed', 'Amount admitted', 'Amount disallowed',
          'Already paid', 'Now payable', 'Awaiting sanction',
          'Claims still to be examined']];
        Store.claimsByStaff(p.filter).forEach(function (g) {
          var only = g.claims.filter(function (c) { return c.type === 'REIMB'; });
          if (!only.length) return;
          var t = Store.claimTotals(only);
          var ss = g.staff || {};
          rows.push([ss.empNo || '', g.name, ss.designation || '', ss.idCardNo || '',
            t.count, t.claimed, t.reimbursed, t.disallowed, t.paid, t.payable,
            t.toSanction, t.awaitingCount]);
        });
        break;

      case 'empanelled':
        name = 'empanelled-hospitals';
        rows = [['Name', 'Address', 'City', 'Phone', 'Email', 'Specialty', 'Category',
          'Order No', 'Empanel From', 'Empanel To', 'Position', 'Extensions', 'Remarks']];
        Store.hospitalList().forEach(function (hh) {
          rows.push([hh.name, hh.address || '', hh.city || '', hh.phone || '', hh.email || '',
            hh.specialty || '', hh.category || '', hh.orderNo || '', hh.empanelFrom || '',
            hh.empanelTo || '', Hospitals.STATE_LABEL[Store.empanelStatus(hh)] || '',
            (hh.extensions || []).length, hh.remarks || '']);
        });
        break;

      case 'staff-register':
        name = 'staff-and-dependents';
        rows = [['Emp No', 'Name of staff', 'Designation', 'Department', 'Station',
          'Staff card no', 'Staff age', 'Status', 'Name', 'Dependency', 'Age', 'ID card no']];
        Store.staffList().forEach(function (ss) {
          var fam = Store.dependentsOf(ss.id);
          var lead = [ss.empNo || '', ss.name, ss.designation || '', ss.department || '',
            ss.station || '', ss.idCardNo || '', Store.ageOf(ss), ss.status || 'Serving'];
          if (!fam.length) { rows.push(lead.concat(['(no dependent)', '', '', ''])); return; }
          fam.forEach(function (d) {
            rows.push(lead.concat([d.name, d.relation || '', Store.ageOf(d), d.idCardNo || '']));
          });
        });
        break;

      default:
        return null;
    }

    return {
      name: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.csv',
      rows: rows
    };
  }

  /* ---------------- what reports.js asks for ---------------- */

  function build(type, ctx) {
    bind();
    switch (type) {
      case 'monthly': return monthlyRegister(ctx);
      case 'annual': return annualStatement(ctx);
      case 'staff-statement': return staffStatement(ctx);
      case 'hospital-statement': return hospitalStatement(ctx);
      case 'hospital-reimb': return hospitalReimbursement(ctx);
      case 'staff-reimb': return staffReimbursement(ctx);
      case 'empanelled': return empanelledList();
      case 'staff-register': return staffRegister();
      case 'voucher': return claimVoucher(ctx && ctx.recordId);
      case 'card': return familyCard(ctx && ctx.recordId);
      default: return '';
    }
  }

  global.Statements = { build: build, csv: csv };

})(window);
