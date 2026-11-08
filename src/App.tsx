import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { PresenterBar } from './components/PresenterBar';
import { RoleGate } from './components/RoleGate';
import { Toaster } from './components/toast';
import { VerifyPage } from './components/VerifyPage';
import { AdminPage } from './roles/admin/AdminPage';
import { ChemistPage } from './roles/chemist/ChemistPage';
import { DemoBarcodes } from './roles/chemist/DemoBarcodes';
import { CustomerPage } from './roles/customer/CustomerPage';
import { RiderPage } from './roles/rider/RiderPage';

const PANES = [
  { role: 'customer', label: 'Customer' },
  { role: 'chemist', label: 'Chemist' },
  { role: 'rider', label: 'Rider' },
  { role: 'admin', label: 'Admin' },
] as const;

/** All four roles side by side. Each pane is its own page, so it syncs exactly like a separate tab. */
function Presenter() {
  return (
    <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-4">
      {PANES.map((p) => (
        <section key={p.role} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <h2 className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{p.label}</h2>
          <iframe title={p.label} src={`/${p.role}?embed=1`} className="h-[78vh] w-full border-0" />
        </section>
      ))}
    </div>
  );
}

export default function App() {
  // Embedded panes (inside /presenter) hide the bar; the presenter bar above controls them all.
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const embedded = params.get('embed') === '1' || pathname === '/demo-barcodes' || pathname === '/verify';

  return (
    <>
      {!embedded && <PresenterBar />}
      <Routes>
        <Route path="/" element={<Navigate to="/presenter" replace />} />
        <Route path="/customer" element={<RoleGate role="customer">{(u) => <CustomerPage user={u} />}</RoleGate>} />
        <Route path="/chemist" element={<RoleGate role="chemist">{(u) => <ChemistPage user={u} />}</RoleGate>} />
        <Route path="/rider" element={<RoleGate role="rider" dark>{(u) => <RiderPage user={u} />}</RoleGate>} />
        <Route path="/admin" element={<RoleGate role="admin">{(u) => <AdminPage user={u} />}</RoleGate>} />
        <Route path="/presenter" element={<Presenter />} />
        <Route path="/demo-barcodes" element={<DemoBarcodes />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="*" element={<Navigate to="/presenter" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
