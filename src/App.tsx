import { Routes, Route } from 'react-router';
import { MainPage } from './pages/MainPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
