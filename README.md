# Medical Centre Stock Register

A stock-keeping app for a medical centre — medicines, disposable items and
permanent assets — with a monthly stock update and printable A4 report sheets
that can be pasted straight into the physical register.

It runs offline. Nothing is sent anywhere, no server is involved and no
internet connection is needed.

There are two ways to run it — a **Windows program** (recommended) or by
opening a file in a browser.

---

## Getting started — Windows program

Download from the [**Releases**](../../releases) page:

| File | What it is |
|---|---|
| `MedicalCentreStockRegister-Setup-1.0.0.exe` | **Installer.** Run it, click through, and the app appears on the Desktop and in the Start Menu. No administrator rights needed. |
| `MedicalCentreStockRegister-Portable-1.0.0.exe` | **Portable.** Runs straight from a pen drive. Nothing is installed. |

When you first run it Windows SmartScreen will say *"Windows protected your
PC"* because the app is not code-signed (a signing certificate has to be bought
from a certificate authority). Click **More info → Run anyway**. This happens
once.

Then:

1. Open **Settings & Backup** and enter the name of your medical centre, the
   store keeper and the medical officer. These are printed on every report.
2. Open **Item Master → + Add Item** and enter your items.

To try it out first, use **Help → Load Sample Data**, which fills in 15 demo
items and a month's worth of entries. **Erase all data** clears it again.

### Where the register is kept

The Windows app keeps everything in a real file:

```
C:\Users\<your name>\AppData\Roaming\Medical Centre Stock Register\stock-data.json
```

It is written afresh every time something is saved, and a dated snapshot is
kept automatically each day in the `backups` folder beside it (the last 30 are
kept). **File → Open Data Folder** takes you straight there.

Uninstalling the program does **not** delete this folder — the stock records
survive an uninstall or a reinstall.

### Keyboard shortcuts

| | |
|---|---|
| `Ctrl+N` | Add item |
| `Ctrl+E` | Record receipt / issue |
| `Ctrl+B` | Save backup |
| `Ctrl+P` | Print report |
| `Ctrl+Shift+P` | Save report as PDF |
| `Ctrl+1` … `Ctrl+7` | Jump to a screen |

---

## Getting started — browser version

The same app also runs by simply opening **`index.html`** in Chrome or Edge,
with no installation at all. Everything works identically except that the data
is kept in that browser's storage rather than in a file — see the warning
further down.

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

## Important — the browser version and your data

**This section applies only if you run `index.html` in a browser.** The Windows
program keeps a real file and is not affected.

In the browser version everything is stored in that browser's local storage on
that one computer. It is not sent anywhere.

That means:

* Clearing "browsing data / cookies / site data" **erases the register**.
* A different browser, a different user account or a different computer shows
  an empty register.
* Private / Incognito windows lose everything when closed.

**So export a backup after every monthly closing** and keep the file on a pen
drive or a shared folder. Restoring it on any computer rebuilds the register
exactly. (This is good practice in the Windows version too, but there it is a
second line of defence rather than the only one.)

---

## Files

```
index.html                 all screens
assets/css/app.css         screen styles
assets/css/print.css       A4 print layout
assets/js/store.js         data + balance calculations
assets/js/ui.js            shared helpers
assets/js/items.js         Item Master
assets/js/transactions.js  Receipt / Issue
assets/js/monthly.js       monthly closing
assets/js/maintenance.js   asset maintenance
assets/js/reports.js       printable reports
assets/js/app.js           routing, dashboard, settings, backup

main.js                    Electron main process (window, menu, data file)
preload.js                 the only bridge between the page and the OS
build/icon.ico             application icon
build/installer.nsi        NSIS installer script
package.json               app metadata + electron-builder configuration
.github/workflows/         builds the .exe on a Windows runner
```

The app itself is plain HTML, CSS and JavaScript — no framework, no bundler, no
build step. `assets/js/store.js` picks its storage at startup: the file on disk
when the Electron bridge is present, the browser's storage otherwise. Nothing
else in the app knows the difference, which is why the same code runs both
ways.

---

## Building the .exe yourself

```bash
npm install
npm run dist          # on Windows -> installer + portable exe in dist/
```

On Windows that produces both `MedicalCentreStockRegister-Setup-<version>.exe`
and the portable exe. This is also what the GitHub Actions workflow runs, so
pushing a tag like `v1.0.1` builds and publishes a new release automatically.

To build the Windows exe **from Linux**, electron-builder's installer step
needs Wine. To avoid that, `build/installer.nsi` compiles the same installer
with a native Linux NSIS instead:

```bash
sudo apt-get install nsis
npm run dist:linuxhost
```

`npm start` runs the app from source without packaging it.

## Using it on several computers

The app has no server, so there is no live sharing. Two workable approaches:

* **One computer is the master.** Do all entry there, export a backup after
  each closing, and restore that file elsewhere when a copy is needed.
* **Put the folder on a shared drive** so everyone opens the same
  `index.html` — but note each computer still keeps its *own* data, because
  storage belongs to the browser, not to the folder. The backup file remains
  the way to move data between them.
