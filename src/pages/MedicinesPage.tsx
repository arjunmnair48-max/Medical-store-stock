import { useState } from 'react';
import type { ConsumableCategory, StockItem } from '../types';
import { deleteItem, getItems } from '../storage';
import { daysUntil, EXPIRY_WARNING_DAYS, formatDate, toCsv, downloadFile } from '../utils';
import ItemFormModal from '../components/ItemFormModal';
import StockTxnModal from '../components/StockTxnModal';
import LedgerModal from '../components/LedgerModal';
import ConfirmDialog from '../components/ConfirmDialog';

type Filter = 'all' | ConsumableCategory | 'low' | 'expiring';

export default function MedicinesPage() {
  const [, setRefresh] = useState(0);
  const items = getItems();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const [formItem, setFormItem] = useState<StockItem | undefined | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [txnItem, setTxnItem] = useState<{ item: StockItem; type: 'IN' | 'OUT' } | null>(null);
  const [ledgerItem, setLedgerItem] = useState<StockItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);

  function bump() {
    setRefresh((r) => r + 1);
  }

  const filtered = items.filter((i) => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.batchNo ?? '').toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filter === 'Medicine' || filter === 'Disposable') return i.category === filter;
    if (filter === 'low') return i.stock <= i.reorderLevel;
    if (filter === 'expiring') {
      const d = daysUntil(i.expiryDate);
      return d !== null && d <= EXPIRY_WARNING_DAYS;
    }
    return true;
  });

  function expiryBadge(item: StockItem) {
    const d = daysUntil(item.expiryDate);
    if (d === null) return null;
    if (d < 0) return <span className="badge expired">Expired</span>;
    if (d <= EXPIRY_WARNING_DAYS) return <span className="badge expiring">Expires in {d}d</span>;
    return null;
  }

  function handleExportCsv() {
    const rows = filtered.map((i) => ({
      Name: i.name,
      Category: i.category,
      Unit: i.unit,
      BatchNo: i.batchNo ?? '',
      ExpiryDate: i.expiryDate ?? '',
      Stock: i.stock,
      ReorderLevel: i.reorderLevel,
      UnitPrice: i.unitPrice ?? '',
      Supplier: i.supplier ?? '',
      Remarks: i.remarks ?? '',
    }));
    downloadFile(`medicines-disposables-${Date.now()}.csv`, toCsv(rows), 'text/csv');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Medicines &amp; Disposable Items</h1>
          <p className="desc">Track consumable stock, batch/expiry, and issue/receipt transactions.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn" onClick={handleExportCsv}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Item</button>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or batch no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All Items</option>
          <option value="Medicine">Medicines Only</option>
          <option value="Disposable">Disposables Only</option>
          <option value="low">Low / Reorder Stock</option>
          <option value="expiring">Expiring Soon</option>
        </select>
        <div className="spacer" />
        <span className="text-muted">{filtered.length} of {items.length} items</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          {items.length === 0
            ? 'No items yet. Click "+ Add Item" to add your first medicine or disposable.'
            : 'No items match your search/filter.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Stock</th>
                <th>Reorder Lvl</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td><span className={`badge ${i.category.toLowerCase()}`}>{i.category}</span></td>
                  <td>{i.batchNo || '-'}</td>
                  <td>
                    {formatDate(i.expiryDate)} {expiryBadge(i)}
                  </td>
                  <td className={i.stock <= i.reorderLevel ? 'text-danger' : undefined}>
                    {i.stock} {i.unit} {i.stock <= i.reorderLevel && <span className="badge low">Low</span>}
                  </td>
                  <td>{i.reorderLevel}</td>
                  <td>{i.supplier || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-sm" onClick={() => setTxnItem({ item: i, type: 'IN' })}>Stock In</button>
                      <button className="btn btn-sm" onClick={() => setTxnItem({ item: i, type: 'OUT' })}>Stock Out</button>
                      <button className="btn btn-sm" onClick={() => setLedgerItem(i)}>Ledger</button>
                      <button className="btn btn-sm" onClick={() => setFormItem(i)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(i)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <ItemFormModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            bump();
          }}
        />
      )}

      {formItem && (
        <ItemFormModal
          item={formItem}
          onClose={() => setFormItem(null)}
          onSaved={() => {
            setFormItem(null);
            bump();
          }}
        />
      )}

      {txnItem && (
        <StockTxnModal
          item={txnItem.item}
          type={txnItem.type}
          onClose={() => setTxnItem(null)}
          onSaved={() => {
            setTxnItem(null);
            bump();
          }}
        />
      )}

      {ledgerItem && <LedgerModal item={ledgerItem} onClose={() => setLedgerItem(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Item"
          message={`Delete "${deleteTarget.name}" and all its transaction history? This cannot be undone.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteItem(deleteTarget.id);
            setDeleteTarget(null);
            bump();
          }}
        />
      )}
    </div>
  );
}
