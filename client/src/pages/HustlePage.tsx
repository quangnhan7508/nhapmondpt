import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkView } from '../components/work/WorkView';
import { AuthModal } from '../components/auth/AuthModal';
import { useGameSocketContext } from '../hooks/GameSocketContext';
import { useAuth } from '../context/AuthContext';

/** Slug /hustle — Đi Làm kiếm coins. */
export const HustlePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { socket } = useGameSocketContext();
  const [showAuth, setShowAuth] = useState(false);

  const handleBalanceUpdate = useCallback(
    (_newBalance: number) => {
      refreshUser();
    },
    [refreshUser]
  );

  return (
    <>
      {showAuth && <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />}
      <WorkView
        user={user}
        socket={socket}
        onBack={() => navigate('/dashboard')}
        onBalanceUpdate={handleBalanceUpdate}
        onOpenAuth={() => setShowAuth(true)}
      />
    </>
  );
};

export default HustlePage;
