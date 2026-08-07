# Medical Centre Stock Register

A stock-keeping app for a medical centre — medicines, disposable items and
permanent assets — with a monthly stock update and printable A4 report sheets
that can be pasted straight into the physical register.

It runs entirely in the browser. There is nothing to install, no server and no
internet connection needed. All data is kept in the browser's own storage on
the computer where it is used.

---

## Getting started

1. Download or clone this repository.
2. Open **`index.html`** by double-clicking it (Chrome or Edge recommended).
3. Go to **Settings & Backup** and enter the name of your medical centre,
   the store keeper and the medical officer. These are printed on every report.
4. Go to **Item Master → + Add Item** and enter your items.

To try it out first, use **Settings & Backup → Load sample data**, which fills
in 15 demo items and a month's worth of entries. **Erase all data** clears it
again.

---

## The daily / monthly routine

| When | What to do | Where |
|---|---|---|
| Once, at the start | Enter every item with its **opening stock** | Item Master |
| Whenever stock arrives | Record a **Receipt** with the bill number | Receipt / Issue |
| Whenever stock goes out | Record an **Issue** with the department / indent number | Receipt / Issue |
| When something expires or breaks | Record it as **Expired / Damaged** | Receipt / Issue |
| End of every month | Count the shelves, enter the **physical count**, press **Close & Save Month** | Monthly Stock |
| After closing | Print the register sheet and paste it in the register | Print Reports |
| After closing | **Export backup** and keep the file safe | Settings & Backup |

---

## Screens

### Dashboard
Item counts, stock value, items below minimum level, expiry alerts,
maintenance due within 30 days, and the last ten entries made.

### Item Master
All items in one place, split into **Medicines**, **Disposables** and
**Permanent Assets**. Each category asks for the fields that matter to it:

* **Medicines** — strength, dosage form, batch number, expiry, manufacturer,
  minimum level, rack.
* **Disposables** — specification / size, batch, expiry, minimum level, rack.
* **Permanent assets** — asset tag, serial / model number, date of purchase,
  purchase cost, warranty or AMC expiry, condition (Working / Under repair /
  Condemned), location.

Click any row to edit it. Deleting an item also removes its entries and
closings, and asks first.

### Receipt / Issue
One form for every movement of stock:

| Entry type | Effect on balance |
|---|---|
| Receipt | adds |
| Issue / Consumption | subtracts |
| Expired / Damaged / Condemned | subtracts (kept separate in reports) |
| Adjustment | adds or subtracts, as typed (use a minus sign to reduce) |

The form shows the stock in hand as soon as an item is picked, fills in the
batch, expiry and rate from the item master, and warns before an issue would
push the balance below zero. A receipt with a new batch or expiry updates the
item master automatically.

### Monthly Stock
Pick a month and the table shows, for every item:

```
opening + receipts − issues − expired/damaged + adjustments = book balance
```

Enter the **physical count** beside it; the difference is worked out live and
a remarks box is there for the reason. **Fill physical = book** pre-fills the
column when the count agrees, so only the exceptions need typing.

**Close & Save Month** stores the closing figures for every item in all three
categories. The physical count — not the book balance — carries forward as
next month's opening, which is what makes the register self-correcting: a
verified count supersedes any earlier bookkeeping error.

A closed month can be reopened and corrected simply by editing the figures and
saving again.

### Asset Maintenance
Service, repair and calibration record for permanent assets, with a **next due
date** that feeds the dashboard's maintenance alert.

### Print Reports
Nine A4 sheets, each with the centre's name at the top, a totals row, a few
blank ruled lines for handwritten additions, and a signature block for the
store keeper, the verifier and the medical officer:

* Monthly Stock Register — Medicines
* Monthly Stock Register — Disposable Items
* Monthly Stock Register — Medicines + Disposables
* Permanent Asset Register
* Expiry / Near-Expiry Report
* Indent — Items Below Minimum Level
* Asset Maintenance Register
* Item Stock Ledger (one item, one month)
* Receipt & Issue Day Book

Press **Print** and choose *A4*, *Landscape* in the browser's print dialog.
Turning on "Background graphics" keeps the shading on the heading row.
Choosing *Save as PDF* instead of a printer keeps a soft copy.

### Settings & Backup
Centre name, address, store keeper, medical officer, the expiry-alert window
in days, and the currency symbol. Also:

* **Export backup (.json)** — the whole register in one file.
* **Restore from backup** — replaces everything currently in the browser.
* **Export items / transactions (.csv)** — opens in Excel or LibreOffice.

---

## Important — where the data lives

Everything is stored in the browser's local storage on that one computer, under
that one browser. It is not sent anywhere.

That means:

* Clearing "browsing data / cookies / site data" **erases the register**.
* A different browser, a different user account or a different computer shows
  an empty register.
* Private / Incognito windows lose everything when closed.

**So export a backup after every monthly closing** and keep the file on a pen
drive or a shared folder. Restoring it on any computer rebuilds the register
exactly.

---

## Files

```
index.html              all screens
assets/css/app.css      screen styles
assets/css/print.css    A4 print layout
assets/js/store.js      data + balance calculations (localStorage)
assets/js/ui.js         shared helpers
assets/js/items.js      Item Master
assets/js/transactions.js  Receipt / Issue
assets/js/monthly.js    monthly closing
assets/js/maintenance.js   asset maintenance
assets/js/reports.js    printable reports
assets/js/app.js        routing, dashboard, settings, backup
```

Plain HTML, CSS and JavaScript — no build step, no dependencies, no bundler.
Opening `index.html` from the file system is all that is required.

## Using it on several computers

The app has no server, so there is no live sharing. Two workable approaches:

* **One computer is the master.** Do all entry there, export a backup after
  each closing, and restore that file elsewhere when a copy is needed.
* **Put the folder on a shared drive** so everyone opens the same
  `index.html` — but note each computer still keeps its *own* data, because
  storage belongs to the browser, not to the folder. The backup file remains
  the way to move data between them.
