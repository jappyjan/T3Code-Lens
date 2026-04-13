import { BrowserRouter, Routes, Route } from 'react-router';
import { MainPage } from './pages/MainPage';
import { SettingsPage } from './pages/SettingsPage';

// Vite injects the base path (e.g. "/T3Code-Lens/") at build time.
// Strip the trailing slash so React Router's basename works correctly.
const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '/';

export function App() {
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
