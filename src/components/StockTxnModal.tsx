import { useState } from 'react';
import type { StockItem, TransactionType } from '../types';
import { recordTransaction } from '../storage';
import { todayIso } from '../utils';
import Modal from './Modal';

export default function StockTxnModal({
  item,
  type,
  onClose,
  onSaved,
}: {
  item: StockItem;
  type: TransactionType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      recordTransaction(item.id, type, Number(quantity), date, reference.trim() || undefined, remarks.trim() || undefined);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record transaction.');
    }
  }

  return (
    <Modal title={`${type === 'IN' ? 'Stock In (Received)' : 'Stock Out (Issued)'} — ${item.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}
        <p className="text-muted" style={{ marginTop: 0 }}>
          Current stock: <strong>{item.stock} {item.unit}</strong>
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="qty">Quantity *</label>
            <input
              id="qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="date">Date *</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="form-field full">
            <label htmlFor="reference">{type === 'IN' ? 'PO / Supplier Reference' : 'Issued To (Dept / Patient / Purpose)'}</label>
            <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="form-field full">
            <label htmlFor="remarks">Remarks</label>
            <textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Record {type === 'IN' ? 'Receipt' : 'Issue'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
