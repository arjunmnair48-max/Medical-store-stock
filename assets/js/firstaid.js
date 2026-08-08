/* ============================================================
   firstaid.js — first aid box register

   A box is a small store of its own. Filling one takes the items off
   the main stock; using or discarding from a box touches only the box,
   because the main stock already gave those items up when it was filled.
   ============================================================ */
(function (global) {
  'use strict';

  var state = { boxId: null, editing: null, month: '' };

  function form() { return UI.$('#fabForm'); }
  function lineBox() { return UI.$('#fabLines'); }

  function currentBox() {
    var list = Store.boxes();
    if (!list.length) return null;
    if (!state.boxId || !Store.box(state.boxId)) state.boxId = list[0].id;
    return Store.box(state.boxId);
  }

  /* ---------------- box tabs ---------------- */

  function renderTabs() {
    var list = Store.boxes();
    var box = currentBox();
    UI.$('#fabTabs').innerHTML = list.map(function (b) {
      var a = Store.boxAlerts().filter(function (x) { return x.box.id === b.id; })[0] || {};
      var flag = a.expired ? ' <span class="dot bad" title="holds an expired item"></span>'
        : a.shortOf ? ' <span class="dot warn" title="short of scale"></span>' : '';
      return '<button class="tab' + (box && b.id === box.id ? ' active' : '') +
        '" data-box="' + UI.esc(b.id) + '">' + UI.esc(b.name) + flag + '</button>';
    }).join('') || '<span class="dim">No boxes yet — add one.</span>';
  }

  /* ---------------- contents of the selected box ---------------- */

  function renderContents() {
    var box = currentBox();
    var t = UI.$('#fabTable');
    if (!box) {
      t.innerHTML = '<tbody><tr><td class="empty">Add a first aid box to begin.</td></tr></tbody>';
      UI.$('#fabBoxTitle').textContent = '';
      return;
    }

    UI.$('#fabBoxTitle').textContent = box.name +
      (box.location ? ' — ' + box.location : '') +
      (box.incharge ? ' · in charge: ' + box.incharge : '');

    var rows = Store.boxItems(box.id);
    if (!rows.length) {
      t.innerHTML = '<tbody><tr><td class="empty">This box is empty. Use ' +
        '<b>Filled from store</b> below to put items into it.</td></tr></tbody>';
      return;
    }

    var today = new Date();
    var alertDays = Number(Store.settings().expiryDays) || 90;

    var html = '<thead><tr>' +
      ['Item', 'Unit', 'Required', 'In box', 'Short by', 'Batch', 'Expiry', 'In main stock']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var short = r.required > 0 ? Math.max(0, r.required - r.inBox) : 0;
      var expCls = '', expTxt = '<span class="dim">—</span>';
      if (r.item.expiry) {
        var y = +r.item.expiry.slice(0, 4), mo = +r.item.expiry.slice(5, 7);
        var exp = new Date(y, mo, 0);
        var days = Math.ceil((exp - today) / 86400000);
        expCls = days < 0 ? 'bad' : days <= alertDays ? 'warn' : '';
        expTxt = '<span class="' + expCls + '">' + UI.dmy(r.item.expiry) +
          (days < 0 ? ' — EXPIRED' : '') + '</span>';
      }

      html += '<tr>' +
        '<td class="strong">' + UI.esc(r.item.name) +
        (r.item.spec ? ' <span class="dim">' + UI.esc(r.item.spec) + '</span>' : '') + '</td>' +
        '<td>' + UI.esc(r.item.unit || '') + '</td>' +
        '<td class="num"><input class="cell-input" type="number" step="any" min="0" ' +
        'data-scale="' + UI.esc(r.item.id) + '" value="' + (r.required || '') +
        '" placeholder="—" title="How many this box should carry" /></td>' +
        '<td class="num strong ' + (r.inBox <= 0 ? 'bad' : '') + '">' + UI.num(r.inBox) + '</td>' +
        '<td class="num ' + (short > 0 ? 'bad' : 'good') + '">' + (short > 0 ? UI.num(short) : '—') + '</td>' +
        '<td>' + UI.esc(r.item.batchNo || '—') + '</td>' +
        '<td class="nowrap">' + expTxt + '</td>' +
        '<td class="num dim">' + UI.num(Store.balance(r.item.id)) + '</td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
  }

  /* ---------------- entry lines ---------------- */

  function lineRow(line) {
    line = line || {};
    var wrap = document.createElement('div');
    wrap.className = 'rx-line';
    wrap.innerHTML =
      '<select class="rx-item"></select>' +
      '<input class="rx-qty" type="number" step="any" min="0" placeholder="Qty" value="' +
      UI.esc(line.qty === undefined ? '' : line.qty) + '" />' +
      '<input class="rx-dose" type="text" placeholder="Remarks" value="' +
      UI.esc(line.remarks || '') + '" />' +
      '<span class="rx-stock dim"></span>' +
      '<button type="button" class="icon-btn rx-del" title="Remove this line">✕</button>';

    var sel = wrap.querySelector('.rx-item');
    UI.itemOptions(sel, 'consumable', line.itemId || '');
    sel.addEventListener('change', function () { showAvailable(wrap); });
    wrap.querySelector('.rx-qty').addEventListener('input', function () { showAvailable(wrap); });
    wrap.querySelector('.rx-del').addEventListener('click', function () {
      wrap.remove();
      if (!lineBox().children.length) addLine();
    });

    lineBox().appendChild(wrap);
    showAvailable(wrap);
    return wrap;
  }

  function addLine(line) { return lineRow(line); }

  /**
   * Filling draws on the main stock, everything else draws on the box, so
   * the figure shown beside a line has to follow whichever it is. An entry
   * being edited has its own effect added back first, so it is not counted
   * against itself.
   */
  function showAvailable(wrap) {
    var id = wrap.querySelector('.rx-item').value;
    var el = wrap.querySelector('.rx-stock');
    if (!id) { el.textContent = ''; el.className = 'rx-stock dim'; return; }

    var type = form().elements.type.value;
    var it = Store.item(id);
    var fromMain = (type === 'FILL');
    var have = (fromMain ? Store.balance(id) : Store.boxBalance(state.boxId, id)) + alreadyMoved(id, fromMain);
    var want = Number(wrap.querySelector('.rx-qty').value) || 0;

    el.textContent = UI.num(have) + ' ' + (it.unit || '') + (fromMain ? ' in store' : ' in box');
    el.className = 'rx-stock ' + (want > have ? 'bad' : 'dim');
  }

  /** What the entry being edited already took out of that same pool. */
  function alreadyMoved(itemId, fromMain) {
    if (!state.editing) return 0;
    var e = Store.boxEntry(state.editing);
    if (!e) return 0;
    var drawsOnMain = (e.type === 'FILL');
    // a RETURN put stock back, so re-editing it must not look like free stock
    if (fromMain && !drawsOnMain) return 0;
    if (!fromMain && drawsOnMain) return 0;
    return (e.lines || []).reduce(function (s, l) {
      return l.itemId === itemId ? s + (Math.abs(Number(l.qty)) || 0) : s;
    }, 0);
  }

  function readLines() {
    return UI.$$('.rx-line', lineBox()).map(function (w) {
      return {
        itemId: w.querySelector('.rx-item').value,
        qty: w.querySelector('.rx-qty').value,
        remarks: w.querySelector('.rx-dose').value.trim()
      };
    }).filter(function (l) { return l.itemId && Number(l.qty) > 0; });
  }

  /* ---------------- entry form ---------------- */

  function reset() {
    state.editing = null;
    form().reset();
    lineBox().innerHTML = '';
    addLine();
    form().elements.date.value = UI.today();
    form().elements.type.value = 'FILL';
    form().elements.no.value = Store.nextBoxNo(UI.today());
    UI.$('#fabFormTitle').textContent = 'New Entry';
    UI.$('#fabSaveBtn').textContent = 'Save Entry';
    UI.$('#fabCancelEdit').classList.add('hidden');
    hint();
  }

  function hint() {
    var t = form().elements.type.value;
    var msg = {
      FILL: 'The items will be taken off the main stock and put into this box.',
      USE: 'The items leave the box only. The main stock is not touched — it already gave them up when the box was filled.',
      RETURN: 'The items leave the box and go back onto the main stock.',
      DISCARD: 'The items leave the box and are written off. The main stock is not touched.'
    }[t] || '';
    UI.$('#fabTypeHint').textContent = msg;
  }

  function refreshNumberIfPristine() {
    if (state.editing) return;
    var f = form();
    if (readLines().length) return;
    if (!f.elements.date.value) f.elements.date.value = UI.today();
    f.elements.no.value = Store.nextBoxNo(f.elements.date.value);
  }

  function edit(id) {
    var e = Store.boxEntry(id);
    if (!e) return;
    state.editing = id;
    state.boxId = e.boxId;
    UI.fillForm(form(), e);
    form().elements.id.value = e.id;
    lineBox().innerHTML = '';
    (e.lines && e.lines.length ? e.lines : [{}]).forEach(addLine);
    UI.$('#fabFormTitle').textContent = 'Edit Entry ' + (e.no || '');
    UI.$('#fabSaveBtn').textContent = 'Update Entry';
    UI.$('#fabCancelEdit').classList.remove('hidden');
    hint();
    renderTabs();
    renderContents();
    UI.$('#fabFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function submit(ev) {
    ev.preventDefault();
    var box = currentBox();
    if (!box) { UI.toast('Add a first aid box first', 'warn'); return; }

    var o = UI.formToObject(form());
    o.boxId = state.editing ? o.boxId : box.id;
    o.lines = readLines();
    if (!o.lines.length) { UI.toast('Add at least one item', 'warn'); return; }
    if (!state.editing) delete o.id;

    var clash = Store.boxEntries().some(function (e) {
      return e.no && e.no === o.no && e.id !== (state.editing || '');
    });
    var renumbered = null;
    if (clash) { o.no = Store.nextBoxNo(o.date); renumbered = o.no; }

    // check whichever pool this entry draws on
    var fromMain = (o.type === 'FILL');
    var wanted = {};
    o.lines.forEach(function (l) {
      wanted[l.itemId] = (wanted[l.itemId] || 0) + Math.abs(Number(l.qty) || 0);
    });
    var short = [];
    Object.keys(wanted).forEach(function (id) {
      var have = (fromMain ? Store.balance(id) : Store.boxBalance(o.boxId, id)) +
        alreadyMoved(id, fromMain);
      if (wanted[id] > have) {
        var it = Store.item(id);
        short.push('• ' + it.name + ' — asked ' + UI.num(wanted[id]) + ', available ' +
          UI.num(have) + ' ' + (it.unit || '') + (fromMain ? ' in store' : ' in box'));
      }
    });
    if (short.length) {
      if (!confirm('There is not enough for:\n\n' + short.join('\n') +
        '\n\nSaving will make the balance negative. Continue?')) return;
    }

    var saved = Store.saveBoxEntry(o);
    var n = saved.lines.length;
    var target = Store.box(saved.boxId);
    reset();
    render();
    App.refresh();

    if (renumbered) {
      UI.toast('That number was already used — saved as ' + renumbered, 'warn');
    } else {
      UI.toast(n + ' item' + (n === 1 ? '' : 's') + ' ' +
        (saved.type === 'FILL' ? 'moved from store into ' + target.name
          : saved.type === 'RETURN' ? 'returned from ' + target.name + ' to store'
            : saved.type === 'USE' ? 'used from ' + target.name
              : 'written off from ' + target.name));
    }
  }

  function remove(id) {
    var e = Store.boxEntry(id);
    if (!e) return;
    var note = (e.type === 'FILL')
      ? '\n\nThe items will go back onto the main stock.'
      : (e.type === 'RETURN') ? '\n\nThe items will come off the main stock again.' : '';
    if (!confirm('Delete entry ' + (e.no || '') + '?' + note)) return;
    Store.deleteBoxEntry(id);
    if (state.editing === id) reset();
    render();
    App.refresh();
    UI.toast('Entry deleted', 'warn');
  }

  /* ---------------- movement list ---------------- */

  function renderEntries() {
    var list = Store.boxEntries({ boxId: state.boxId, month: state.month || undefined });
    var t = UI.$('#fabEntryTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No entries for this box yet.</td></tr></tbody>';
      return;
    }

    var html = '<thead><tr>' +
      ['Date', 'Entry No.', 'What happened', 'Items', 'By', 'Remarks', '']
        .map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    list.slice(0, 300).forEach(function (e) {
      var items = (e.lines || []).map(function (l) {
        var it = Store.item(l.itemId);
        return UI.esc(it ? it.name : '(deleted item)') + ' <b>×' + UI.num(l.qty) + '</b>';
      }).join('<br>') || '<span class="dim">—</span>';

      var k = e.type === 'FILL' ? 'good' : e.type === 'RETURN' ? 'info'
        : e.type === 'DISCARD' ? 'bad' : 'warn';

      html += '<tr' + (state.editing === e.id ? ' class="row-editing"' : '') + '>' +
        '<td class="nowrap">' + UI.dmy(e.date) + '</td>' +
        '<td class="strong nowrap">' + UI.esc(e.no || '—') + '</td>' +
        '<td><span class="chip chip-' + k + '">' + UI.esc(Store.BOX_TYPES[e.type] || e.type) + '</span></td>' +
        '<td>' + items + '</td>' +
        '<td>' + UI.esc(e.by || '—') + '</td>' +
        '<td class="dim">' + UI.esc(e.remarks || '') + '</td>' +
        '<td class="row-act nowrap">' +
        '<button class="link" data-edit="' + UI.esc(e.id) + '">Edit</button> ' +
        '<button class="link danger" data-del="' + UI.esc(e.id) + '">Delete</button></td>' +
        '</tr>';
    });

    t.innerHTML = html + '</tbody>';
  }

  /* ---------------- box details modal ---------------- */

  function openBoxModal(id) {
    var f = UI.$('#boxForm');
    f.reset();
    UI.$('#btnDeleteBox').classList.toggle('hidden', !id);
    if (id) {
      UI.fillForm(f, Store.box(id));
      UI.$('#boxModalTitle').textContent = 'Edit Box';
    } else {
      f.elements.id.value = '';
      UI.$('#boxModalTitle').textContent = 'Add First Aid Box';
    }
    UI.$('#boxModal').classList.remove('hidden');
    setTimeout(function () { f.elements.name.focus(); }, 30);
  }

  function closeBoxModal() { UI.$('#boxModal').classList.add('hidden'); }

  function submitBox(e) {
    e.preventDefault();
    var o = UI.formToObject(UI.$('#boxForm'));
    if (!o.name) return;
    if (!o.id) delete o.id;
    var saved = Store.saveBox(o);
    state.boxId = saved.id;
    closeBoxModal();
    render();
    App.refresh();
    UI.toast('Box saved');
  }

  function removeBox() {
    var id = UI.$('#boxForm').elements.id.value;
    var b = Store.box(id);
    if (!b) return;
    if (!confirm('Delete "' + b.name + '"?')) return;
    var res = Store.deleteBox(id);
    if (!res.ok) {
      alert('"' + b.name + '" still has entries against it, so it cannot be deleted — ' +
        'its history would be lost and the stock it drew would be left unaccounted.\n\n' +
        'Return or write off what it holds first, or simply rename the box instead.');
      return;
    }
    state.boxId = null;
    closeBoxModal();
    render();
    App.refresh();
    UI.toast('Box deleted', 'warn');
  }

  /* ---------------- wiring ---------------- */

  function render() {
    renderTabs();
    renderContents();
    renderEntries();
    refreshNumberIfPristine();
    // the item master may have changed since these lines were built
    UI.$$('.rx-line', lineBox()).forEach(function (w) {
      var sel = w.querySelector('.rx-item');
      UI.itemOptions(sel, 'consumable', sel.value);
      showAvailable(w);
    });
  }

  function init() {
    reset();
    form().addEventListener('submit', submit);
    form().elements.type.addEventListener('change', function () {
      hint();
      UI.$$('.rx-line', lineBox()).forEach(showAvailable);
    });
    form().elements.date.addEventListener('change', refreshNumberIfPristine);
    UI.$('#fabAddLine').addEventListener('click', function () { addLine(); });
    UI.$('#fabCancelEdit').addEventListener('click', function () { reset(); render(); });

    UI.$('#fabTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-box]');
      if (!b) return;
      state.boxId = b.dataset.box;
      if (state.editing) reset();
      render();
    });

    UI.$('#fabAddBox').addEventListener('click', function () { openBoxModal(null); });
    UI.$('#fabEditBox').addEventListener('click', function () {
      if (currentBox()) openBoxModal(currentBox().id);
    });
    UI.$('#boxForm').addEventListener('submit', submitBox);
    UI.$('#boxModalClose').addEventListener('click', closeBoxModal);
    UI.$('#boxCancel').addEventListener('click', closeBoxModal);
    UI.$('#btnDeleteBox').addEventListener('click', removeBox);
    UI.$('#boxModal').addEventListener('click', function (e) {
      if (e.target === UI.$('#boxModal')) closeBoxModal();
    });

    UI.$('#fabMonth').addEventListener('change', function (e) {
      state.month = e.target.value;
      renderEntries();
    });

    // the required quantity is edited straight in the contents table
    UI.$('#fabTable').addEventListener('change', function (e) {
      var el = e.target.closest('[data-scale]');
      if (!el) return;
      Store.setBoxScale(state.boxId, el.dataset.scale, el.value);
      renderContents();
      renderTabs();
      App.refresh();
    });

    UI.$('#fabEntryTable').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      if (ed) { edit(ed.dataset.edit); return; }
      var dl = e.target.closest('[data-del]');
      if (dl) remove(dl.dataset.del);
    });
  }

  global.FirstAid = { init: init, render: render, reset: reset };

})(window);
