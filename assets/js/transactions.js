/* ============================================================
   transactions.js — Receipt / Issue entry
   ============================================================ */
(function (global) {
  'use strict';

  var state = { type: 'all', q: '' };

  function form() { return UI.$('#txnForm'); }

  function refreshSelect() {
    var sel = UI.$('#txnItemSelect');
    var keep = sel.value;
    UI.itemOptions(sel, 'all', keep);
  }

  function showBalance() {
    var id = form().elements.itemId.value;
    var hint = UI.$('#txnBalanceHint');
    if (!id) { hint.textContent = ''; return; }
    var it = Store.item(id);
    hint.innerHTML = 'Stock in hand: <b>' + UI.num(Store.balance(id)) + ' ' +
      UI.esc(it.unit || '') + '</b>';
  }

  /* prefill batch/expiry/rate from the item master when an item is picked */
  function prefill() {
    var id = form().elements.itemId.value;
    if (!id) return;
    var it = Store.item(id);
    if (!it) return;
    var f = form();
    if (!f.elements.batchNo.value) f.elements.batchNo.value = it.batchNo || '';
    if (!f.elements.expiry.value) f.elements.expiry.value = it.expiry || '';
    if (!f.elements.rate.value) f.elements.rate.value = it.rate || '';
  }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.itemId) { UI.toast('Choose an item first', 'warn'); return; }

    var qty = Number(o.qty);
    if (!isFinite(qty) || qty === 0) { UI.toast('Enter a quantity', 'warn'); return; }
    if (o.type !== 'ADJ') qty = Math.abs(qty);
    o.qty = qty;
    o.rate = o.rate === '' ? '' : Number(o.rate);
    delete o.id;

    // warn (but allow) if an issue would drive stock negative
    if (o.type === 'OUT' || o.type === 'EXP') {
      var bal = Store.balance(o.itemId);
      if (qty > bal) {
        if (!confirm('Stock in hand is only ' + UI.num(bal) +
          '. Recording ' + UI.num(qty) + ' will make the balance negative.\n\nContinue?')) return;
      }
    }

    // keep the item master in step with the latest receipt
    if (o.type === 'IN') {
      var it = Store.item(o.itemId);
      if (it) {
        var changed = false;
        if (o.batchNo && o.batchNo !== it.batchNo) { it.batchNo = o.batchNo; changed = true; }
        if (o.expiry && o.expiry !== it.expiry) { it.expiry = o.expiry; changed = true; }
        if (o.rate !== '' && Number(o.rate) !== Number(it.rate)) { it.rate = o.rate; changed = true; }
        if (changed) Store.saveItem(it);
      }
    }

    Store.saveTxn(o);

    var keepDate = o.date;
    form().reset();
    form().elements.date.value = keepDate;
    UI.$('#txnBalanceHint').textContent = '';
    render();
    App.refresh();
    UI.toast('Entry saved');
  }

  function matches(t) {
    if (!state.q) return true;
    var it = Store.item(t.itemId) || {};
    var hay = [it.name, it.code, t.ref, t.party, t.batchNo, t.remarks].join(' ').toLowerCase();
    return hay.indexOf(state.q) !== -1;
  }

  function render() {
    var list = Store.txns({ type: state.type }).filter(matches);
    var t = UI.$('#txnTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No entries recorded yet.</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Date', 'Item', 'Type', 'Qty', 'Bill / Indent', 'From / To', 'Batch', 'Remarks', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.slice(0, 400).forEach(function (tx) {
      var it = Store.item(tx.itemId);
      var sign = Store.signed(tx);
      html += '<tr>' +
        '<td class="nowrap">' + UI.dmy(tx.date) + '</td>' +
        '<td class="strong">' + UI.esc(it ? it.name : '(deleted item)') + '</td>' +
        '<td>' + typeChip(tx.type) + '</td>' +
        '<td class="num ' + (sign < 0 ? 'bad' : 'good') + '">' +
        (sign > 0 ? '+' : '') + UI.num(sign) + '</td>' +
        '<td>' + UI.esc(tx.ref || '—') + '</td>' +
        '<td>' + UI.esc(tx.party || '—') + '</td>' +
        '<td>' + UI.esc(tx.batchNo || '—') + '</td>' +
        '<td class="dim">' + UI.esc(tx.remarks || '') + '</td>' +
        '<td class="row-act">' + (tx.rxId
          ? '<span class="chip chip-rx" title="Issued by a prescription — edit it there">℞ ' +
            UI.esc(tx.ref || 'prescription') + '</span>'
          : tx.boxEntryId
            ? '<span class="chip chip-fab" title="First aid box entry — edit it there">✚ ' +
              UI.esc(tx.ref || 'box') + '</span>'
            : '<button class="link danger" data-del="' + UI.esc(tx.id) + '">Delete</button>') +
        '</td></tr>';
    });

    t.innerHTML = html + '</tbody>';
    if (list.length > 400) {
      t.insertAdjacentHTML('beforeend',
        '<tfoot><tr><td colspan="9" class="dim">Showing latest 400 of ' + list.length +
        ' entries — use search to narrow down.</td></tr></tfoot>');
    }
  }

  function typeChip(t) {
    var k = t === 'IN' ? 'good' : t === 'OUT' ? 'info' : t === 'EXP' ? 'bad' : 'warn';
    return '<span class="chip chip-' + k + '">' + UI.TYPE_LABEL[t] + '</span>';
  }

  function init() {
    form().elements.date.value = UI.today();
    form().addEventListener('submit', submit);
    form().elements.itemId.addEventListener('change', function () {
      showBalance(); prefill();
    });
    form().addEventListener('reset', function () {
      setTimeout(function () {
        form().elements.date.value = UI.today();
        UI.$('#txnBalanceHint').textContent = '';
      }, 0);
    });

    UI.$('#txnFilterTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      UI.$$('.tab', UI.$('#txnFilterTabs')).forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      state.type = b.dataset.t;
      render();
    });

    UI.$('#txnSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });

    UI.$('#txnTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      var tx = Store.txns().filter(function (t) { return t.id === b.dataset.del; })[0];
      if (tx && tx.rxId) {
        alert('This issue belongs to prescription ' + (tx.ref || '') +
          '.\n\nOpen the Prescriptions screen and edit or delete the prescription there, ' +
          'so the patient record and the stock stay in step.');
        return;
      }
      if (tx && tx.boxEntryId) {
        alert('This movement belongs to first aid box entry ' + (tx.ref || '') +
          '.\n\nOpen the First Aid Boxes screen and edit or delete the entry there, ' +
          'so the box contents and the stock stay in step.');
        return;
      }
      if (!confirm('Delete this entry? The stock balance will be recalculated.')) return;
      Store.deleteTxn(b.dataset.del);
      render();
      App.refresh();
      UI.toast('Entry deleted', 'warn');
    });
  }

  global.Txns = { init: init, render: render, refreshSelect: refreshSelect };

})(window);
