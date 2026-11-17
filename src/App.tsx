/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage, PrivacyPage, TermsPage } from './pages/LegalPages';
import { WeddingPublicPage } from './pages/WeddingPublicPage';
import { CoupleAdminPage } from './pages/CoupleAdminPage';
import { SuperAdminPage } from './pages/SuperAdminPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <OfflineBanner />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/wedding/:slug" element={<WeddingPublicPage />} />
            <Route path="/wedding/:slug/admin" element={<CoupleAdminPage />} />
            <Route path="/super" element={<SuperAdminPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
