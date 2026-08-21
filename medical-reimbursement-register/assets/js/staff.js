/* ============================================================
   staff.js — staff and their dependents

   One section holding every employee together with the family
   members covered by his medical card. A claim can only be booked
   for somebody entered here, which is what keeps the claim register
   free of loose names.
   ============================================================ */
(function (global) {
  'use strict';

  var state = { editing: null, q: '', status: 'all' };

  function form() { return UI.$('#stfForm'); }
  function depBox() { return UI.$('#stfDeps'); }

  /* ---------------- dependent lines ---------------- */

  function depRow(dep) {
    dep = dep || {};
    var wrap = document.createElement('div');
    wrap.className = 'dep-line';
    wrap.innerHTML =
      '<input class="dep-id" type="hidden" value="' + UI.esc(dep.id || '') + '" />' +
      '<input class="dep-name" type="text" placeholder="Name of dependent" value="' +
      UI.esc(dep.name || '') + '" />' +
      '<select class="dep-rel">' + relationOptions(dep.relation) + '</select>' +
      '<input class="dep-dob" type="date" title="Date of birth" value="' +
      UI.esc(dep.dob || '') + '" />' +
      '<input class="dep-age" type="number" min="0" max="130" placeholder="Age" value="' +
      UI.esc(dep.age === undefined ? '' : dep.age) + '" />' +
      '<input class="dep-card" type="text" placeholder="Card / token no." value="' +
      UI.esc(dep.idCardNo || '') + '" />' +
      '<button type="button" class="icon-btn dep-del" title="Remove this dependent">✕</button>';

    // a date of birth is the better record, so it fills the age in and
    // then owns it — the typed age is only for families who do not have
    // the dates of birth handy
    var dob = wrap.querySelector('.dep-dob');
    var age = wrap.querySelector('.dep-age');
    dob.addEventListener('change', function () {
      if (!dob.value) return;
      var n = Store.ageOf({ dob: dob.value });
      if (n !== '') { age.value = n; age.readOnly = true; }
    });
    if (dep.dob) age.readOnly = true;

    wrap.querySelector('.dep-del').addEventListener('click', function () {
      wrap.remove();
      if (!depBox().children.length) addDep();
    });

    depBox().appendChild(wrap);
    return wrap;
  }

  function addDep(dep) { return depRow(dep); }

  function relationOptions(selected) {
    return '<option value="">— relation —</option>' +
      Store.RELATIONS.filter(function (r) { return r !== 'Self'; })
        .map(function (r) {
          return '<option' + (r === selected ? ' selected' : '') + '>' + UI.esc(r) + '</option>';
        }).join('');
  }

  function readDeps() {
    return UI.$$('.dep-line', depBox()).map(function (w) {
      return {
        id: w.querySelector('.dep-id').value,
        name: w.querySelector('.dep-name').value.trim(),
        relation: w.querySelector('.dep-rel').value,
        dob: w.querySelector('.dep-dob').value,
        age: w.querySelector('.dep-age').value,
        idCardNo: w.querySelector('.dep-card').value.trim()
      };
    }).filter(function (d) { return d.name; });
  }

  /* ---------------- form ---------------- */

  function reset() {
    state.editing = null;
    form().reset();
    depBox().innerHTML = '';
    addDep();
    UI.$('#stfFormTitle').textContent = 'Add Staff Member';
    UI.$('#stfSaveBtn').textContent = 'Save Staff & Family';
    UI.$('#stfCancelEdit').classList.add('hidden');
  }

  function edit(id) {
    var s = Store.staffMember(id);
    if (!s) return;
    state.editing = id;
    UI.fillForm(form(), s);
    form().elements.id.value = s.id;
    depBox().innerHTML = '';
    var deps = Store.dependentsOf(id);
    (deps.length ? deps : [{}]).forEach(addDep);
    UI.$('#stfFormTitle').textContent = 'Edit ' + (s.name || 'Staff Member');
    UI.$('#stfSaveBtn').textContent = 'Update Staff & Family';
    UI.$('#stfCancelEdit').classList.remove('hidden');
    UI.$('#stfFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.name) { UI.toast('Enter the name of the staff member', 'warn'); return; }
    if (!state.editing) delete o.id;

    var deps = readDeps();

    // two people on one card number would make a claim impossible to trace
    var cards = {};
    var clash = '';
    if (o.idCardNo) cards[o.idCardNo.toLowerCase()] = o.name;
    deps.forEach(function (d) {
      if (!d.idCardNo) return;
      var k = d.idCardNo.toLowerCase();
      if (cards[k]) clash = d.idCardNo;
      cards[k] = d.name;
    });
    if (clash) {
      UI.toast('Card number ' + clash + ' is entered twice in this family', 'warn');
      return;
    }

    var saved = Store.saveStaff(o);
    Store.saveDependents(saved.id, deps);
    reset();
    render();
    App.refresh();
    UI.toast(saved.name + ' saved with ' + deps.length +
      (deps.length === 1 ? ' dependent' : ' dependents'));
  }

  function remove(id) {
    var s = Store.staffMember(id);
    if (!s) return;
    var deps = Store.dependentsOf(id).length;
    if (!confirm('Remove ' + s.name + (deps ? ' and ' + deps + ' dependent(s)' : '') +
      ' from the register?')) return;

    var r = Store.deleteStaff(id);
    if (!r.ok) {
      alert('Cannot remove ' + s.name + ' — ' + r.count +
        ' claim(s) are booked against this family.\n\n' +
        'Mark the staff member as Retired instead, so the claims stay traceable.');
      return;
    }
    if (state.editing === id) reset();
    render();
    App.refresh();
    UI.toast(s.name + ' removed', 'warn');
  }

  /* ---------------- list ---------------- */

  function matches(s) {
    if (state.status !== 'all' && (s.status || 'Serving') !== state.status) return false;
    if (!state.q) return true;
    var hay = [s.name, s.empNo, s.idCardNo, s.designation, s.department, s.station, s.mobile]
      .concat(Store.dependentsOf(s.id).map(function (d) {
        return d.name + ' ' + (d.idCardNo || '');
      }));
    return hay.join(' ').toLowerCase().indexOf(state.q) !== -1;
  }

  function familyCell(id) {
    var deps = Store.dependentsOf(id);
    if (!deps.length) return '<span class="dim">— no dependents entered —</span>';
    return '<div class="fam-list">' + deps.map(function (d) {
      var age = Store.ageOf(d);
      return '<span class="fam-chip"><b>' + UI.esc(d.name) + '</b>' +
        '<span class="dim"> · ' + UI.esc(d.relation || '—') +
        (age === '' ? '' : ' · ' + UI.esc(age) + ' y') +
        (d.idCardNo ? ' · ' + UI.esc(d.idCardNo) : '') + '</span></span>';
    }).join('') + '</div>';
  }

  function render() {
    var list = Store.staffList().filter(matches);
    var t = UI.$('#stfTable');

    UI.$$('#stfTabs .tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.status === state.status);
    });

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">' +
        (Store.staffList().length ? 'No staff member matches that search.'
          : 'No staff entered yet. Add the first one above.') +
        '</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Emp. No.', 'Name of staff', 'Designation / Dept.', 'Card No.', 'Age',
        'Dependents covered', 'Claims', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.forEach(function (s) {
      var age = Store.ageOf(s);
      var tot = Store.claimTotals(Store.claimList({ staffId: s.id }));
      var retired = (s.status || 'Serving') !== 'Serving';
      html += '<tr' + (state.editing === s.id ? ' class="row-editing"' : '') + '>' +
        '<td class="nowrap">' + UI.esc(s.empNo || '—') + '</td>' +
        '<td class="strong">' + UI.esc(s.name || '') +
        (retired ? ' <span class="chip chip-warn">' + UI.esc(s.status) + '</span>' : '') + '</td>' +
        '<td>' + UI.esc(s.designation || '—') +
        (s.department ? '<br><span class="dim">' + UI.esc(s.department) + '</span>' : '') + '</td>' +
        '<td class="nowrap">' + UI.esc(s.idCardNo || '—') + '</td>' +
        '<td class="nowrap">' + (age === '' ? '—' : UI.esc(age)) + '</td>' +
        '<td>' + familyCell(s.id) + '</td>' +
        '<td class="nowrap">' + (tot.count
          ? tot.count + ' · ' + UI.money(tot.claimed)
          : '<span class="dim">—</span>') + '</td>' +
        '<td class="row-act nowrap">' +
        '<button class="link" data-claim="' + UI.esc(s.id) + '">Claim</button> ' +
        '<button class="link" data-card="' + UI.esc(s.id) + '">Card</button> ' +
        '<button class="link" data-edit="' + UI.esc(s.id) + '">Edit</button> ' +
        '<button class="link danger" data-del="' + UI.esc(s.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';

    var deps = Store.load().deps.length;
    UI.$('#stfCount').textContent = list.length + ' staff · ' + deps +
      (deps === 1 ? ' dependent' : ' dependents') + ' on the register';
  }

  /* ---------------- init ---------------- */

  function init() {
    reset();
    form().addEventListener('submit', submit);
    UI.$('#stfAddDep').addEventListener('click', function () { addDep(); });
    UI.$('#stfCancelEdit').addEventListener('click', function () { reset(); render(); });

    // the staff member's own age follows his date of birth for the same
    // reason the dependents' does
    form().elements.dob.addEventListener('change', function () {
      var v = form().elements.dob.value;
      if (!v) return;
      var n = Store.ageOf({ dob: v });
      if (n !== '') { form().elements.age.value = n; form().elements.age.readOnly = true; }
    });

    UI.$('#stfSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });
    UI.$('#stfTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.status = b.dataset.status;
      render();
    });

    UI.$('#stfTable').addEventListener('click', function (e) {
      var cl = e.target.closest('[data-claim]');
      if (cl) { Claims.openFor(cl.dataset.claim); return; }
      var cd = e.target.closest('[data-card]');
      if (cd) { Reports.openSlip('card', cd.dataset.card); return; }
      var ed = e.target.closest('[data-edit]');
      if (ed) { edit(ed.dataset.edit); render(); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) remove(dl.dataset.del);
    });
  }

  global.Staff = { init: init, render: render, reset: reset, edit: edit };

})(window);
