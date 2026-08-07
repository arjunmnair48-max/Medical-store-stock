import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAssets, getItem, getItems, getTransactions } from '../storage';
import type { AssetItem, StockItem } from '../types';
import { daysUntil, EXPIRY_WARNING_DAYS, formatCurrency, formatDate, formatDateTime } from '../utils';

const TITLES: Record<string, string> = {
  medicine: 'Medicine Stock Register',
  disposable: 'Disposable Items Stock Register',
  consumables: 'Combined Medicines & Disposables Stock Register',
  assets: 'Non-Disposable / Permanent Asset Register',
  lowstock: 'Low Stock / Reorder Indent Report',
  expiry: 'Expiry Alert Report',
  ledger: 'Item-wise Stock Ledger',
};

function ConsumableTable({ items }: { items: StockItem[] }) {
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th style={{ width: 32 }}>S.No</th>
          <th>Item Name</th>
          <th>Category</th>
          <th>Unit</th>
          <th>Batch No.</th>
          <th>Expiry Date</th>
          <th>Stock</th>
          <th>Reorder Lvl</th>
          <th>Supplier</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i, idx) => (
          <tr key={i.id}>
            <td>{idx + 1}</td>
            <td>{i.name}</td>
            <td>{i.category}</td>
            <td>{i.unit}</td>
            <td>{i.batchNo || '-'}</td>
            <td>{formatDate(i.expiryDate)}</td>
            <td>{i.stock}</td>
            <td>{i.reorderLevel}</td>
            <td>{i.supplier || '-'}</td>
            <td>{i.remarks || ''}</td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={10} style={{ textAlign: 'center' }}>No records found.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function AssetTable({ assets }: { assets: AssetItem[] }) {
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th style={{ width: 32 }}>S.No</th>
          <th>Asset Name</th>
          <th>Category</th>
          <th>Serial/Tag No.</th>
          <th>Qty</th>
          <th>Location</th>
          <th>Custodian</th>
          <th>Purchase Date</th>
          <th>Cost</th>
          <th>Condition</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((a, idx) => (
          <tr key={a.id}>
            <td>{idx + 1}</td>
            <td>{a.name}</td>
            <td>{a.assetCategory}</td>
            <td>{a.serialNo || '-'}</td>
            <td>{a.quantity}</td>
            <td>{a.location || '-'}</td>
            <td>{a.custodian || '-'}</td>
            <td>{formatDate(a.purchaseDate)}</td>
            <td>{formatCurrency(a.cost)}</td>
            <td>{a.condition}</td>
            <td>{a.remarks || ''}</td>
          </tr>
        ))}
        {assets.length === 0 && (
          <tr>
            <td colSpan={11} style={{ textAlign: 'center' }}>No records found.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function PrintRegister() {
  const { reportType = '', itemId } = useParams();
  const items = useMemo(() => getItems(), []);
  const assets = useMemo(() => getAssets(), []);
  const ledgerItem = useMemo(() => (itemId ? getItem(itemId) : undefined), [itemId]);
  const ledgerTxns = useMemo(() => (itemId ? getTransactions(itemId) : []), [itemId]);

  const title = TITLES[reportType] ?? 'Stock Report';

  let body: React.ReactNode = null;
  let recordCount = 0;

  if (reportType === 'medicine') {
    const rows = items.filter((i) => i.category === 'Medicine');
    recordCount = rows.length;
    body = <ConsumableTable items={rows} />;
  } else if (reportType === 'disposable') {
    const rows = items.filter((i) => i.category === 'Disposable');
    recordCount = rows.length;
    body = <ConsumableTable items={rows} />;
  } else if (reportType === 'consumables') {
    recordCount = items.length;
    body = <ConsumableTable items={items} />;
  } else if (reportType === 'assets') {
    recordCount = assets.length;
    body = <AssetTable assets={assets} />;
  } else if (reportType === 'lowstock') {
    const rows = items.filter((i) => i.stock <= i.reorderLevel);
    recordCount = rows.length;
    body = <ConsumableTable items={rows} />;
  } else if (reportType === 'expiry') {
    const rows = items
      .filter((i) => {
        const d = daysUntil(i.expiryDate);
        return d !== null && d <= EXPIRY_WARNING_DAYS;
      })
      .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''));
    recordCount = rows.length;
    body = <ConsumableTable items={rows} />;
  } else if (reportType === 'ledger' && ledgerItem) {
    recordCount = ledgerTxns.length;
    body = (
      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>S.No</th>
            <th>Date</th>
            <th>Particulars (Type)</th>
            <th>Reference</th>
            <th>Qty Received</th>
            <th>Qty Issued</th>
            <th>Balance</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {ledgerTxns.map((t, idx) => (
            <tr key={t.id}>
              <td>{idx + 1}</td>
              <td>{formatDate(t.date)}</td>
              <td>{t.type === 'IN' ? 'Received' : 'Issued'}</td>
              <td>{t.reference || '-'}</td>
              <td>{t.type === 'IN' ? t.quantity : ''}</td>
              <td>{t.type === 'OUT' ? t.quantity : ''}</td>
              <td>{t.balanceAfter}</td>
              <td>{t.remarks || ''}</td>
            </tr>
          ))}
          {ledgerTxns.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center' }}>No transactions recorded.</td>
            </tr>
          )}
        </tbody>
      </table>
    );
  } else {
    body = <p>Unknown report type.</p>;
  }

  return (
    <div className="main-content">
      <div className="print-page">
        <div className="print-toolbar no-print">
          <Link className="btn" to="/reports">Back to Reports</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>

        <div className="letterhead">
          <div className="org-name">National Institute of Pharmaceutical Education and Research (NIPER), Hajipur</div>
          <div className="org-sub">Medical Centre</div>
          <div className="report-title">
            {title}
            {reportType === 'ledger' && ledgerItem ? ` — ${ledgerItem.name}` : ''}
          </div>
        </div>

        <div className="print-meta">
          <span>Generated on: {formatDateTime(new Date().toISOString())}</span>
          <span>Total Records: {recordCount}</span>
        </div>

        {reportType === 'ledger' && ledgerItem && (
          <p style={{ fontSize: '0.85rem' }}>
            <strong>Batch No.:</strong> {ledgerItem.batchNo || '-'} &nbsp;&nbsp;
            <strong>Expiry:</strong> {formatDate(ledgerItem.expiryDate)} &nbsp;&nbsp;
            <strong>Unit:</strong> {ledgerItem.unit} &nbsp;&nbsp;
            <strong>Current Stock:</strong> {ledgerItem.stock}
          </p>
        )}

        {body}

        <div className="signature-row">
          <div className="signature-block">Prepared by</div>
          <div className="signature-block">Verified by (Pharmacist)</div>
          <div className="signature-block">Medical Officer In-Charge</div>
        </div>
      </div>
    </div>
  );
}
