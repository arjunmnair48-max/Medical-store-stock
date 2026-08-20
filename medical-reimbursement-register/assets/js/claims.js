/* ============================================================
   claims.js — medical claim register

   Two kinds of claim share this one register, because they carry the
   same particulars and have to be totalled together at the end of the
   month:

     HOSPITAL — cashless treatment at an empanelled hospital, where the
                bill is settled with the hospital itself
     REIMB    — treatment the employee has already paid for and is
                claiming back

   Who the money goes to is the only real difference, and that follows
   from the type.
   ============================================================ */
(function (global) {
  'use strict';

  var state = { editing: null, q: '', type: 'all', status: 'all', month: '', fy: '' };

  function form() { return UI.$('#clmForm'); }

  var STATUS_CHIP = {
    PENDING: 'chip-warn', SANCTIONED: 'chip-info',
    PAID: 'chip-good', REJECTED: 'chip-bad'
  };

  /* ---------------- pickers inside the form ---------------- */

  function staffOptions(sel, selectedId) {
    var list = Store.staffList();
    sel.innerHTML = '<option value="">— select staff member —</option>' +
      list.map(function (s) {
        var label = s.name + (s.empNo ? ' [' + s.empNo + ']' : '') +
          (s.designation ? ' — ' + s.designation : '');
        return '<option value="' + UI.esc(s.id) + '"' +
          (s.id === selectedId ? ' selected' : '') + '>' + UI.esc(label) + '</option>';
      }).join('');
    if (!list.length) {
      sel.innerHTML = '<option value="">— no staff entered yet —</option>';
    }
  }

  /** The card holder and his family, so a claim always names one of them. */
  function beneficiaryOptions(staffId, selectedId) {
    var sel = form().elements.beneficiaryId;
    var list = Store.beneficiaries(staffId);
    if (!list.length) {
      sel.innerHTML = '<option value="">— choose the staff member first —</option>';
      showCard();
      return;
    }
    sel.innerHTML = list.map(function (b) {
      var age = Store.ageOf(b);
      var label = b.name + ' (' + (b.relation || '—') + (age === '' ? '' : ', ' + age + ' y') + ')';
      return '<option value="' + UI.esc(b.id) + '"' +
        (b.id === selectedId ? ' selected' : '') + '>' + UI.esc(label) + '</option>';
    }).join('');
    showCard();
  }

  /** Shows the card number of whoever is selected — it is never typed twice. */
  function showCard() {
    var f = form();
    var b = Store.beneficiary(f.elements.staffId.value, f.elements.beneficiaryId.value);
    var el = UI.$('#clmCardNo');
    if (!b) { el.textContent = '—'; el.className = 'read-value dim'; return; }
    var age = Store.ageOf(b, f.elements.treatFrom.value);
    el.className = 'read-value';
    el.innerHTML = '<b>' + UI.esc(b.idCardNo || 'no card number on file') + '</b>' +
      '<span class="dim"> · ' + UI.esc(b.relation || '') +
      (age === '' ? '' : ' · ' + UI.esc(age) + ' years') + '</span>';
  }

  function hospitalOptions(selectedId) {
    var sel = form().elements.hospitalId;
    var list = Store.hospitalList();
    var html = '<option value="">— select hospital —</option>';
    list.forEach(function (h) {
      var st = Store.empanelStatus(h);
      var tag = st === 'expired' ? ' (empanelment expired)'
        : st === 'ended' ? ' (de-empanelled)'
          : st === 'expiring' ? ' (expiring soon)' : '';
      html += '<option value="' + UI.esc(h.id) + '"' +
        (h.id === selectedId ? ' selected' : '') + '>' +
        UI.esc(h.name + (h.city ? ', ' + h.city : '') + tag) + '</option>';
    });
    html += '<option value="__other__"' + (selectedId === '__other__' ? ' selected' : '') +
      '>— a hospital not on the empanelled list —</option>';
    sel.innerHTML = html;
    syncOtherHospital();
  }

  /**
   * A reimbursement claim may name a hospital that was never empanelled —
   * an emergency away from station, most often — so the type-in box opens
   * whenever that option is chosen.
   */
  function syncOtherHospital() {
    var other = form().elements.hospitalId.value === '__other__';
    UI.$('#clmOtherWrap').classList.toggle('hidden', !other);
    form().elements.hospitalName.required = other;
  }

  /** Warns, beside the date, when the treatment falls outside the empanelment. */
  function checkEmpanelment() {
    var f = form();
    var el = UI.$('#clmEmpanelNote');
    var h = Store.hospital(f.elements.hospitalId.value);
    var day = f.elements.treatFrom.value;
    if (!h || !day) { el.textContent = ''; el.className = 'hint claim-note'; return true; }

    var ok = Store.isEmpanelledOn(h, day);
    if (ok) {
      el.className = 'hint claim-note good';
      el.textContent = 'Empanelled on this date' +
        (h.empanelTo ? ' — period runs to ' + UI.dmy(h.empanelTo) : '');
    } else {
      el.className = 'hint claim-note bad';
      el.textContent = 'On ' + UI.dmy(day) + ' this hospital was NOT within its empanelment (' +
        (h.empanelFrom ? UI.dmy(h.empanelFrom) : '—') + ' to ' +
        (h.empanelTo ? UI.dmy(h.empanelTo) : 'no end date') + ')';
    }
    return ok;
  }

  /* ---------------- form ---------------- */

  function typeValue() {
    var el = UI.$('#clmForm input[name="type"]:checked');
    return el ? el.value : 'HOSPITAL';
  }

  /**
   * The register keeps one form for both kinds of claim; only the wording
   * and the payee line change, so the clerk sees a form that reads like the
   * claim in front of him.
   */
  function syncType() {
    var t = typeValue();
    var cashless = t === 'HOSPITAL';
    UI.$('#clmClaimedLabel').innerHTML = (cashless
      ? 'Amount billed by hospital' : 'Amount claimed by staff') + ' <b>*</b>';
    UI.$('#clmReimbLabel').textContent = cashless
      ? 'Amount admitted — passed to hospital' : 'Amount admitted — reimbursed to staff';
    UI.$('#clmPayee').innerHTML = (cashless
      ? 'Payment is made to the hospital.'
      : 'Reimbursement is paid to the staff member.') +
      ' The amount admitted is the final figure after restriction — whatever the bill ' +
      'claimed over and above it is <b>disallowed</b>, not carried forward.';
    UI.$('#clmHospLabel').innerHTML = cashless
      ? 'Empanelled hospital <b>*</b>' : 'Hospital treated at';
    form().elements.hospitalId.required = cashless;
    refreshNumberIfPristine();
  }

  function reset() {
    state.editing = null;
    form().reset();
    UI.$('#clmTypeHospital').checked = true;
    form().elements.date.value = UI.today();
    form().elements.treatFrom.value = UI.today();
    form().elements.status.value = 'PENDING';
    staffOptions(form().elements.staffId, '');
    beneficiaryOptions('', '');
    hospitalOptions('');
    form().elements.no.value = Store.nextClaimNo(UI.today(), 'HOSPITAL');
    UI.$('#clmEmpanelNote').textContent = '';
    UI.$('#clmFormTitle').textContent = 'New Claim';
    UI.$('#clmSaveBtn').textContent = 'Save Claim';
    UI.$('#clmCancelEdit').classList.add('hidden');
    syncType();
  }

  function edit(id) {
    var c = Store.claim(id);
    if (!c) return;
    state.editing = id;
    UI.fillForm(form(), c);
    form().elements.id.value = c.id;
    UI.$('#clmTypeHospital').checked = c.type !== 'REIMB';
    UI.$('#clmTypeReimb').checked = c.type === 'REIMB';
    staffOptions(form().elements.staffId, c.staffId);
    beneficiaryOptions(c.staffId, c.beneficiaryId);
    hospitalOptions(c.hospitalId || (c.hospitalName ? '__other__' : ''));
    if (!c.hospitalId && c.hospitalName) form().elements.hospitalName.value = c.hospitalName;
    syncType();
    syncOtherHospital();
    checkEmpanelment();
    UI.$('#clmFormTitle').textContent = 'Edit Claim ' + (c.no || '');
    UI.$('#clmSaveBtn').textContent = 'Update Claim';
    UI.$('#clmCancelEdit').classList.remove('hidden');
    UI.$('#clmFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    o.type = typeValue();

    if (!o.staffId) { UI.toast('Choose the staff member', 'warn'); return; }
    if (!o.beneficiaryId) { UI.toast('Choose who was treated', 'warn'); return; }
    if (!o.treatFrom) { UI.toast('Enter the date of treatment', 'warn'); return; }
    if (o.treatTo && o.treatTo < o.treatFrom) {
      UI.toast('Treatment cannot end before it starts', 'warn'); return;
    }
    if (o.type === 'HOSPITAL' && !o.hospitalId) {
      UI.toast('Choose the hospital that treated the patient', 'warn'); return;
    }
    if (o.hospitalId === '__other__') {
      if (!o.hospitalName) { UI.toast('Enter the name of the hospital', 'warn'); return; }
      o.hospitalId = '';
    }

    var claimed = Number(o.amountClaimed) || 0;
    var passed = Number(o.amountReimbursed) || 0;
    if (claimed <= 0) { UI.toast('Enter the amount claimed', 'warn'); return; }
    if (passed > claimed &&
      !confirm('The amount admitted (' + UI.money(passed) + ') is more than the amount claimed (' +
        UI.money(claimed) + ').\n\nSave it as entered?')) return;

    // a bill outside the empanelment period is the one thing the office
    // must not pay cashless without a covering order, so it is put to the
    // clerk rather than blocked outright
    if (o.type === 'HOSPITAL' && !checkEmpanelment()) {
      if (!confirm('This hospital was not within its empanelment period on ' +
        UI.dmy(o.treatFrom) + '.\n\nRecord the claim anyway?')) return;
    }

    if (!state.editing) delete o.id;

    var clash = Store.claimList().some(function (c) {
      return c.no && c.no === o.no && c.id !== (state.editing || '');
    });
    var renumbered = null;
    if (clash) {
      o.no = Store.nextClaimNo(o.treatFrom, o.type);
      renumbered = o.no;
    }

    var saved = Store.saveClaim(o);
    reset();
    render();
    App.refresh();
    UI.toast(renumbered
      ? 'That claim number was already used — saved as ' + renumbered
      : 'Claim ' + (saved.no || '') + ' saved', renumbered ? 'warn' : 'ok');
  }

  function remove(id) {
    var c = Store.claim(id);
    if (!c) return;
    if (!confirm('Delete claim ' + (c.no || '') + ' for ' + (c.benName || '') + '?')) return;
    Store.deleteClaim(id);
    if (state.editing === id) reset();
    render();
    App.refresh();
    UI.toast('Claim deleted', 'warn');
  }

  /** Opens a fresh claim with one staff member already chosen. */
  function openFor(staffId) {
    App.go('claims');
    reset();
    form().elements.staffId.value = staffId;
    beneficiaryOptions(staffId, '');
    UI.$('#clmFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Keeps the claim number unique while the form is still untouched. */
  function refreshNumberIfPristine() {
    if (state.editing) return;
    var f = form();
    if (f.elements.staffId.value || Number(f.elements.amountClaimed.value)) return;
    f.elements.no.value = Store.nextClaimNo(f.elements.treatFrom.value || UI.today(), typeValue());
  }

  /* ---------------- list ---------------- */

  function matches(c) {
    if (state.type !== 'all' && c.type !== state.type) return false;
    if (state.status !== 'all' && (c.status || 'PENDING') !== state.status) return false;
    if (state.month && Store.toMonth(Store.claimDate(c)) !== state.month) return false;
    if (state.fy && state.fy !== 'all' && Store.fyOf(Store.claimDate(c)) !== state.fy) return false;
    if (!state.q) return true;
    var b = Store.claimant(c) || {};
    var s = Store.staffMember(c.staffId) || {};
    return [c.no, c.billNo, c.diagnosis, c.sanctionNo, c.remarks, c.hospitalName,
      b.name, b.idCardNo, s.name, s.empNo]
      .join(' ').toLowerCase().indexOf(state.q) !== -1;
  }

  function fyOptions() {
    var sel = UI.$('#clmFy');
    var keep = sel.value;
    sel.innerHTML = '<option value="all">All years</option>' +
      Store.fyList().map(function (f) {
        return '<option value="' + UI.esc(f) + '"' + (f === keep ? ' selected' : '') + '>' +
          UI.esc(Store.fyName(f)) + '</option>';
      }).join('');
    if (keep) sel.value = keep;
  }

  function render() {
    fyOptions();
    refreshNumberIfPristine();

    var list = Store.claimList().filter(matches);
    var tot = Store.claimTotals(list);
    var t = UI.$('#clmTable');

    UI.$$('#clmTabs .tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.type === state.type);
    });

    UI.$('#clmTotals').innerHTML =
      '<span><b>' + tot.count + '</b> claim' + (tot.count === 1 ? '' : 's') + '</span>' +
      '<span>Claimed <b>' + UI.money(tot.claimed) + '</b></span>' +
      '<span>Admitted <b class="good">' + UI.money(tot.reimbursed) + '</b></span>' +
      '<span>Disallowed <b>' + UI.money(tot.disallowed) + '</b></span>' +
      (tot.payable
        ? '<span>Sanctioned, not paid <b class="warn">' + UI.money(tot.payable) + '</b></span>'
        : '') +
      (tot.awaitingCount
        ? '<span>Awaiting assessment <b class="warn">' + tot.awaitingCount +
          '</b> <span class="dim">(' + UI.money(tot.awaiting) + ' billed)</span></span>'
        : '');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">' +
        (Store.claimList().length ? 'No claim matches these filters.'
          : 'No claim recorded yet. Enter the first one above.') +
        '</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Date of treatment', 'Claim No.', 'Type', 'Name', 'Dependency', 'Card No.',
        'Hospital', 'Claimed', 'Admitted', 'Disallowed', 'Status', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.slice(0, 300).forEach(function (c) {
      var b = Store.claimant(c) || {};
      var h = Store.hospital(c.hospitalId);
      var claimed = Number(c.amountClaimed) || 0;
      var passed = Number(c.amountReimbursed) || 0;
      var cut = Store.disallowedOn(c);
      var st = c.status || 'PENDING';
      var outside = c.type === 'HOSPITAL' && h && !Store.isEmpanelledOn(h, c.treatFrom);
      var dates = UI.dmy(c.treatFrom) +
        (c.treatTo && c.treatTo !== c.treatFrom ? ' – ' + UI.dmy(c.treatTo) : '');

      html += '<tr' + (state.editing === c.id ? ' class="row-editing"' : '') + '>' +
        '<td class="nowrap">' + dates + '</td>' +
        '<td class="strong nowrap">' + UI.esc(c.no || '—') + '</td>' +
        '<td><span class="chip ' + (c.type === 'REIMB' ? 'chip-reimb' : 'chip-cashless') + '">' +
        UI.esc(Store.CLAIM_TYPE_SHORT[c.type] || '') + '</span></td>' +
        '<td class="strong">' + UI.esc(b.name || '—') + '</td>' +
        '<td>' + UI.esc(b.relation || '—') + '</td>' +
        '<td class="nowrap">' + UI.esc(b.idCardNo || '—') + '</td>' +
        '<td>' + UI.esc(h ? h.name : (c.hospitalName || '—')) +
        (outside ? '<br><span class="chip chip-bad">outside empanelment</span>' : '') + '</td>' +
        '<td class="ta-right nowrap">' + UI.money(claimed) + '</td>' +
        '<td class="ta-right nowrap">' + (passed ? UI.money(passed) : '<span class="dim">—</span>') + '</td>' +
        // an unexamined claim has nothing disallowed yet — it is only
        // waiting to be looked at, and must not read as a deduction
        '<td class="ta-right nowrap">' + (cut === null
          ? '<span class="dim">not assessed</span>'
          : cut ? UI.money(cut) : '—') + '</td>' +
        '<td><span class="chip ' + STATUS_CHIP[st] + '">' +
        UI.esc(Store.CLAIM_STATUS[st] || st) + '</span></td>' +
        '<td class="row-act nowrap">' +
        '<button class="link" data-voucher="' + UI.esc(c.id) + '">Voucher</button> ' +
        '<button class="link" data-edit="' + UI.esc(c.id) + '">Edit</button> ' +
        '<button class="link danger" data-del="' + UI.esc(c.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
    if (list.length > 300) {
      t.insertAdjacentHTML('beforeend',
        '<tfoot><tr><td colspan="12" class="dim">Showing latest 300 of ' + list.length +
        ' — narrow it down with the filters above.</td></tr></tfoot>');
    }
  }

  /** Everything now on screen, as a spreadsheet. */
  function csv() {
    var list = Store.claimList().filter(matches);
    var rows = [['Date of treatment', 'Treated upto', 'Claim No', 'Type', 'Staff', 'Emp No',
      'Name', 'Dependency', 'ID card no', 'Age', 'Hospital', 'Diagnosis / treatment',
      'Bill no', 'Bill date', 'Amount claimed', 'Amount admitted', 'Amount disallowed',
      'Status', 'Sanction no', 'Date of payment', 'Remarks']];
    list.forEach(function (c) {
      var b = Store.claimant(c) || {};
      var s = Store.staffMember(c.staffId) || {};
      var h = Store.hospital(c.hospitalId);
      var claimed = Number(c.amountClaimed) || 0;
      var passed = Number(c.amountReimbursed) || 0;
      var cut = Store.disallowedOn(c);
      rows.push([c.treatFrom, c.treatTo, c.no, Store.CLAIM_TYPE_SHORT[c.type] || c.type,
        s.name || '', s.empNo || '', b.name || '', b.relation || '', b.idCardNo || '',
        Store.ageOf(b, c.treatFrom), h ? h.name : (c.hospitalName || ''), c.diagnosis || '',
        c.billNo || '', c.billDate || '', claimed, passed, cut === null ? '' : cut,
        Store.CLAIM_STATUS[c.status || 'PENDING'], c.sanctionNo || '', c.paidDate || '',
        c.remarks || '']);
    });
    UI.download('medical-claims.csv', UI.toCsv(rows), 'text/csv');
    UI.toast(list.length + ' claim(s) downloaded');
  }

  /* ---------------- init ---------------- */

  function refreshSelects() {
    var f = form();
    staffOptions(f.elements.staffId, f.elements.staffId.value);
    beneficiaryOptions(f.elements.staffId.value, f.elements.beneficiaryId.value);
    hospitalOptions(f.elements.hospitalId.value);
  }

  function init() {
    reset();
    form().addEventListener('submit', submit);
    UI.$('#clmCancelEdit').addEventListener('click', function () { reset(); render(); });

    UI.$$('#clmForm input[name="type"]').forEach(function (r) {
      r.addEventListener('change', function () { syncType(); checkEmpanelment(); });
    });
    form().elements.staffId.addEventListener('change', function (e) {
      beneficiaryOptions(e.target.value, '');
    });
    form().elements.beneficiaryId.addEventListener('change', showCard);
    form().elements.hospitalId.addEventListener('change', function () {
      syncOtherHospital();
      checkEmpanelment();
    });
    form().elements.treatFrom.addEventListener('change', function () {
      refreshNumberIfPristine();
      checkEmpanelment();
      showCard();
    });

    UI.$('#clmSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });
    UI.$('#clmTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.type = b.dataset.type;
      render();
    });
    UI.$('#clmMonth').addEventListener('change', function (e) {
      state.month = e.target.value;
      render();
    });
    UI.$('#clmFy').addEventListener('change', function (e) {
      state.fy = e.target.value;
      render();
    });
    UI.$('#clmStatus').addEventListener('change', function (e) {
      state.status = e.target.value;
      render();
    });
    UI.$('#clmCsv').addEventListener('click', csv);

    UI.$('#clmTable').addEventListener('click', function (e) {
      var v = e.target.closest('[data-voucher]');
      if (v) { Reports.openSlip('voucher', v.dataset.voucher); return; }
      var ed = e.target.closest('[data-edit]');
      if (ed) { edit(ed.dataset.edit); render(); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) remove(dl.dataset.del);
    });
  }

  global.Claims = {
    init: init, render: render, reset: reset, refreshSelects: refreshSelects,
    openFor: openFor, csv: csv
  };

})(window);
