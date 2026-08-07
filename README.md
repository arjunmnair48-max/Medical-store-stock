# NIPER Hajipur Medical Centre — Stock Register

A simple, self-contained web app for maintaining the Medical Centre's stock
register. It covers the three things asked for:

1. **Medicines & Disposable Items** — consumable stock with batch number,
   expiry date, reorder level, and a full receipt/issue transaction ledger.
2. **Non-Disposable / Permanent Assets** — a register of furniture,
   equipment, instruments etc. with location, custodian, cost and condition.
3. **Printable Reports** — register-style printouts (with letterhead and
   signature lines) that can be printed or saved as PDF, ready to file or to
   copy into the physical office register.

All data is stored locally in the browser (no server, no database, no
internet connection required after the app is loaded). Use the **Backup &
Restore** page regularly to export a JSON backup so data is never lost.

## Running the app

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173) in a
browser.

To build a static production bundle (deployable to any web server, a shared
drive, or opened directly as a file):

```bash
npm run build
```

The output goes to `dist/`. You can also preview the production build with
`npm run preview`.

## Using the app

- **Dashboard** — at-a-glance counts of medicines, disposables, assets, low
  stock items and items nearing expiry.
- **Medicines & Disposables** — add items, record "Stock In" (received) and
  "Stock Out" (issued) transactions, view each item's ledger, search/filter,
  and export to CSV.
- **Non-Disposable Assets** — register permanent assets with their location,
  custodian and condition (Good / Needs Repair / Under Repair / Damaged /
  Disposed).
- **Printable Reports** — pick a report (Medicine Register, Disposable
  Register, Combined Register, Asset Register, Low Stock Report, Expiry
  Alert Report, or an individual item's Stock Ledger) and click **Print /
  Save as PDF**. Each report has a NIPER Hajipur Medical Centre letterhead
  and signature lines (Prepared by / Verified by / Medical Officer
  In-Charge) matching a typical office stock register layout.
- **Backup & Restore** — download a full JSON backup, restore from a
  backup file, export CSV files, or clear all data.

## Tech

React + TypeScript + Vite, with browser `localStorage` for persistence — no
backend server is required. Routing is done with `react-router-dom`.
