/* ============================================================
   ui.js — small shared helpers
   ============================================================ */
(function (global) {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** number for display: drops trailing .00 but keeps real decimals */
  function num(v) {
    var n = Number(v);
    if (!isFinite(n)) return '0';
    return (Math.round(n * 100) / 100).toString();
  }

  function money(v) {
    var n = Number(v);
    if (!isFinite(n) || v === '' || v === null || v === undefined) return '';
    return (Store.settings().currency || '₹') +
      n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  /** '2026-08-14' -> '14-08-2026' ; '2026-08' -> '08/2026' */
  function dmy(s) {
    if (!s) return '';
    var p = s.split('-');
    if (p.length === 3) return p[2] + '-' + p[1] + '-' + p[0];
    if (p.length === 2) return p[1] + '/' + p[0];
    return s;
  }

  var CAT_LABEL = { medicine: 'Medicine', disposable: 'Disposable', asset: 'Permanent Asset' };
  var TYPE_LABEL = { IN: 'Receipt', OUT: 'Issue', EXP: 'Expiry / Damage', ADJ: 'Adjustment' };

  function itemLabel(it) {
    if (!it) return '(deleted item)';
    var s = it.name;
    if (it.spec) s += ' — ' + it.spec;
    if (it.code) s += ' [' + it.code + ']';
    return s;
  }

  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'toast ' + (kind || 'ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast hidden'; }, 2600);
  }

  function formToObject(form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      o[el.name] = el.value.trim ? el.value.trim() : el.value;
    });
    return o;
  }

  function fillForm(form, obj) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      var v = obj[el.name];
      el.value = (v === undefined || v === null) ? '' : v;
    });
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = (c === null || c === undefined) ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  /**
   * Builds an option list of items for a <select>.
   * `category` may also be 'consumable', meaning everything that is issued
   * to patients — medicines and disposables, but not permanent assets.
   */
  function itemOptions(select, category, selectedId) {
    var list;
    if (category === 'consumable') {
      list = Store.items().filter(function (i) { return i.category !== 'asset'; });
    } else {
      list = Store.items(category || 'all');
    }
    var html = '<option value="">— select —</option>';
    ['medicine', 'disposable', 'asset'].forEach(function (cat) {
      var sub = list.filter(function (i) { return i.category === cat; });
      if (!sub.length) return;
      html += '<optgroup label="' + CAT_LABEL[cat] + '">';
      sub.forEach(function (i) {
        html += '<option value="' + esc(i.id) + '"' +
          (i.id === selectedId ? ' selected' : '') + '>' + esc(itemLabel(i)) + '</option>';
      });
      html += '</optgroup>';
    });
    select.innerHTML = html;
  }

  global.UI = {
    $: $, $$: $$, esc: esc, num: num, money: money, today: today, dmy: dmy,
    CAT_LABEL: CAT_LABEL, TYPE_LABEL: TYPE_LABEL,
    itemLabel: itemLabel, toast: toast,
    formToObject: formToObject, fillForm: fillForm,
    download: download, toCsv: toCsv, itemOptions: itemOptions
  };

})(window);
