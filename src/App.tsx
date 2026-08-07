import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MedicinesPage from './pages/MedicinesPage';
import AssetsPage from './pages/AssetsPage';
import ReportsPage from './pages/ReportsPage';
import PrintRegister from './pages/PrintRegister';
import BackupPage from './pages/BackupPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/print/:reportType" element={<PrintRegister />} />
        <Route path="/print/:reportType/:itemId" element={<PrintRegister />} />
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/medicines" element={<MedicinesPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/backup" element={<BackupPage />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </HashRouter>
  );
}
