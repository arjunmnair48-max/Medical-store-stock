/* ============================================================
   store.js — data layer (localStorage)
   Medical Centre Stock Register
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'mcstock.v1';

  var DEFAULTS = {
    version: 1,
    settings: {
      centreName: 'Medical Centre',
      address: '',
      storeKeeper: '',
      officer: '',
      expiryDays: 90,
      currency: '₹'
    },
    items: [],
    txns: [],
    closings: [],   // { id, month:'YYYY-MM', itemId, opening, receipts, issues, writeOff, adjust, book, physical, remarks, closedAt }
    maint: [],      // { id, itemId, date, type, doneBy, cost, nextDue, remarks }
    rx: [],         // prescriptions — { id, no, date, patient, age, sex, problem, doctor, remarks, lines:[{itemId, qty, dose}] }
    referrals: []   // { id, no, date, patient, age, sex, hospital, referredTo, reason, escort, relation, mode, remarks }
  };

  var db = null;

  /* ------------------------------------------------------------
     Storage adapter.

     In the desktop build the register is a real file on disk, handed
     over by the preload bridge. In a plain browser it falls back to
     the browser's own storage. Everything below is unaware of which.
     ------------------------------------------------------------ */
  var backend = (global.desktop && global.desktop.isDesktop)
    ? {
      name: 'file',
      read: function () { return global.desktop.load(); },
      write: function (json) {
        var r = global.desktop.save(json);
        if (r && r.ok === false) throw new Error(r.error || 'could not write the register file');
      }
    }
    : {
      name: 'browser',
      read: function () { return global.localStorage.getItem(KEY); },
      write: function (json) { global.localStorage.setItem(KEY, json); }
    };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function load() {
    if (db) return db;
    try {
      var raw = backend.read();
      db = raw ? JSON.parse(raw) : clone(DEFAULTS);
    } catch (e) {
      db = clone(DEFAULTS);
    }
    // fill in anything a older/partial backup is missing
    var d = clone(DEFAULTS);
    Object.keys(d).forEach(function (k) {
      if (db[k] === undefined) db[k] = d[k];
    });
    Object.keys(d.settings).forEach(function (k) {
      if (db.settings[k] === undefined) db.settings[k] = d.settings[k];
    });
    return db;
  }

  function save() {
    try {
      backend.write(JSON.stringify(load()));
      return true;
    } catch (e) {
      global.alert(backend.name === 'file'
        ? 'Could not save the register file.\n\n' + e.message
        : 'Could not save — browser storage is full or blocked.\n\n' + e.message);
      return false;
    }
  }

  function replaceAll(data) {
    db = data;
    return save();
  }

  /* ---------------- month helpers ---------------- */

  function toMonth(dateStr) {          // '2026-08-14' -> '2026-08'
    return (dateStr || '').slice(0, 7);
  }

  function currentMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function prevMonth(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1;
    if (mo === 0) { y -= 1; mo = 12; }
    return y + '-' + String(mo).padStart(2, '0');
  }

  function nextMonth(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1;
    if (mo === 13) { y += 1; mo = 1; }
    return y + '-' + String(mo).padStart(2, '0');
  }

  function monthName(m) {
    if (!m) return '';
    var names = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return names[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  }

  function monthEndDate(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7);
    return new Date(y, mo, 0).getDate();          // last day number
  }

  /* ---------------- items ---------------- */

  function items(category) {
    var list = load().items;
    if (category && category !== 'all') list = list.filter(function (i) { return i.category === category; });
    return list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function item(id) {
    return load().items.filter(function (i) { return i.id === id; })[0] || null;
  }

  function saveItem(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.items.length; i++) {
        if (d.items[i].id === obj.id) { d.items[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.items.push(obj);
    }
    save();
    return obj;
  }

  function deleteItem(id) {
    var d = load();
    d.items = d.items.filter(function (i) { return i.id !== id; });
    d.txns = d.txns.filter(function (t) { return t.itemId !== id; });
    d.closings = d.closings.filter(function (c) { return c.itemId !== id; });
    d.maint = d.maint.filter(function (m) { return m.itemId !== id; });
    // drop the item from any prescription that had prescribed it, so no
    // prescription is left pointing at something that no longer exists
    d.rx.forEach(function (r) {
      r.lines = (r.lines || []).filter(function (l) { return l.itemId !== id; });
    });
    save();
  }

  /* ---------------- transactions ---------------- */

  function txns(filter) {
    var list = load().txns.slice();
    if (filter && filter.itemId) list = list.filter(function (t) { return t.itemId === filter.itemId; });
    if (filter && filter.type && filter.type !== 'all') list = list.filter(function (t) { return t.type === filter.type; });
    if (filter && filter.month) list = list.filter(function (t) { return toMonth(t.date) === filter.month; });
    return list.sort(function (a, b) {
      if (a.date === b.date) return (b.createdAt || '').localeCompare(a.createdAt || '');
      return b.date.localeCompare(a.date);
    });
  }

  function saveTxn(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.txns.length; i++) {
        if (d.txns[i].id === obj.id) { d.txns[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.txns.push(obj);
    }
    save();
    return obj;
  }

  function deleteTxn(id) {
    var d = load();
    d.txns = d.txns.filter(function (t) { return t.id !== id; });
    save();
  }

  /* signed quantity of a transaction */
  function signed(t) {
    var q = Number(t.qty) || 0;
    if (t.type === 'IN') return Math.abs(q);
    if (t.type === 'OUT' || t.type === 'EXP') return -Math.abs(q);
    return q;                                   // ADJ keeps its sign
  }

  /* ---------------- balances ---------------- */

  /** Latest saved closing for an item strictly before `month`. */
  function lastClosingBefore(itemId, month) {
    var list = load().closings.filter(function (c) {
      return c.itemId === itemId && c.month < month &&
        c.physical !== null && c.physical !== undefined && c.physical !== '' &&
        isFinite(Number(c.physical));
    }).sort(function (a, b) { return a.month.localeCompare(b.month); });
    return list.length ? list[list.length - 1] : null;
  }

  function closingOf(itemId, month) {
    return load().closings.filter(function (c) {
      return c.itemId === itemId && c.month === month;
    })[0] || null;
  }

  /**
   * Movement summary of one item for one month, anchored to the last
   * physically verified closing so corrections never propagate wrongly.
   */
  function monthSummary(itemId, month) {
    var it = item(itemId) || {};
    var last = lastClosingBefore(itemId, month);
    var opening, from;

    if (last) {
      opening = Number(last.physical) || 0;
      from = nextMonth(last.month);
    } else {
      opening = Number(it.openingStock) || 0;
      from = it.openingMonth || '0000-00';
    }

    // roll opening forward through any months between `from` and `month`
    var all = load().txns.filter(function (t) { return t.itemId === itemId; });
    all.forEach(function (t) {
      var m = toMonth(t.date);
      if (m >= from && m < month) opening += signed(t);
    });

    var receipts = 0, issues = 0, writeOff = 0, adjust = 0;
    all.forEach(function (t) {
      if (toMonth(t.date) !== month) return;
      var q = Number(t.qty) || 0;
      if (t.type === 'IN') receipts += Math.abs(q);
      else if (t.type === 'OUT') issues += Math.abs(q);
      else if (t.type === 'EXP') writeOff += Math.abs(q);
      else adjust += q;
    });

    var book = opening + receipts - issues - writeOff + adjust;
    var saved = closingOf(itemId, month);

    return {
      itemId: itemId,
      month: month,
      opening: opening,
      receipts: receipts,
      issues: issues,
      writeOff: writeOff,
      adjust: adjust,
      book: book,
      physical: saved ? Number(saved.physical) : null,
      remarks: saved ? (saved.remarks || '') : '',
      closed: !!saved
    };
  }

  /** Stock in hand right now (all transactions, no month cut-off). */
  function balance(itemId) {
    var it = item(itemId);
    if (!it) return 0;
    var last = lastClosingBefore(itemId, nextMonth(currentMonth()));
    var base, from;
    if (last) { base = Number(last.physical) || 0; from = nextMonth(last.month); }
    else { base = Number(it.openingStock) || 0; from = it.openingMonth || '0000-00'; }

    load().txns.forEach(function (t) {
      if (t.itemId !== itemId) return;
      if (toMonth(t.date) >= from) base += signed(t);
    });
    return base;
  }

  function saveClosing(rec) {
    var d = load();
    var existing = d.closings.filter(function (c) {
      return c.itemId === rec.itemId && c.month === rec.month;
    })[0];
    if (existing) {
      Object.keys(rec).forEach(function (k) { existing[k] = rec[k]; });
      existing.closedAt = new Date().toISOString();
    } else {
      rec.id = uid();
      rec.closedAt = new Date().toISOString();
      d.closings.push(rec);
    }
    return rec;
  }

  function isMonthClosed(month) {
    return load().closings.some(function (c) { return c.month === month; });
  }

  /* ---------------- maintenance ---------------- */

  function maint(itemId) {
    var list = load().maint.slice();
    if (itemId) list = list.filter(function (m) { return m.itemId === itemId; });
    return list.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  function saveMaint(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.maint.length; i++) {
        if (d.maint[i].id === obj.id) { d.maint[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.maint.push(obj);
    }
    save();
    return obj;
  }

  function deleteMaint(id) {
    var d = load();
    d.maint = d.maint.filter(function (m) { return m.id !== id; });
    save();
  }

  /* ---------------- prescriptions (OP register) ---------------- */

  function rxList(filter) {
    var list = load().rx.slice();
    if (filter && filter.month) list = list.filter(function (r) { return toMonth(r.date) === filter.month; });
    return list.sort(function (a, b) {
      if (a.date === b.date) return (b.createdAt || '').localeCompare(a.createdAt || '');
      return (b.date || '').localeCompare(a.date || '');
    });
  }

  function rx(id) {
    return load().rx.filter(function (r) { return r.id === id; })[0] || null;
  }

  /**
   * Rewrites the issue entries belonging to one prescription.
   *
   * Every prescribed line becomes an ordinary OUT transaction carrying the
   * prescription's id, so the stock ledger, the monthly closing and the
   * reports all see it as a normal issue. Rebuilding from scratch on every
   * save is what keeps the stock correct when a prescription is edited —
   * changed quantities and removed lines cannot leave a stale deduction
   * behind.
   */
  function syncRxTxns(record) {
    var d = load();
    d.txns = d.txns.filter(function (t) { return t.rxId !== record.id; });
    (record.lines || []).forEach(function (line) {
      var qty = Math.abs(Number(line.qty) || 0);
      if (!line.itemId || !qty) return;
      var it = item(line.itemId) || {};
      d.txns.push({
        id: uid(),
        rxId: record.id,
        itemId: line.itemId,
        date: record.date,
        type: 'OUT',
        qty: qty,
        ref: record.no || '',
        party: record.patient || '',
        batchNo: it.batchNo || '',
        expiry: it.expiry || '',
        rate: it.rate || '',
        remarks: line.dose || '',
        createdAt: new Date().toISOString()
      });
    });
  }

  function saveRx(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.rx.length; i++) {
        if (d.rx[i].id === obj.id) { d.rx[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.rx.push(obj);
    }
    syncRxTxns(obj);
    save();
    return obj;
  }

  function deleteRx(id) {
    var d = load();
    d.rx = d.rx.filter(function (r) { return r.id !== id; });
    d.txns = d.txns.filter(function (t) { return t.rxId !== id; });   // give the stock back
    save();
  }

  /** Next serial in the form OP/<year>/0001, continuing the highest used. */
  function nextRxNo(date) {
    var year = (date || new Date().toISOString()).slice(0, 4);
    var prefix = 'OP/' + year + '/';
    var max = 0;
    load().rx.forEach(function (r) {
      if (!r.no || r.no.indexOf(prefix) !== 0) return;
      var n = parseInt(r.no.slice(prefix.length), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(4, '0');
  }

  /* ---------------- referrals ---------------- */

  function referralList(filter) {
    var list = load().referrals.slice();
    if (filter && filter.month) list = list.filter(function (r) { return toMonth(r.date) === filter.month; });
    return list.sort(function (a, b) {
      if (a.date === b.date) return (b.createdAt || '').localeCompare(a.createdAt || '');
      return (b.date || '').localeCompare(a.date || '');
    });
  }

  function referral(id) {
    return load().referrals.filter(function (r) { return r.id === id; })[0] || null;
  }

  function saveReferral(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.referrals.length; i++) {
        if (d.referrals[i].id === obj.id) { d.referrals[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.referrals.push(obj);
    }
    save();
    return obj;
  }

  function deleteReferral(id) {
    var d = load();
    d.referrals = d.referrals.filter(function (r) { return r.id !== id; });
    save();
  }

  function nextReferralNo(date) {
    var year = (date || new Date().toISOString()).slice(0, 4);
    var prefix = 'REF/' + year + '/';
    var max = 0;
    load().referrals.forEach(function (r) {
      if (!r.no || r.no.indexOf(prefix) !== 0) return;
      var n = parseInt(r.no.slice(prefix.length), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(4, '0');
  }

  /* ---------------- alerts ---------------- */

  function lowStock() {
    return items().filter(function (i) {
      if (i.category === 'asset') return false;
      var min = Number(i.minLevel) || 0;
      if (min <= 0) return false;
      return balance(i.id) <= min;
    }).map(function (i) {
      return { item: i, balance: balance(i.id), min: Number(i.minLevel) || 0 };
    });
  }

  function expiring() {
    var days = Number(load().settings.expiryDays) || 90;
    var limit = new Date();
    limit.setDate(limit.getDate() + days);
    var today = new Date();

    return items().filter(function (i) {
      return i.category !== 'asset' && i.expiry;
    }).map(function (i) {
      // an expiry month expires at the END of that month
      var y = +i.expiry.slice(0, 4), mo = +i.expiry.slice(5, 7);
      var exp = new Date(y, mo, 0);
      return { item: i, exp: exp, balance: balance(i.id) };
    }).filter(function (r) {
      return r.balance > 0 && r.exp <= limit;
    }).map(function (r) {
      r.expired = r.exp < today;
      r.daysLeft = Math.ceil((r.exp - today) / 86400000);
      return r;
    }).sort(function (a, b) { return a.exp - b.exp; });
  }

  function maintDue() {
    var soon = new Date();
    soon.setDate(soon.getDate() + 30);
    var byItem = {};
    load().maint.forEach(function (m) {
      if (!m.nextDue) return;
      if (!byItem[m.itemId] || m.nextDue > byItem[m.itemId].nextDue) byItem[m.itemId] = m;
    });
    return Object.keys(byItem).map(function (id) {
      return { item: item(id), rec: byItem[id], due: new Date(byItem[id].nextDue) };
    }).filter(function (r) {
      return r.item && r.due <= soon;
    }).sort(function (a, b) { return a.due - b.due; });
  }

  /* ---------------- exposed ---------------- */

  global.Store = {
    KEY: KEY,
    backend: backend.name,
    load: load,
    save: save,
    replaceAll: replaceAll,
    defaults: function () { return clone(DEFAULTS); },
    uid: uid,

    settings: function () { return load().settings; },
    saveSettings: function (s) {
      var d = load();
      Object.keys(s).forEach(function (k) { d.settings[k] = s[k]; });
      save();
    },

    items: items, item: item, saveItem: saveItem, deleteItem: deleteItem,
    txns: txns, saveTxn: saveTxn, deleteTxn: deleteTxn, signed: signed,

    balance: balance,
    monthSummary: monthSummary,
    closingOf: closingOf,
    saveClosing: saveClosing,
    isMonthClosed: isMonthClosed,

    maint: maint, saveMaint: saveMaint, deleteMaint: deleteMaint,

    rxList: rxList, rx: rx, saveRx: saveRx, deleteRx: deleteRx, nextRxNo: nextRxNo,

    referralList: referralList, referral: referral, saveReferral: saveReferral,
    deleteReferral: deleteReferral, nextReferralNo: nextReferralNo,

    lowStock: lowStock, expiring: expiring, maintDue: maintDue,

    toMonth: toMonth, currentMonth: currentMonth, prevMonth: prevMonth,
    nextMonth: nextMonth, monthName: monthName, monthEndDate: monthEndDate
  };

})(window);
