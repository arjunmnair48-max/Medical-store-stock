import { useRef, useState } from 'react';
import { clearAllData, exportBackup, getAssets, getItems, importBackup } from '../storage';
import { downloadFile, formatDateTime, toCsv } from '../utils';
import ConfirmDialog from '../components/ConfirmDialog';
import type { BackupData } from '../types';

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  function handleExportJson() {
    const data = exportBackup();
    downloadFile(`niper-hajipur-medical-stock-backup-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
    setMessage('Backup downloaded.');
    setError('');
  }

  function handleExportAllCsv() {
    const items = getItems();
    const assets = getAssets();
    const itemRows = items.map((i) => ({
      Type: i.category,
      Name: i.name,
      Unit: i.unit,
      BatchNo: i.batchNo ?? '',
      ExpiryDate: i.expiryDate ?? '',
      Stock: i.stock,
      ReorderLevel: i.reorderLevel,
      UnitPrice: i.unitPrice ?? '',
      Supplier: i.supplier ?? '',
    }));
    const assetRows = assets.map((a) => ({
      Type: 'Asset',
      Name: a.name,
      Category: a.assetCategory,
      SerialNo: a.serialNo ?? '',
      Quantity: a.quantity,
      Location: a.location ?? '',
      Custodian: a.custodian ?? '',
      Condition: a.condition,
      Cost: a.cost ?? '',
    }));
    downloadFile(`medicines-disposables-${Date.now()}.csv`, toCsv(itemRows), 'text/csv');
    setTimeout(() => downloadFile(`assets-${Date.now()}.csv`, toCsv(assetRows), 'text/csv'), 200);
    setMessage('CSV files downloaded.');
    setError('');
  }

  function handleImportClick() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupData;
        importBackup(data);
        setMessage('Backup restored successfully. Reloading...');
        setError('');
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Backup &amp; Restore</h1>
          <p className="desc">All data is stored locally in this browser. Take regular backups so data is never lost.</p>
        </div>
      </div>

      {message && <div className="card" style={{ marginBottom: '1rem', borderColor: '#0f9d6e' }}>{message}</div>}
      {error && <div className="form-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Export Backup (JSON)</h2>
          <p className="text-muted">Full backup of all medicines, disposables, assets and transaction history. Use this file to restore data or move to another computer.</p>
          <button className="btn btn-primary" onClick={handleExportJson}>Download JSON Backup</button>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Restore Backup (JSON)</h2>
          <p className="text-muted">Restoring will replace all current data with the contents of the backup file.</p>
          <button className="btn" onClick={handleImportClick}>Choose Backup File...</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Export as CSV</h2>
          <p className="text-muted">Download current items and assets as spreadsheet-friendly CSV files.</p>
          <button className="btn" onClick={handleExportAllCsv}>Download CSV Files</button>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }} className="text-danger">Clear All Data</h2>
          <p className="text-muted">Permanently erase all medicines, disposables, assets and history from this browser. Export a backup first.</p>
          <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>Clear All Data</button>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>
        Last checked: {formatDateTime(new Date().toISOString())}
      </p>

      {confirmClear && (
        <ConfirmDialog
          title="Clear All Data"
          message="This will permanently delete ALL medicines, disposables, assets and transaction history stored in this browser. This cannot be undone. Continue?"
          confirmLabel="Clear Everything"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearAllData();
            setConfirmClear(false);
            setMessage('All data cleared.');
            setTimeout(() => window.location.reload(), 500);
          }}
        />
      )}
    </div>
  );
}
