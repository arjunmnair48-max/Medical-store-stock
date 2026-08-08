/* ============================================================
   prescriptions.js — OP prescription register

   Saving a prescription issues the prescribed medicines from stock
   automatically; editing or deleting one puts the difference back.
   ============================================================ */
(function (global) {
  'use strict';

  var state = { editing: null, q: '', month: '' };

  function form() { return UI.$('#rxForm'); }
  function lineBox() { return UI.$('#rxLines'); }

  /* ---------------- prescribed-medicine lines ---------------- */

  function lineRow(line) {
    line = line || {};
    var wrap = document.createElement('div');
    wrap.className = 'rx-line';
    wrap.innerHTML =
      '<select class="rx-item"></select>' +
      '<input class="rx-qty" type="number" step="any" min="0" placeholder="Qty" value="' +
      UI.esc(line.qty === undefined ? '' : line.qty) + '" />' +
      '<input class="rx-dose" type="text" placeholder="Dosage — e.g. 1-0-1 for 5 days" value="' +
      UI.esc(line.dose || '') + '" />' +
      '<span class="rx-stock dim"></span>' +
      '<button type="button" class="icon-btn rx-del" title="Remove this medicine">✕</button>';

    var sel = wrap.querySelector('.rx-item');
    UI.itemOptions(sel, 'consumable', line.itemId || '');

    sel.addEventListener('change', function () { showStock(wrap); });
    wrap.querySelector('.rx-qty').addEventListener('input', function () { showStock(wrap); });
    wrap.querySelector('.rx-del').addEventListener('click', function () {
      wrap.remove();
      if (!lineBox().children.length) addLine();
    });

    lineBox().appendChild(wrap);
    showStock(wrap);
    return wrap;
  }

  function addLine(line) { return lineRow(line); }

  /**
   * Shows what is on the shelf beside each line.
   * When an existing prescription is being edited its own earlier deduction
   * is added back first, otherwise the same prescription would look as if it
   * had already eaten the stock twice.
   */
  function showStock(wrap) {
    var id = wrap.querySelector('.rx-item').value;
    var el = wrap.querySelector('.rx-stock');
    if (!id) { el.textContent = ''; el.className = 'rx-stock dim'; return; }

    var it = Store.item(id);
    var bal = Store.balance(id) + alreadyIssued(id);
    var want = Number(wrap.querySelector('.rx-qty').value) || 0;

    el.textContent = UI.num(bal) + ' ' + (it.unit || '') + ' in hand';
    el.className = 'rx-stock ' + (want > bal ? 'bad' : bal <= 0 ? 'bad' : 'dim');
  }

  /** Quantity of an item already deducted by the prescription being edited. */
  function alreadyIssued(itemId) {
    if (!state.editing) return 0;
    var rec = Store.rx(state.editing);
    if (!rec) return 0;
    return (rec.lines || []).reduce(function (s, l) {
      return l.itemId === itemId ? s + (Math.abs(Number(l.qty)) || 0) : s;
    }, 0);
  }

  function readLines() {
    return UI.$$('.rx-line', lineBox()).map(function (w) {
      return {
        itemId: w.querySelector('.rx-item').value,
        qty: w.querySelector('.rx-qty').value,
        dose: w.querySelector('.rx-dose').value.trim()
      };
    }).filter(function (l) { return l.itemId && Number(l.qty) > 0; });
  }

  /* ---------------- form ---------------- */

  function reset() {
    state.editing = null;
    form().reset();
    lineBox().innerHTML = '';
    addLine();
    form().elements.date.value = UI.today();
    form().elements.no.value = Store.nextRxNo(UI.today());
    UI.$('#rxFormTitle').textContent = 'New Prescription';
    UI.$('#rxSaveBtn').textContent = 'Save & Issue Medicines';
    UI.$('#rxCancelEdit').classList.add('hidden');
  }

  function edit(id) {
    var r = Store.rx(id);
    if (!r) return;
    state.editing = id;
    UI.fillForm(form(), r);
    form().elements.id.value = r.id;
    lineBox().innerHTML = '';
    (r.lines && r.lines.length ? r.lines : [{}]).forEach(addLine);
    UI.$('#rxFormTitle').textContent = 'Edit Prescription ' + (r.no || '');
    UI.$('#rxSaveBtn').textContent = 'Update & Re-issue';
    UI.$('#rxCancelEdit').classList.remove('hidden');
    UI.$('#rxFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.patient) { UI.toast('Enter the patient name', 'warn'); return; }

    o.lines = readLines();
    if (!o.lines.length) {
      UI.toast('Add at least one medicine', 'warn');
      return;
    }
    if (!state.editing) delete o.id;

    // a register must not carry the same number twice
    var clash = Store.rxList().some(function (r) {
      return r.no && r.no === o.no && r.id !== (state.editing || '');
    });
    var renumbered = null;
    if (clash) {
      o.no = Store.nextRxNo(o.date);
      renumbered = o.no;
    }

    // check the shelf before committing
    var short = [];
    var wanted = {};
    o.lines.forEach(function (l) {
      wanted[l.itemId] = (wanted[l.itemId] || 0) + Math.abs(Number(l.qty) || 0);
    });
    Object.keys(wanted).forEach(function (id) {
      var have = Store.balance(id) + alreadyIssued(id);
      if (wanted[id] > have) {
        var it = Store.item(id);
        short.push('• ' + it.name + ' — asked ' + UI.num(wanted[id]) +
          ', in hand ' + UI.num(have) + ' ' + (it.unit || ''));
      }
    });
    if (short.length) {
      if (!confirm('There is not enough stock for:\n\n' + short.join('\n') +
        '\n\nSaving will make the balance negative. Continue?')) return;
    }

    var saved = Store.saveRx(o);
    var n = saved.lines.length;
    reset();
    render();
    App.refresh();
    if (renumbered) {
      UI.toast('That number was already used — saved as ' + renumbered, 'warn');
    } else {
      UI.toast('Prescription ' + (saved.no || '') + ' saved — ' + n +
        ' medicine' + (n === 1 ? '' : 's') + ' issued from stock');
    }
  }

  function remove(id) {
    var r = Store.rx(id);
    if (!r) return;
    var n = (r.lines || []).length;
    if (!confirm('Delete prescription ' + (r.no || '') + ' for ' + (r.patient || '') + '?\n\n' +
      'The ' + n + ' medicine' + (n === 1 ? '' : 's') + ' issued by it will be added back to stock.')) return;
    Store.deleteRx(id);
    if (state.editing === id) reset();
    render();
    App.refresh();
    UI.toast('Prescription deleted — stock restored', 'warn');
  }

  /* ---------------- list ---------------- */

  function medsText(r) {
    if (!r.lines || !r.lines.length) return '<span class="dim">—</span>';
    return r.lines.map(function (l) {
      var it = Store.item(l.itemId);
      return UI.esc(it ? it.name : '(deleted item)') + ' <b>×' + UI.num(l.qty) + '</b>' +
        (it && it.unit ? ' <span class="dim">' + UI.esc(it.unit) + '</span>' : '');
    }).join('<br>');
  }

  function matches(r) {
    if (state.month && Store.toMonth(r.date) !== state.month) return false;
    if (!state.q) return true;
    var meds = (r.lines || []).map(function (l) {
      var it = Store.item(l.itemId);
      return it ? it.name : '';
    }).join(' ');
    return [r.no, r.patient, r.problem, r.doctor, r.remarks, meds]
      .join(' ').toLowerCase().indexOf(state.q) !== -1;
  }

  /**
   * Re-issues the suggested number on an untouched form.
   * Without this the number picked when the screen was first built goes
   * stale as soon as other prescriptions are added, and two patients end
   * up sharing a prescription number.
   */
  function refreshNumberIfPristine() {
    if (state.editing) return;
    var f = form();
    if (f.elements.patient.value.trim()) return;      // being filled in — leave it alone
    if (readLines().length) return;
    if (!f.elements.date.value) f.elements.date.value = UI.today();
    f.elements.no.value = Store.nextRxNo(f.elements.date.value);
  }

  function render() {
    refreshNumberIfPristine();
    var list = Store.rxList().filter(matches);
    var t = UI.$('#rxTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No prescriptions recorded yet.</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Date', 'Prescription No.', 'Patient', 'Problem / Diagnosis', 'Medicines issued', 'Prescribed by', '']
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
        '<td>' + UI.esc(r.problem || '—') + '</td>' +
        '<td>' + medsText(r) + '</td>' +
        '<td>' + UI.esc(r.doctor || '—') + '</td>' +
        '<td class="row-act nowrap">' +
        '<button class="link" data-slip="' + UI.esc(r.id) + '">Slip</button> ' +
        '<button class="link" data-edit="' + UI.esc(r.id) + '">Edit</button> ' +
        '<button class="link danger" data-del="' + UI.esc(r.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
    if (list.length > 300) {
      t.insertAdjacentHTML('beforeend',
        '<tfoot><tr><td colspan="7" class="dim">Showing latest 300 of ' + list.length +
        ' — use the search or month filter to narrow down.</td></tr></tfoot>');
    }
  }

  /* ---------------- wiring ---------------- */

  function init() {
    reset();
    form().addEventListener('submit', submit);
    form().elements.date.addEventListener('change', refreshNumberIfPristine);
    UI.$('#rxAddLine').addEventListener('click', function () { addLine(); });
    UI.$('#rxCancelEdit').addEventListener('click', function () { reset(); render(); });

    UI.$('#rxSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });
    UI.$('#rxMonth').addEventListener('change', function (e) {
      state.month = e.target.value;
      render();
    });

    UI.$('#rxTable').addEventListener('click', function (e) {
      var sl = e.target.closest('[data-slip]');
      if (sl) { Reports.openSlip('rx-slip', sl.dataset.slip); return; }
      var ed = e.target.closest('[data-edit]');
      if (ed) { edit(ed.dataset.edit); render(); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) remove(dl.dataset.del);
    });
  }

  /** Re-point the item dropdowns after the item master changes. */
  function refreshSelects() {
    UI.$$('.rx-line', lineBox()).forEach(function (w) {
      var sel = w.querySelector('.rx-item');
      UI.itemOptions(sel, 'consumable', sel.value);
      showStock(w);
    });
  }

  global.Rx = { init: init, render: render, refreshSelects: refreshSelects, reset: reset };

})(window);
