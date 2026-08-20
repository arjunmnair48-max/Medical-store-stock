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
   * Reads a CSV file into rows of cells.
   *
   * Handles the quoting a spreadsheet produces — commas and line breaks
   * inside a quoted cell, and "" for a quote character — because the
   * hospital list is usually saved straight out of Excel.
   */
  function parseCsv(text) {
    var rows = [], row = [], cell = '', quoted = false;
    var s = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (quoted) {
        if (c === '"') {
          if (s[i + 1] === '"') { cell += '"'; i++; }
          else quoted = false;
        } else cell += c;
        continue;
      }
      if (c === '"') { quoted = true; }
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\r') { /* the \n that follows ends the row */ }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (x) { return String(x).trim() !== ''; });
    });
  }

  global.UI = {
    $: $, $$: $$, esc: esc, num: num, money: money, today: today, dmy: dmy,
    toast: toast, formToObject: formToObject, fillForm: fillForm,
    download: download, toCsv: toCsv, parseCsv: parseCsv
  };

})(window);
