/* ============================================================
   referrals.js — referral register
   ============================================================ */
(function (global) {
  'use strict';

  var state = { editing: null, q: '', month: '' };

  function form() { return UI.$('#refForm'); }

  function reset() {
    state.editing = null;
    form().reset();
    form().elements.date.value = UI.today();
    form().elements.no.value = Store.nextReferralNo(UI.today());
    UI.$('#refFormTitle').textContent = 'New Referral';
    UI.$('#refSaveBtn').textContent = 'Save Referral';
    UI.$('#refCancelEdit').classList.add('hidden');
  }

  function edit(id) {
    var r = Store.referral(id);
    if (!r) return;
    state.editing = id;
    UI.fillForm(form(), r);
    form().elements.id.value = r.id;
    UI.$('#refFormTitle').textContent = 'Edit Referral ' + (r.no || '');
    UI.$('#refSaveBtn').textContent = 'Update Referral';
    UI.$('#refCancelEdit').classList.remove('hidden');
    UI.$('#refFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.patient) { UI.toast('Enter the patient name', 'warn'); return; }
    if (!o.hospital) { UI.toast('Enter the hospital the patient is referred to', 'warn'); return; }
    if (!state.editing) delete o.id;

    var clash = Store.referralList().some(function (r) {
      return r.no && r.no === o.no && r.id !== (state.editing || '');
    });
    var renumbered = null;
    if (clash) {
      o.no = Store.nextReferralNo(o.date);
      renumbered = o.no;
    }

    var saved = Store.saveReferral(o);
    reset();
    render();
    App.refresh();
    UI.toast(renumbered
      ? 'That slip number was already used — saved as ' + renumbered
      : 'Referral ' + (saved.no || '') + ' saved', renumbered ? 'warn' : 'ok');
  }

  function remove(id) {
    var r = Store.referral(id);
    if (!r) return;
    if (!confirm('Delete referral ' + (r.no || '') + ' for ' + (r.patient || '') + '?')) return;
    Store.deleteReferral(id);
    if (state.editing === id) reset();
    render();
    App.refresh();
    UI.toast('Referral deleted', 'warn');
  }

  function matches(r) {
    if (state.month && Store.toMonth(r.date) !== state.month) return false;
    if (!state.q) return true;
    return [r.no, r.patient, r.hospital, r.referredTo, r.reason, r.escort, r.relation, r.remarks]
      .join(' ').toLowerCase().indexOf(state.q) !== -1;
  }

  /** Same reasoning as the prescription register: keep slip numbers unique. */
  function refreshNumberIfPristine() {
    if (state.editing) return;
    var f = form();
    if (f.elements.patient.value.trim() || f.elements.hospital.value.trim()) return;
    if (!f.elements.date.value) f.elements.date.value = UI.today();
    f.elements.no.value = Store.nextReferralNo(f.elements.date.value);
  }

  function render() {
    refreshNumberIfPristine();
    var list = Store.referralList().filter(matches);
    var t = UI.$('#refTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No referrals recorded yet.</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Date', 'Slip No.', 'Patient', 'Referred to (hospital)', 'Under / Dept.',
        'Reason', 'Accompanied by', 'Relation', 'Mode', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.slice(0, 300).forEach(function (r) {
      var who = UI.esc(r.patient || '');
      if (r.age || r.sex) {
        who += ' <span class="dim">' + UI.esc([r.age, r.sex].filter(Boolean).join(' / ')) + '</span>';
      }
      html += '<tr' + (state.editing === r.id ? ' class="row-editing"' : '') + '>' +
        '<td class="nowrap">' + UI.dmy(r.date) + '</td>' +
        '<td class="strong nowrap">' + UI.esc(r.no || '—') + '</td>' +
        '<td class="strong">' + who + '</td>' +
        '<td>' + UI.esc(r.hospital || '—') + '</td>' +
        '<td>' + UI.esc(r.referredTo || '—') + '</td>' +
        '<td>' + UI.esc(r.reason || '—') + '</td>' +
        '<td>' + UI.esc(r.escort || '—') + '</td>' +
        '<td>' + UI.esc(r.relation || '—') + '</td>' +
        '<td>' + UI.esc(r.mode || '—') + '</td>' +
        '<td class="row-act nowrap">' +
        '<button class="link" data-edit="' + UI.esc(r.id) + '">Edit</button> ' +
        '<button class="link danger" data-del="' + UI.esc(r.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
    if (list.length > 300) {
      t.insertAdjacentHTML('beforeend',
        '<tfoot><tr><td colspan="10" class="dim">Showing latest 300 of ' + list.length +
        ' — use the search or month filter to narrow down.</td></tr></tfoot>');
    }
  }

  function init() {
    reset();
    form().addEventListener('submit', submit);
    form().elements.date.addEventListener('change', refreshNumberIfPristine);
    UI.$('#refCancelEdit').addEventListener('click', function () { reset(); render(); });

    UI.$('#refSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });
    UI.$('#refMonth').addEventListener('change', function (e) {
      state.month = e.target.value;
      render();
    });

    UI.$('#refTable').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      if (ed) { edit(ed.dataset.edit); render(); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) remove(dl.dataset.del);
    });
  }

  global.Referrals = { init: init, render: render, reset: reset };

})(window);
