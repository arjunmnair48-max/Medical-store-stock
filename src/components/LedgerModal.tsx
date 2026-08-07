import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockItem } from '../types';
import { getTransactions } from '../storage';
import { formatDate } from '../utils';
import Modal from './Modal';

export default function LedgerModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const txns = useMemo(() => getTransactions(item.id).slice().reverse(), [item.id]);

  return (
    <Modal title={`Stock Ledger — ${item.name}`} onClose={onClose} wide>
      <p className="text-muted" style={{ marginTop: 0 }}>
        Batch: {item.batchNo || '-'} &nbsp;|&nbsp; Current Stock: <strong>{item.stock} {item.unit}</strong>
      </p>
      {txns.length === 0 ? (
        <p className="text-muted">No transactions recorded yet.</p>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Balance</th>
                <th>Reference</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.date)}</td>
                  <td className={t.type === 'IN' ? 'text-muted' : 'text-danger'}>{t.type === 'IN' ? 'Received' : 'Issued'}</td>
                  <td>{t.quantity}</td>
                  <td>{t.balanceAfter}</td>
                  <td>{t.reference || '-'}</td>
                  <td>{t.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-actions">
        <Link className="btn" to={`/print/ledger/${item.id}`} target="_blank" rel="noreferrer">
          Print Ledger
        </Link>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
