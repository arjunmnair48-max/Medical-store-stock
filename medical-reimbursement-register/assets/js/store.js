/* ============================================================
   store.js — data layer
   Medical Reimbursement Register

   Four registers that work together:

     staff       — the employee, with the medical card he is issued
     deps        — the family members covered by that same card
     hospitals   — the empanelled hospitals, each with the period its
                   empanelment currently runs for
     claims      — the bills themselves, of exactly two kinds: one an
                   empanelled hospital sends us for cashless treatment,
                   and one the employee has already paid and wants
                   reimbursed
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'mcreimb.v1';

  var DEFAULTS = {
    version: 1,
    settings: {
      officeName: 'Medical Centre',
      address: '',
      dealingAssistant: '',
      officer: '',
      sanctioning: '',
      currency: '₹',
      fyStartMonth: 4,        // the office year opens in April
      empanelWarnDays: 60     // warn this long before an empanelment runs out
    },

    // { id, empNo, name, designation, department, station, idCardNo, dob, age,
    //   gender, mobile, status: Serving|Retired, remarks }
    staff: [],

    // { id, staffId, name, relation, dob, age, gender, idCardNo, remarks }
    deps: [],

    // { id, name, address, city, phone, email, specialty, category, orderNo,
    //   empanelFrom, empanelTo, status: Empanelled|De-empanelled, remarks,
    //   extensions: [{ from, to, order, orderDate, remarks }] }
    hospitals: [],

    // { id, no, type: HOSPITAL|REIMB, date, staffId, beneficiaryId,
    //   benName, benRelation, benIdCard, benAge, hospitalId, hospitalName,
    //   treatFrom, treatTo, diagnosis, billNo, billDate,
    //   amountClaimed, amountReimbursed, status: PENDING|SANCTIONED|PAID|REJECTED,
    //   sanctionNo, sanctionDate, paidDate, mode, remarks }
    claims: []
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
    // fill in anything an older or partial backup is missing
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

  function nextMonth(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1;
    if (mo === 13) { y += 1; mo = 1; }
    return y + '-' + String(mo).padStart(2, '0');
  }

  function prevMonth(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1;
    if (mo === 0) { y -= 1; mo = 12; }
    return y + '-' + String(mo).padStart(2, '0');
  }

  function monthName(m) {
    if (!m) return '';
    var names = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return names[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  }

  var CLAIM_TYPES = {
    HOSPITAL: 'Hospital claim (cashless)',
    REIMB: 'Individual reimbursement'
  };

  var CLAIM_TYPE_SHORT = { HOSPITAL: 'Cashless', REIMB: 'Reimbursement' };

  var CLAIM_STATUS = {
    PENDING: 'Pending',
    SANCTIONED: 'Sanctioned',
    PAID: 'Paid',
    REJECTED: 'Rejected'
  };

  var RELATIONS = ['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother',
    'Father-in-law', 'Mother-in-law', 'Brother', 'Sister', 'Other'];

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  /* ---------------- financial year ---------------- */

  /** The month the office's year opens in — April unless changed in Settings. */
  function fyStartMonth() {
    var m = Number(load().settings.fyStartMonth);
    return (m >= 1 && m <= 12) ? m : 4;
  }

  /** '2026-06-15' -> '2026-27'  (or '2026' when the year runs Jan–Dec). */
  function fyOf(dateStr) {
    if (!dateStr) return '';
    var y = +dateStr.slice(0, 4), mo = +dateStr.slice(5, 7);
    var s = fyStartMonth();
    if (s === 1) return String(y);
    if (mo < s) y -= 1;
    return y + '-' + pad2((y + 1) % 100);
  }

  function currentFy() { return fyOf(todayISO()); }

  /** First and last day of a financial year, as plain ISO dates. */
  function fyRange(fy) {
    var s = fyStartMonth();
    var y = +String(fy).slice(0, 4);
    if (s === 1) return { from: y + '-01-01', to: y + '-12-31' };
    var endMonth = s - 1;                      // ends the month before it starts
    var lastDay = new Date(y + 1, endMonth, 0).getDate();
    return {
      from: y + '-' + pad2(s) + '-01',
      to: (y + 1) + '-' + pad2(endMonth) + '-' + pad2(lastDay)
    };
  }

  function fyName(fy) {
    if (!fy) return '';
    return fyStartMonth() === 1 ? String(fy) : 'F.Y. ' + fy;
  }

  /** Every year the register has claims in, newest first, always including this one. */
  function fyList() {
    var seen = {};
    seen[currentFy()] = true;
    load().claims.forEach(function (c) {
      var f = fyOf(claimDate(c));
      if (f) seen[f] = true;
    });
    return Object.keys(seen).sort().reverse();
  }

  /* ---------------- age ---------------- */

  /**
   * Age in completed years. A date of birth is used when there is one,
   * because that stays right as the years pass; otherwise the age typed
   * in at entry is returned as it stands.
   */
  function ageOf(rec, onDate) {
    if (!rec) return '';
    if (rec.dob) {
      var on = new Date(onDate || todayISO());
      var b = new Date(rec.dob);
      if (!isNaN(b.getTime()) && !isNaN(on.getTime())) {
        var a = on.getFullYear() - b.getFullYear();
        var m = on.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && on.getDate() < b.getDate())) a -= 1;
        if (a >= 0) return a;
      }
    }
    return (rec.age === '' || rec.age === null || rec.age === undefined) ? '' : rec.age;
  }

  /* ---------------- staff ---------------- */

  function staffList(filter) {
    var list = load().staff.slice();
    if (filter && filter.status && filter.status !== 'all') {
      list = list.filter(function (s) { return (s.status || 'Serving') === filter.status; });
    }
    return list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  function staffMember(id) {
    return load().staff.filter(function (s) { return s.id === id; })[0] || null;
  }

  function saveStaff(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.staff.length; i++) {
        if (d.staff[i].id === obj.id) { d.staff[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.staff.push(obj);
    }
    save();
    return obj;
  }

  /**
   * Removing a staff member takes his dependents with him, but only when
   * no claim has been booked against any of them — a paid claim must stay
   * traceable to the person it was paid for.
   */
  function deleteStaff(id) {
    var d = load();
    var used = d.claims.filter(function (c) { return c.staffId === id; }).length;
    if (used) return { ok: false, reason: 'claims', count: used };
    d.staff = d.staff.filter(function (s) { return s.id !== id; });
    d.deps = d.deps.filter(function (p) { return p.staffId !== id; });
    save();
    return { ok: true };
  }

  /* ---------------- dependents ---------------- */

  function dependentsOf(staffId) {
    return load().deps.filter(function (p) { return p.staffId === staffId; })
      .slice().sort(function (a, b) {
        var ra = RELATIONS.indexOf(a.relation), rb = RELATIONS.indexOf(b.relation);
        if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
        return (a.name || '').localeCompare(b.name || '');
      });
  }

  function dependent(id) {
    return load().deps.filter(function (p) { return p.id === id; })[0] || null;
  }

  function saveDependent(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.deps.length; i++) {
        if (d.deps[i].id === obj.id) { d.deps[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.deps.push(obj);
    }
    save();
    return obj;
  }

  function deleteDependent(id) {
    var d = load();
    var used = d.claims.filter(function (c) { return c.beneficiaryId === id; }).length;
    if (used) return { ok: false, reason: 'claims', count: used };
    d.deps = d.deps.filter(function (p) { return p.id !== id; });
    save();
    return { ok: true };
  }

  /**
   * Replaces one staff member's dependents in a single step, which is how
   * the entry form saves them — the whole family is edited together and
   * written back together. Rows that were already on file keep their id,
   * so the claims booked against them stay attached.
   */
  function saveDependents(staffId, rows) {
    var d = load();
    var keep = {};
    (rows || []).forEach(function (r) {
      if (!r.name) return;
      var rec = r.id ? dependent(r.id) : null;
      if (rec) {
        Object.keys(r).forEach(function (k) { rec[k] = r[k]; });
        keep[rec.id] = true;
      } else {
        var made = saveDependent({
          staffId: staffId, name: r.name, relation: r.relation || '', dob: r.dob || '',
          age: r.age || '', gender: r.gender || '', idCardNo: r.idCardNo || '',
          remarks: r.remarks || ''
        });
        keep[made.id] = true;
      }
    });
    // anything the form dropped goes, unless a claim still points at it
    d.deps.filter(function (p) { return p.staffId === staffId && !keep[p.id]; })
      .forEach(function (p) { deleteDependent(p.id); });
    save();
    return dependentsOf(staffId);
  }

  /* ---------------- beneficiaries (staff + his dependents) ---------------- */

  /** Everyone one card covers: the employee himself first, then the family. */
  function beneficiaries(staffId) {
    var s = staffMember(staffId);
    if (!s) return [];
    return [{
      id: s.id, staffId: s.id, name: s.name, relation: 'Self',
      idCardNo: s.idCardNo || '', dob: s.dob || '', age: s.age || '',
      gender: s.gender || '', self: true
    }].concat(dependentsOf(staffId));
  }

  function beneficiary(staffId, id) {
    return beneficiaries(staffId).filter(function (b) { return b.id === id; })[0] || null;
  }

  /**
   * Who a claim was for. The live record is preferred so a corrected name
   * or card number shows everywhere at once; the copy kept on the claim is
   * the fallback for a person since removed from the register.
   */
  function claimant(c) {
    if (!c) return null;
    var live = beneficiary(c.staffId, c.beneficiaryId);
    if (live) return live;
    return {
      id: c.beneficiaryId || '', staffId: c.staffId || '', name: c.benName || '',
      relation: c.benRelation || '', idCardNo: c.benIdCard || '', age: c.benAge || '',
      dob: '', gender: ''
    };
  }

  /* ---------------- empanelled hospitals ---------------- */

  function hospitalList(filter) {
    var list = load().hospitals.slice();
    if (filter && filter.status && filter.status !== 'all') {
      list = list.filter(function (h) { return empanelStatus(h) === filter.status; });
    }
    return list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  function hospital(id) {
    return load().hospitals.filter(function (h) { return h.id === id; })[0] || null;
  }

  function saveHospital(obj) {
    var d = load();
    if (obj.id) {
      for (var i = 0; i < d.hospitals.length; i++) {
        if (d.hospitals[i].id === obj.id) {
          obj.extensions = d.hospitals[i].extensions || [];   // history is not part of the form
          d.hospitals[i] = obj;
          break;
        }
      }
    } else {
      obj.id = uid();
      obj.extensions = obj.extensions || [];
      obj.createdAt = new Date().toISOString();
      d.hospitals.push(obj);
    }
    save();
    return obj;
  }

  function deleteHospital(id) {
    var d = load();
    var used = d.claims.filter(function (c) { return c.hospitalId === id; }).length;
    if (used) return { ok: false, reason: 'claims', count: used };
    d.hospitals = d.hospitals.filter(function (h) { return h.id !== id; });
    save();
    return { ok: true };
  }

  /**
   * Where a hospital's empanelment stands today.
   *
   *   future   — empanelled, but the period has not opened yet
   *   active   — running
   *   expiring — running, but ends within the warning period
   *   expired  — the period has run out; an extension order is awaited
   *   ended    — de-empanelled by order
   *   open     — empanelled with no end date recorded
   */
  function empanelStatus(h, onDate) {
    if (!h) return 'expired';
    if (h.status === 'De-empanelled') return 'ended';
    var day = onDate || todayISO();
    if (h.empanelFrom && day < h.empanelFrom) return 'future';
    if (!h.empanelTo) return 'open';
    if (day > h.empanelTo) return 'expired';
    var warn = Number(load().settings.empanelWarnDays);
    if (!isFinite(warn) || warn < 0) warn = 60;
    var limit = new Date(day);
    limit.setDate(limit.getDate() + warn);
    return new Date(h.empanelTo) <= limit ? 'expiring' : 'active';
  }

  /** Was this hospital empanelled on the day the treatment was taken? */
  function isEmpanelledOn(h, day) {
    if (!h || !day) return true;
    if (h.status === 'De-empanelled' && h.empanelTo && day > h.empanelTo) return false;
    if (h.empanelFrom && day < h.empanelFrom) return false;
    if (h.empanelTo && day > h.empanelTo) return false;
    return true;
  }

  /**
   * Records an extension order. The period the hospital was running on is
   * pushed into its history and the current period is moved to the new end
   * date, so `empanelFrom`/`empanelTo` always read as the empanelment in
   * force right now while the earlier orders stay on file.
   */
  function extendEmpanelment(id, ext) {
    var h = hospital(id);
    if (!h) return null;
    h.extensions = h.extensions || [];
    h.extensions.push({
      from: h.empanelFrom || '',
      to: h.empanelTo || '',
      order: ext.order || '',
      orderDate: ext.orderDate || '',
      remarks: ext.remarks || '',
      recordedAt: new Date().toISOString()
    });
    if (ext.from) h.empanelFrom = ext.from;
    h.empanelTo = ext.to || '';
    h.orderNo = ext.order || h.orderNo || '';
    h.status = 'Empanelled';
    save();
    return h;
  }

  /** Undoes the last extension, putting the previous period back in force. */
  function undoExtension(id) {
    var h = hospital(id);
    if (!h || !h.extensions || !h.extensions.length) return null;
    var last = h.extensions.pop();
    h.empanelFrom = last.from || h.empanelFrom;
    h.empanelTo = last.to || '';
    save();
    return h;
  }

  /** Hospitals whose empanelment has run out or is about to. */
  function empanelAlerts() {
    return hospitalList().map(function (h) {
      return { hospital: h, state: empanelStatus(h) };
    }).filter(function (r) {
      return r.state === 'expired' || r.state === 'expiring';
    }).sort(function (a, b) {
      return (a.hospital.empanelTo || '').localeCompare(b.hospital.empanelTo || '');
    });
  }

  /* ---------------- claims ---------------- */

  /** A claim sits in the month it was treated in, not the day it was typed. */
  function claimDate(c) { return (c && (c.treatFrom || c.date)) || ''; }

  function claimList(filter) {
    var list = load().claims.slice();
    var f = filter || {};
    if (f.type && f.type !== 'all') list = list.filter(function (c) { return c.type === f.type; });
    if (f.status && f.status !== 'all') list = list.filter(function (c) { return (c.status || 'PENDING') === f.status; });
    if (f.staffId) list = list.filter(function (c) { return c.staffId === f.staffId; });
    if (f.hospitalId) list = list.filter(function (c) { return c.hospitalId === f.hospitalId; });
    if (f.month) list = list.filter(function (c) { return toMonth(claimDate(c)) === f.month; });
    if (f.fy && f.fy !== 'all') {
      var r = fyRange(f.fy);
      list = list.filter(function (c) {
        var d = claimDate(c);
        return d >= r.from && d <= r.to;
      });
    }
    return list.sort(function (a, b) {
      var da = claimDate(a), db = claimDate(b);
      if (da === db) return (b.createdAt || '').localeCompare(a.createdAt || '');
      return db.localeCompare(da);
    });
  }

  function claim(id) {
    return load().claims.filter(function (c) { return c.id === id; })[0] || null;
  }

  function saveClaim(obj) {
    var d = load();
    // keep a copy of who and where, so an old claim still reads correctly
    // if the person or the hospital is later removed from the register
    var b = beneficiary(obj.staffId, obj.beneficiaryId);
    if (b) {
      obj.benName = b.name || '';
      obj.benRelation = b.relation || '';
      obj.benIdCard = b.idCardNo || '';
      obj.benAge = ageOf(b, claimDate(obj));
    }
    var h = hospital(obj.hospitalId);
    if (h) obj.hospitalName = h.name || '';

    if (obj.id) {
      for (var i = 0; i < d.claims.length; i++) {
        if (d.claims[i].id === obj.id) { d.claims[i] = obj; break; }
      }
    } else {
      obj.id = uid();
      obj.createdAt = new Date().toISOString();
      d.claims.push(obj);
    }
    save();
    return obj;
  }

  function deleteClaim(id) {
    var d = load();
    d.claims = d.claims.filter(function (c) { return c.id !== id; });
    save();
  }

  /** HC/2026-27/0001 for a hospital bill, RC/… for a reimbursement. */
  function nextClaimNo(date, type) {
    var fy = fyOf(date || todayISO()) || String(new Date().getFullYear());
    var prefix = (type === 'REIMB' ? 'RC/' : 'HC/') + fy + '/';
    var max = 0;
    load().claims.forEach(function (c) {
      if (!c.no || c.no.indexOf(prefix) !== 0) return;
      var n = parseInt(c.no.slice(prefix.length), 10);
      if (isFinite(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(4, '0');
  }

  function claimTotals(list) {
    var t = { count: (list || []).length, claimed: 0, reimbursed: 0, balance: 0, pending: 0 };
    (list || []).forEach(function (c) {
      var cl = Number(c.amountClaimed) || 0;
      var rb = Number(c.amountReimbursed) || 0;
      t.claimed += cl;
      t.reimbursed += rb;
      if ((c.status || 'PENDING') === 'PENDING') t.pending += 1;
    });
    t.balance = t.claimed - t.reimbursed;
    return t;
  }

  /** Claim totals rolled up per staff member, biggest first. */
  function claimsByStaff(filter) {
    var by = {};
    claimList(filter).forEach(function (c) {
      var k = c.staffId || '(none)';
      (by[k] = by[k] || []).push(c);
    });
    return Object.keys(by).map(function (k) {
      var s = staffMember(k);
      return {
        staff: s,
        name: s ? s.name : '(removed from register)',
        claims: by[k],
        totals: claimTotals(by[k])
      };
    }).sort(function (a, b) { return b.totals.claimed - a.totals.claimed; });
  }

  /** Claim totals rolled up per hospital, biggest first. */
  function claimsByHospital(filter) {
    var by = {};
    claimList(filter).forEach(function (c) {
      var k = c.hospitalId || ('name:' + (c.hospitalName || '(not stated)'));
      (by[k] = by[k] || []).push(c);
    });
    return Object.keys(by).map(function (k) {
      var h = hospital(k);
      var first = by[k][0];
      return {
        hospital: h,
        name: h ? h.name : (first.hospitalName || '(not stated)'),
        claims: by[k],
        totals: claimTotals(by[k])
      };
    }).sort(function (a, b) { return b.totals.claimed - a.totals.claimed; });
  }

  /** Claims still to be settled — what the dashboard counts. */
  function claimsPending(filter) {
    return claimList(filter).filter(function (c) {
      return (c.status || 'PENDING') !== 'PAID' && (c.status || 'PENDING') !== 'REJECTED';
    });
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

    CLAIM_TYPES: CLAIM_TYPES, CLAIM_TYPE_SHORT: CLAIM_TYPE_SHORT,
    CLAIM_STATUS: CLAIM_STATUS, RELATIONS: RELATIONS,

    staffList: staffList, staffMember: staffMember, saveStaff: saveStaff,
    deleteStaff: deleteStaff,

    dependentsOf: dependentsOf, dependent: dependent, saveDependent: saveDependent,
    deleteDependent: deleteDependent, saveDependents: saveDependents,

    beneficiaries: beneficiaries, beneficiary: beneficiary, claimant: claimant,
    ageOf: ageOf,

    hospitalList: hospitalList, hospital: hospital, saveHospital: saveHospital,
    deleteHospital: deleteHospital, empanelStatus: empanelStatus,
    isEmpanelledOn: isEmpanelledOn, extendEmpanelment: extendEmpanelment,
    undoExtension: undoExtension, empanelAlerts: empanelAlerts,

    claimList: claimList, claim: claim, saveClaim: saveClaim, deleteClaim: deleteClaim,
    nextClaimNo: nextClaimNo, claimDate: claimDate, claimTotals: claimTotals,
    claimsByStaff: claimsByStaff, claimsByHospital: claimsByHospital,
    claimsPending: claimsPending,

    fyOf: fyOf, fyRange: fyRange, fyName: fyName, fyList: fyList,
    currentFy: currentFy, fyStartMonth: fyStartMonth,

    toMonth: toMonth, currentMonth: currentMonth, prevMonth: prevMonth,
    nextMonth: nextMonth, monthName: monthName
  };

})(window);
