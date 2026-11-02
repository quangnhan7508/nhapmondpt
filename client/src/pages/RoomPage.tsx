import React, { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LobbyView } from '../components/lobby/LobbyView';
import { TableView } from '../components/table/TableView';
import { useGameSocketContext } from '../hooks/GameSocketContext';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';

/**
 * Slug phòng đấu:
 * - /room/:roomId (canonical)
 * - /room?id=XXX | /room?code=XXX (query)
 * - /room-id?id=XXX (alias đúng yêu cầu /room-id=?)
 */
export function resolveRoomCode(params: { roomId?: string }, search: URLSearchParams): string {
  const q = search.get('id') || search.get('code') || search.get('room') || '';
  return (params.roomId || q || '').toUpperCase();
}

export const RoomPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ roomId?: string }>();
  const [search] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { t } = useLang();
  const gs = useGameSocketContext();

  const code = resolveRoomCode(params, search);

  // Đang ở phòng khác với URL → chuẩn hóa URL theo phòng hiện tại
  useEffect(() => {
    if (gs.room && code && gs.room.id !== code && !gs.room.inGame) {
      // Nếu user mở link phòng khác trong khi đang ở phòng khác: giữ phòng hiện tại
      navigate(`/room/${gs.room.id}`, { replace: true });
    }
  }, [gs.room, code, navigate]);

  const handleBalanceUpdate = () => refreshUser();

  // Đang trong ván đấu → bàn chơi toàn màn hình
  if (gs.room && gs.player && gs.room.inGame) {
    if (!gs.gameState || !gs.player) {
      return (
        <div className="w-full py-24 flex flex-col items-center justify-center text-white gap-4 font-sans">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xl font-bold tracking-wide animate-pulse">Đang tải ván chơi...</p>
        </div>
      );
    }
    return (
      <TableView
        room={gs.room}
        player={gs.player}
        gameState={gs.gameState}
        seeFutureCards={gs.seeFutureCards}
        onCloseSeeFuture={() => gs.setSeeFutureCards(null)}
        alterFutureCards={gs.alterFutureCards}
        onCloseAlterFuture={() => gs.setAlterFutureCards(null)}
        onSendAction={gs.sendAction}
        onRestartGame={gs.restartGame}
        onLeaveRoom={() => {
          gs.leaveRoom();
          handleBalanceUpdate();
          navigate('/play');
        }}
        onSendMessage={gs.sendChatMessage}
      />
    );
  }

  // Đang ở phòng chờ khớp URL → hiển thị phòng chờ
  if (gs.room && gs.player && (!code || gs.room.id === code)) {
    return (
      <LobbyView
        room={gs.room}
        player={gs.player}
        connected={gs.connected}
        onCreateRoom={(name, avatar, userId, betAmount, gameType) => gs.createRoom(name, avatar, userId ?? user?.id, betAmount ?? 0, gameType)}
        onJoinRoom={(roomId, name, avatar, userId) => gs.joinRoom(roomId, name, avatar, userId ?? user?.id)}
        onAddBot={gs.addBot}
        onRemoveBot={gs.removeBot}
        onUpdateSettings={gs.updateSettings}
        onSetReady={gs.setReady}
        onStartGame={gs.startGame}
        onLeaveRoom={() => {
          gs.leaveRoom();
          handleBalanceUpdate();
          navigate('/play');
        }}
        onSendMessage={gs.sendChatMessage}
        errorMsg={gs.errorMsg}
      />
    );
  }

  // Chưa vào phòng → form vào phòng với mã điền sẵn từ URL
  return (
    <div className="flex flex-col gap-4">
      {code && (
        <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-sm text-center">
          {t('room.invite', { code })}
        </div>
      )}
      <LobbyView
        room={null}
        player={null}
        connected={gs.connected}
        onCreateRoom={(name, avatar, userId, betAmount) => gs.createRoom(name, avatar, userId ?? user?.id, betAmount)}
        onJoinRoom={(roomId, name, avatar, userId) => gs.joinRoom(roomId, name, avatar, userId ?? user?.id)}
        onAddBot={gs.addBot}
        onRemoveBot={gs.removeBot}
        onUpdateSettings={gs.updateSettings}
        onSetReady={gs.setReady}
        onStartGame={gs.startGame}
        onLeaveRoom={() => navigate('/play')}
        onSendMessage={gs.sendChatMessage}
        errorMsg={gs.errorMsg}
        initialJoinCode={code}
      />
    </div>
  );
};

export default RoomPage;
