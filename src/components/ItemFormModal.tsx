import { useState } from 'react';
import type { ConsumableCategory, StockItem } from '../types';
import { saveItem } from '../storage';
import Modal from './Modal';

const UNIT_OPTIONS = ['Strip', 'Box', 'Bottle', 'Vial', 'Piece', 'Pack', 'Tube', 'Ampoule', 'Roll', 'Pair'];

export default function ItemFormModal({
  item,
  onClose,
  onSaved,
}: {
  item?: StockItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<ConsumableCategory>(item?.category ?? 'Medicine');
  const [unit, setUnit] = useState(item?.unit ?? 'Strip');
  const [batchNo, setBatchNo] = useState(item?.batchNo ?? '');
  const [expiryDate, setExpiryDate] = useState(item?.expiryDate ?? '');
  const [stock, setStock] = useState(item?.stock ?? 0);
  const [reorderLevel, setReorderLevel] = useState(item?.reorderLevel ?? 5);
  const [unitPrice, setUnitPrice] = useState<number | ''>(item?.unitPrice ?? '');
  const [supplier, setSupplier] = useState(item?.supplier ?? '');
  const [remarks, setRemarks] = useState(item?.remarks ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }
    if (stock < 0 || reorderLevel < 0) {
      setError('Stock and reorder level cannot be negative.');
      return;
    }
    try {
      saveItem(
        {
          name: name.trim(),
          category,
          unit,
          batchNo: batchNo.trim() || undefined,
          expiryDate: expiryDate || undefined,
          stock: Number(stock),
          reorderLevel: Number(reorderLevel),
          unitPrice: unitPrice === '' ? undefined : Number(unitPrice),
          supplier: supplier.trim() || undefined,
          remarks: remarks.trim() || undefined,
        },
        item?.id,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item.');
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Item' : 'Add Medicine / Disposable Item'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-grid">
          <div className="form-field full">
            <label htmlFor="name">Item Name *</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="form-field">
            <label htmlFor="category">Category *</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value as ConsumableCategory)}>
              <option value="Medicine">Medicine</option>
              <option value="Disposable">Disposable</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="unit">Unit</label>
            <input id="unit" list="unit-options" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="unit-options">
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label htmlFor="batchNo">Batch No.</label>
            <input id="batchNo" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="expiryDate">Expiry Date</label>
            <input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="stock">{isEdit ? 'Current Stock' : 'Opening Stock'}</label>
            <input
              id="stock"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="reorderLevel">Reorder Level</label>
            <input
              id="reorderLevel"
              type="number"
              min={0}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="unitPrice">Unit Price (Rs.)</label>
            <input
              id="unitPrice"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="supplier">Supplier</label>
            <input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
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
            {isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
