import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LobbyView } from '../components/lobby/LobbyView';
import { useGameSocketContext } from '../hooks/GameSocketContext';
import { useAuth } from '../context/AuthContext';

/** Slug /play — Vào Phòng Đấu (tạo/vào phòng, cược bắt buộc). */
export const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const gs = useGameSocketContext();

  // Tạo/vào phòng thành công → chuyển sang slug phòng /room/:id
  useEffect(() => {
    if (gs.room) navigate(`/room/${gs.room.id}`, { replace: true });
  }, [gs.room, navigate]);

  return (
    <LobbyView
      room={null}
      player={null}
      connected={gs.connected}
      onCreateRoom={(name, avatar, userId, betAmount, gameType) => gs.createRoom(name, avatar, userId ?? user?.id, betAmount ?? 0, gameType)}
      onJoinRoom={(roomId, name, avatar, userId) => gs.joinRoom(roomId, name, avatar, userId ?? user?.id)}
      onAddBot={gs.addBot}
      onRemoveBot={gs.removeBot}
      onUpdateSettings={gs.updateSettings}
      onSetReady={gs.setReady}
      onStartGame={gs.startGame}
      onLeaveRoom={() => navigate('/dashboard')}
      onSendMessage={gs.sendChatMessage}
      errorMsg={gs.errorMsg}
    />
  );
};

export default PlayPage;
