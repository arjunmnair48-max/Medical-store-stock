/* ============================================================
   items.js — Item Master screen
   ============================================================ */
(function (global) {
  'use strict';

  var state = { cat: 'all', q: '' };

  function modal() { return UI.$('#itemModal'); }
  function form() { return UI.$('#itemForm'); }

  /* --------- show/hide the category-specific fields --------- */
  function applyCategoryFields() {
    var cat = UI.$('#itemCategory').value;
    UI.$$('.cat-med, .cat-dis, .cat-ast', form()).forEach(function (el) {
      el.classList.add('hidden');
    });
    var cls = cat === 'medicine' ? '.cat-med' : cat === 'disposable' ? '.cat-dis' : '.cat-ast';
    UI.$$(cls, form()).forEach(function (el) { el.classList.remove('hidden'); });
  }

  function openModal(id) {
    var f = form();
    f.reset();
    UI.$('#btnDeleteItem').classList.toggle('hidden', !id);

    if (id) {
      var it = Store.item(id);
      UI.$('#itemModalTitle').textContent = 'Edit Item';
      UI.fillForm(f, it);
    } else {
      UI.$('#itemModalTitle').textContent = 'Add Item';
      f.elements.id.value = '';
      f.elements.openingMonth.value = Store.currentMonth();
      f.elements.category.value = state.cat === 'all' ? 'medicine' : state.cat;
    }
    applyCategoryFields();
    modal().classList.remove('hidden');
    setTimeout(function () { f.elements.name.focus(); }, 30);
  }

  function closeModal() { modal().classList.add('hidden'); }

  function submit(e) {
    e.preventDefault();
    var o = UI.formToObject(form());
    if (!o.name) return;
    if (!o.id) delete o.id;
    o.openingStock = o.openingStock === '' ? 0 : Number(o.openingStock);
    o.minLevel = o.minLevel === '' ? 0 : Number(o.minLevel);
    if (!o.openingMonth) o.openingMonth = Store.currentMonth();
    Store.saveItem(o);
    closeModal();
    render();
    App.refresh();
    UI.toast('Item saved');
  }

  function removeItem() {
    var id = form().elements.id.value;
    var it = Store.item(id);
    if (!it) return;
    var n = Store.txns({ itemId: id }).length;
    var msg = 'Delete "' + it.name + '"?';
    if (n) msg += '\n\nThis also deletes ' + n + ' stock entr' + (n === 1 ? 'y' : 'ies') +
      ' and its monthly closings. This cannot be undone.';
    if (!confirm(msg)) return;
    Store.deleteItem(id);
    closeModal();
    render();
    App.refresh();
    UI.toast('Item deleted', 'warn');
  }

  /* ---------------------- table ---------------------- */

  function matches(it) {
    if (!state.q) return true;
    var hay = [it.name, it.code, it.spec, it.batchNo, it.location, it.manufacturer,
      it.assetTag, it.serialNo, it.supplier].join(' ').toLowerCase();
    return hay.indexOf(state.q) !== -1;
  }

  function render() {
    var list = Store.items(state.cat).filter(matches);
    var t = UI.$('#itemTable');

    if (!list.length) {
      t.innerHTML = '<tbody><tr><td class="empty">No items yet. Click <b>+ Add Item</b> to start ' +
        'building the stock register.</td></tr></tbody>';
      return;
    }

    var isAsset = state.cat === 'asset';
    var head = isAsset
      ? ['#', 'Asset tag', 'Item', 'Serial / Model', 'Purchased', 'Cost', 'Qty', 'Condition', 'Location', '']
      : ['#', 'Item', 'Category', 'Unit', 'Batch', 'Expiry', 'In hand', 'Min', 'Rack', ''];

    var html = '<thead><tr>' + head.map(function (h) {
      return '<th>' + h + '</th>';
    }).join('') + '</tr></thead><tbody>';

    list.forEach(function (it, idx) {
      var bal = Store.balance(it.id);
      var low = it.category !== 'asset' && Number(it.minLevel) > 0 && bal <= Number(it.minLevel);

      if (isAsset) {
        html += '<tr data-id="' + UI.esc(it.id) + '">' +
          '<td class="dim">' + (idx + 1) + '</td>' +
          '<td>' + UI.esc(it.assetTag || '—') + '</td>' +
          '<td class="strong">' + UI.esc(it.name) + (it.spec ? ' <span class="dim">' + UI.esc(it.spec) + '</span>' : '') + '</td>' +
          '<td>' + UI.esc(it.serialNo || '—') + '</td>' +
          '<td>' + UI.dmy(it.purchaseDate) + '</td>' +
          '<td>' + UI.money(it.purchaseCost) + '</td>' +
          '<td class="num">' + UI.num(bal) + '</td>' +
          '<td>' + condChip(it.condition) + '</td>' +
          '<td>' + UI.esc(it.location || '—') + '</td>' +
          '<td class="row-act"><button class="link" data-edit="' + UI.esc(it.id) + '">Edit</button></td>' +
          '</tr>';
      } else {
        html += '<tr data-id="' + UI.esc(it.id) + '">' +
          '<td class="dim">' + (idx + 1) + '</td>' +
          '<td class="strong">' + UI.esc(it.name) +
          (it.spec ? ' <span class="dim">' + UI.esc(it.spec) + '</span>' : '') + '</td>' +
          '<td>' + catChip(it.category) + '</td>' +
          '<td>' + UI.esc(it.unit || '') + '</td>' +
          '<td>' + UI.esc(it.batchNo || '—') + '</td>' +
          '<td>' + expiryCell(it) + '</td>' +
          '<td class="num' + (low ? ' bad' : '') + '">' + UI.num(bal) + '</td>' +
          '<td class="num dim">' + UI.num(it.minLevel || 0) + '</td>' +
          '<td>' + UI.esc(it.location || '—') + '</td>' +
          '<td class="row-act"><button class="link" data-edit="' + UI.esc(it.id) + '">Edit</button></td>' +
          '</tr>';
      }
    });

    t.innerHTML = html + '</tbody>';
  }

  function catChip(c) {
    return '<span class="chip chip-' + c + '">' + UI.CAT_LABEL[c] + '</span>';
  }

  function condChip(c) {
    var k = c === 'Condemned' ? 'bad' : c === 'Under repair' ? 'warn' : 'good';
    return '<span class="chip chip-' + k + '">' + UI.esc(c || 'Working') + '</span>';
  }

  function expiryCell(it) {
    if (!it.expiry) return '<span class="dim">—</span>';
    var y = +it.expiry.slice(0, 4), mo = +it.expiry.slice(5, 7);
    var exp = new Date(y, mo, 0);
    var days = Math.ceil((exp - new Date()) / 86400000);
    var alert = Number(Store.settings().expiryDays) || 90;
    var cls = days < 0 ? 'bad' : days <= alert ? 'warn' : '';
    return '<span class="' + cls + '">' + UI.dmy(it.expiry) + '</span>';
  }

  /* ---------------------- wiring ---------------------- */

  function init() {
    UI.$('#btnNewItem').addEventListener('click', function () { openModal(null); });
    UI.$('#itemModalClose').addEventListener('click', closeModal);
    UI.$('#itemCancel').addEventListener('click', closeModal);
    UI.$('#btnDeleteItem').addEventListener('click', removeItem);
    form().addEventListener('submit', submit);
    UI.$('#itemCategory').addEventListener('change', applyCategoryFields);

    modal().addEventListener('click', function (e) {
      if (e.target === modal()) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal().classList.contains('hidden')) closeModal();
    });

    UI.$('#itemTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      UI.$$('.tab', UI.$('#itemTabs')).forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      state.cat = b.dataset.cat;
      render();
    });

    UI.$('#itemSearch').addEventListener('input', function (e) {
      state.q = e.target.value.trim().toLowerCase();
      render();
    });

    UI.$('#itemTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-edit]');
      if (b) { openModal(b.dataset.edit); return; }
      var tr = e.target.closest('tr[data-id]');
      if (tr) openModal(tr.dataset.id);
    });
  }

  global.Items = { init: init, render: render, open: openModal };

})(window);
