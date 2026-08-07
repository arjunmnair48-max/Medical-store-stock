import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAssets, getItems } from '../storage';
import { daysUntil, EXPIRY_WARNING_DAYS, formatDate } from '../utils';

export default function Dashboard() {
  const items = useMemo(() => getItems(), []);
  const assets = useMemo(() => getAssets(), []);

  const medicines = items.filter((i) => i.category === 'Medicine');
  const disposables = items.filter((i) => i.category === 'Disposable');
  const lowStock = items.filter((i) => i.stock <= i.reorderLevel);
  const expiring = items.filter((i) => {
    const d = daysUntil(i.expiryDate);
    return d !== null && d <= EXPIRY_WARNING_DAYS;
  });
  const expired = expiring.filter((i) => (daysUntil(i.expiryDate) ?? 1) < 0);
  const needsAttentionAssets = assets.filter(
    (a) => a.condition === 'Needs Repair' || a.condition === 'Under Repair' || a.condition === 'Damaged',
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="desc">Overview of medicine, disposable and asset stock at NIPER Hajipur Medical Centre.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Medicines</div>
          <div className="value">{medicines.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Disposable Items</div>
          <div className="value">{disposables.length}</div>
        </div>
        <div className={`stat-card ${lowStock.length ? 'danger' : 'ok'}`}>
          <div className="label">Low / Reorder Stock</div>
          <div className="value">{lowStock.length}</div>
        </div>
        <div className={`stat-card ${expiring.length ? 'warn' : 'ok'}`}>
          <div className="label">Expiring within {EXPIRY_WARNING_DAYS} days</div>
          <div className="value">{expiring.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Permanent Assets</div>
          <div className="value">{assets.length}</div>
        </div>
        <div className={`stat-card ${needsAttentionAssets.length ? 'warn' : 'ok'}`}>
          <div className="label">Assets Needing Attention</div>
          <div className="value">{needsAttentionAssets.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/medicines">
            Manage Medicines &amp; Disposables
          </Link>
          <Link className="btn btn-primary" to="/assets">
            Manage Assets
          </Link>
          <Link className="btn" to="/reports">
            Printable Reports
          </Link>
          <Link className="btn" to="/backup">
            Backup Data
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
            Low Stock ({lowStock.length})
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-muted">No items below reorder level.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Stock</th>
                    <th>Reorder Level</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.slice(0, 8).map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td className="text-danger">{i.stock} {i.unit}</td>
                      <td>{i.reorderLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
            Expiry Watch ({expiring.length}) {expired.length > 0 && <span className="text-danger">- {expired.length} expired</span>}
          </h2>
          {expiring.length === 0 ? (
            <p className="text-muted">No items expiring soon.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.slice(0, 8).map((i) => {
                    const d = daysUntil(i.expiryDate) ?? 0;
                    return (
                      <tr key={i.id}>
                        <td>{i.name}</td>
                        <td>{i.batchNo || '-'}</td>
                        <td className={d < 0 ? 'text-danger' : 'text-warning'}>{formatDate(i.expiryDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
