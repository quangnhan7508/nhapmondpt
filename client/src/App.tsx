import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GameSocketProvider } from './hooks/GameSocketContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageContext';
import { AppShell } from './components/layout/AppShell';
import { PlayPage } from './pages/PlayPage';
import { RoomPage } from './pages/RoomPage';
import { CasesPage } from './pages/CasesPage';
import { UpgradePage } from './pages/UpgradePage';
import { InventoryPage } from './pages/InventoryPage';

/**
 * OmniDeck Arena — URL Router.
 * - /dashboard ......... Navigation Panel (trung tâm mọi dịch vụ)
 * - /play .............. Vào Phòng Đấu (tạo/vào phòng cược)
 * - /room/:roomId ...... Phòng chờ + bàn đấu (mã phòng)
 * - /room?id=XXX ....... Deep-link phòng (query)
 * - /room-id?id=XXX .... Alias đúng yêu cầu /room-id=?
 * - /hustle ............ Đi Làm kiếm coins
 * - /leaderboard ....... Bảng xếp hạng
 * - /cases ............. Mở Hòm CS2
 * - /upgrade ........... Nâng Cấp SkinClub
 * - /inventory ......... Kho Đồ Skin
 * - /tai-xiu /mines /goals ... Casino minh bạch
 */
export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
      <AuthProvider>
        <GameSocketProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/play" replace />} />
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Navigate to="/play" replace />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/room" element={<RoomPage />} />
              <Route path="/room/:roomId" element={<RoomPage />} />
              <Route path="/room-id" element={<RoomPage />} />
              <Route path="/leaderboard" element={<Navigate to="/play?view=rank" replace />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              {/* Giữ tương thích điều hướng cũ */}
              <Route path="/lobby" element={<Navigate to="/play" replace />} />
              <Route path="/work" element={<Navigate to="/hustle" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </GameSocketProvider>
    </AuthProvider>
      </LanguageProvider>
  </ErrorBoundary>
  );
};

export default App;
