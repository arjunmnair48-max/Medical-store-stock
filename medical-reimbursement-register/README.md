# Medical Reimbursement Register

An office app for medical claims — the staff and the dependents covered by
each medical card, the empanelled hospitals with the period each empanelment
runs for, and the two kinds of claim the office settles:

1. **Hospital claim** — cashless treatment taken by an employee at an
   empanelled hospital, where the bill is settled with the hospital itself.
2. **Individual reimbursement** — treatment the employee has already paid for
   and is claiming back.

Monthly and annual returns, statements for one staff member or one hospital,
and separate reimbursement reports for the two payees all print on A4, save as
a PDF, or download as a spreadsheet.

It runs offline. Nothing is sent anywhere, no server is involved and no
internet connection is needed.

This is a **separate program** from the Medical Centre Stock Register in the
folder above. It has its own installer, its own icon and its own data file;
the two do not affect each other and can be installed side by side.

---

## Getting started — Windows program

1. Download **`MedicalReimbursementRegister-Setup-*.exe`** from the
   [Releases page](../../releases).
2. Run it. Windows SmartScreen will say the publisher is unknown, because the
   app is not code-signed — choose **More info → Run anyway**.
3. Pick a folder if you want to, and finish. A **Reimbursement Register**
   shortcut appears on the Desktop.

No administrator rights are needed, and nothing else has to be installed.

There is also a **portable** exe. It runs straight from a pen drive without
installing anything — useful when the office computer is locked down.

### Where the register is kept

```
%APPDATA%\Medical Reimbursement Register\reimbursement-data.json
%APPDATA%\Medical Reimbursement Register\backups\
```

The register is written to that file every time something is saved, and a
snapshot is kept once a day for the last 30 days. **File → Open Data Folder**
opens it. Take your own backup as well — **File → Save Backup…** — and keep it
somewhere off the machine.

### Keyboard shortcuts

| | |
|---|---|
| `Ctrl+N` | New claim |
| `Ctrl+T` | Add staff member |
| `Ctrl+H` | Add hospital |
| `Ctrl+B` | Save backup |
| `Ctrl+P` | Print report |
| `Ctrl+Shift+P` | Save report as PDF |
| `Ctrl+Shift+D` | Download report as CSV |
| `Ctrl+1` … `Ctrl+5`, `Ctrl+0` | Jump to a screen |

---

## Getting started — browser version

Open `index.html` in Chrome or Edge. Everything works the same, except that
the data lives in that browser's storage on that computer rather than in a
file — see the warning further down.

---

## The routine

| When | What to do | Where |
|---|---|---|
| Once, at the start | Enter every employee and the family covered by his card | Staff & Dependents |
| Once, at the start | Enter or **upload** the empanelled hospital list | Empanelled Hospitals |
| Whenever an empanelment is extended | Press **Extend**, enter the new date and order number | Empanelled Hospitals |
| Whenever a hospital bill arrives | Enter it as a **hospital claim** | Medical Claims |
| Whenever an employee claims expenses | Enter it as an **individual reimbursement** | Medical Claims |
| When a claim is passed | Enter the **amount admitted** and the sanction details | Medical Claims |
| End of every month | Print or download the **Monthly Claim Register** | Reports |
| End of every month | Print the two **reimbursement reports** — what is payable to the hospitals, and to the staff | Reports |
| End of the year | Print or download the **Annual Claim Statement** | Reports |
| After each return | **Export backup** and keep the file safe | Settings & Backup |

---

## Screens

### Dashboard
Staff and dependents on the register, empanelled hospitals in force, claims
made this month and this year, cashless against reimbursement, the amount
still to be settled and the claims waiting on it, who has drawn the most this
year, and any empanelment about to run out.

### Staff & Dependents
Every employee entitled to medical benefit, and the family covered by his
card. Enter the staff member's own particulars — employee number, designation,
department, medical card number — and then the dependents on the lines below:
**name, dependency, date of birth or age, and the card or token number** for
each. Give a date of birth and the age fills itself in and stays right as the
years pass; type the age instead where the dates of birth are not on file.

The list shows each employee with his whole family beside him, so one screen
answers "who is covered on this card". Two people cannot be given the same card
number in one family — the form refuses it, because a claim would then be
impossible to trace back. **Card** prints the family's medical card, and
**Claim** starts a claim with that employee already filled in.

A staff member who has claims booked against him cannot be deleted; set his
status to *Retired* instead, which keeps the old claims traceable.

### Empanelled Hospitals
The hospitals cashless treatment is admissible at. Each one carries the period
its empanelment currently runs for — **empanelled from** and **valid upto** —
along with the order number it was granted under.

The whole list can be **uploaded from a spreadsheet** rather than typed. Press
**⭳ Sample list** for a file with the columns it expects, fill it in, and press
**⭱ Upload list (.csv)**. Dates may be written the way the office writes them
(`01-04-2026`) or the way a spreadsheet exports them. A hospital already on the
list is matched by name and updated rather than duplicated, so the list can be
re-uploaded whenever head office sends a new one.

When an empanelment is **extended**, press **Extend** against the hospital and
enter the new date and the order number. The period in force moves to the new
end date and the one it replaced is kept on file. That is what lets a bill from
two years ago still be checked against the empanelment that applied on the day
of treatment. **Undo** puts the previous period back if an extension was
entered by mistake.

The list colours each hospital by where its empanelment stands — in force,
expiring soon, or run out — and the dashboard carries the same warning, so an
empanelment that needs an extension order is not missed.

### Medical Claims
The two kinds of claim in one register. Pick the kind at the top of the form
and the wording follows: the amount is *billed by hospital* or *claimed by
staff*, and the form says plainly who the payment goes to.

Choose the staff member and then the person treated — himself or any of his
dependents — and the **ID card number, dependency and age** are filled in from
the register rather than typed again. Then the **date of treatment**, the
hospital, the diagnosis, the bill number, the **amount claimed** and, when the
bill is passed, the **amount admitted**. The claim carries its position through
*Pending → Sanctioned → Paid*.

### What the amounts mean

The **amount admitted is final**. It is what the rules allow once the bill has
been restricted, not a part payment — whatever the bill claimed over and above
it is **disallowed** and is owed to nobody. So the register never shows the
difference as a balance payable; it shows it as a deduction, which is what it
is.

Two figures follow from that, and they are kept apart because they answer
different questions:

* **Disallowed** — billed but not admissible. Counted only on claims that have
  actually been examined. A bill still lying pending has nothing disallowed on
  it yet; it simply has not been looked at, and the list says *not assessed*
  rather than showing the whole bill as a deduction.
* **Now payable** — the amount already **sanctioned** but not yet released.
  This is the only figure the office genuinely owes, and it is what the two
  reimbursement reports total at the foot.

Claims not yet examined are counted separately again, as **awaiting
assessment**, at the amount billed.

While the date is being entered the form checks it against the hospital's
empanelment and says so underneath. A bill for a day the hospital was outside
its period is not blocked — sometimes there is a covering order — but it has to
be confirmed, and it is flagged in the list afterwards.

A reimbursement claim may name a hospital that was never empanelled, for an
emergency away from station; choose *a hospital not on the empanelled list* and
type the name.

Above the list a totals bar keeps a running count of what has been claimed,
what has been admitted, what was disallowed, what stands sanctioned but unpaid
and how many claims are still to be examined — for whatever the filters are
showing. **⭳ Download (.csv)** takes exactly that view as a
spreadsheet, and **Voucher** prints one claim for the sanction file.

Claims are numbered in two series that never collide — `HC/2026-27/0001` for a
cashless hospital claim and `RC/2026-27/0001` for a reimbursement — following
the office year set in Settings.

### Reports
Every sheet carries the office name at the top, a totals row, a few blank
ruled lines for handwritten additions, and a signature block for the dealing
assistant, the verifier and the sanctioning authority.

**Regular returns**

* **Monthly Claim Register** — every claim treated in the month, with the two
  kinds totalled separately underneath.
* **Annual Claim Statement** — the year month by month, cashless against
  reimbursement, with what was admitted and what was disallowed.

**Payment due**

* **Hospital Reimbursement Report** — each empanelled hospital's cashless
  treatment: billed, admitted, disallowed, already paid, and now payable.
* **Staff Reimbursement Report** — the same for each member of staff on bills
  already paid, with the family members treated.

**One staff member / one hospital**

* **Individual Staff Claim Statement** — one employee, the members covered by
  his card, and everything drawn during the period.
* **Hospital-wise Claim Statement** — one hospital, its empanelment history,
  and every claim treated there.

**Master lists**

* **List of Empanelled Hospitals** — with the period each empanelment runs for.
* **Register of Staff & Dependents** — every card and the family it covers.

**Single sheets**

* **Claim Voucher** — one claim, A4 upright, for the sanction file.
* **Medical Card** — one family, A4 upright, to issue to the employee.

Every sheet except the two single ones can also be taken as a **spreadsheet**
— press **⭳ Download (.csv)**, which gives the same figures in a file the
accounts section can work on. The registers print *A4 landscape*; the voucher
and the card print *A4 upright* and switch by themselves. Turning on
"Background graphics" keeps the shading on the heading row.

Monthly and annual sheets are cut **by date of treatment**, not by the day the
claim was typed, so a bill entered late still falls in the month the treatment
was taken.

### Settings & Backup
Office name and address, the dealing assistant, the medical officer, who
sanctions claims, the currency symbol, the month the office year opens in
(April by default, which the annual statement and the claim numbers follow),
and how many days before an empanelment runs out the warning should start.
Also backup, restore, and spreadsheet exports of the whole register.

---

## Important — the browser version and your data

In the Windows program the register is an ordinary file on the computer and is
safe. In the **browser version** it lives in that browser's own storage, which
means:

* clearing "cookies and site data" erases it;
* another browser, another computer or a private window will not see it;
* it is not on any network drive and is not backed up by anyone else.

Export a backup regularly and keep the file somewhere safe.

---

## Files

```
index.html                 all screens
assets/css/app.css         screen styles
assets/css/print.css       A4 print layout
assets/js/store.js         data layer — staff, dependents, hospitals, claims
assets/js/ui.js            shared helpers
assets/js/staff.js         staff and their dependents
assets/js/hospitals.js     empanelled hospitals, extensions, list upload
assets/js/claims.js        the claim register
assets/js/reports.js       the printed sheet and the picker that drives it
assets/js/statements.js    the individual statements and their spreadsheets
assets/js/app.js           routing, dashboard, settings, backup

main.js                    Electron main process (window, menu, data file)
preload.js                 the only bridge between the page and the OS
build/icon.ico             application icon
package.json               app metadata + electron-builder configuration
```

The app is plain HTML, CSS and JavaScript — no framework, no bundler, no build
step. `assets/js/store.js` picks its storage at startup: the file on disk when
the Electron bridge is present, the browser's storage otherwise. Nothing else
in the app knows the difference, which is why the same code runs both ways.

---

## Building the .exe yourself

```bash
cd medical-reimbursement-register
npm install
npm run dist
```

The installer and the portable exe land in `dist/`. The
`.github/workflows/build-reimbursement.yml` workflow does the same on a
Windows runner for every push, and attaches the exe files to the run.
