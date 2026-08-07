import { useMemo, useState } from 'react';
import { getItems } from '../storage';

const REPORTS: { type: string; title: string; desc: string }[] = [
  {
    type: 'medicine',
    title: 'Medicine Stock Register',
    desc: 'Printable register of all medicines with batch, expiry, stock and reorder level — ready to transcribe into the physical register.',
  },
  {
    type: 'disposable',
    title: 'Disposable Items Stock Register',
    desc: 'Printable register of all disposable items (syringes, gloves, dressings, etc.).',
  },
  {
    type: 'consumables',
    title: 'Combined Medicines & Disposables Register',
    desc: 'Single combined register listing both medicines and disposables together.',
  },
  {
    type: 'assets',
    title: 'Non-Disposable Asset Register',
    desc: 'Permanent asset register with location, custodian, cost and condition — matches standard government asset register format.',
  },
  {
    type: 'lowstock',
    title: 'Low Stock / Reorder Report',
    desc: 'Items at or below their reorder level, for placing purchase indents.',
  },
  {
    type: 'expiry',
    title: 'Expiry Alert Report',
    desc: 'Items expired or expiring within 90 days, for disposal/replacement action.',
  },
];

export default function ReportsPage() {
  const items = useMemo(() => getItems(), []);
  const [ledgerItemId, setLedgerItemId] = useState('');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Printable Reports</h1>
          <p className="desc">Generate register-style printouts for filing or manual transcription into the office stock register.</p>
        </div>
      </div>

      <div className="report-grid">
        {REPORTS.map((r) => (
          <div className="report-card" key={r.type}>
            <h3>{r.title}</h3>
            <p>{r.desc}</p>
            <a className="btn btn-primary" href={`#/print/${r.type}`} target="_blank" rel="noreferrer">
              Open Printable Report
            </a>
          </div>
        ))}

        <div className="report-card">
          <h3>Item-wise Stock Ledger</h3>
          <p>Full receipt/issue history for a single medicine or disposable item.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={ledgerItemId} onChange={(e) => setLedgerItemId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Select item...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={!ledgerItemId}
              onClick={() => window.open(`#/print/ledger/${ledgerItemId}`, '_blank')}
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
