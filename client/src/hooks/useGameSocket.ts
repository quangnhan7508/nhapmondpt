import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnyMaskedGameState, EKCard, GameType, RoomPlayer, RoomSettings, RoomState } from '../types/game';
import { sounds } from '../utils/sound';

export function useGameSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [player, setPlayer] = useState<RoomPlayer | null>(null);
  const [gameState, setGameState] = useState<AnyMaskedGameState | null>(null);
  const [seeFutureCards, setSeeFutureCards] = useState<EKCard[] | null>(null);
  const [alterFutureCards, setAlterFutureCards] = useState<EKCard[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sessionIdRef = useRef<string>('');
  const roomRef = useRef<RoomState | null>(null);
  const playerRef = useRef<RoomPlayer | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    // 1. Retrieve or generate persistent sessionId
    let storedSessionId = localStorage.getItem('omnideck_session_id');
    if (!storedSessionId) {
      storedSessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('omnideck_session_id', storedSessionId);
    }
    sessionIdRef.current = storedSessionId;

    // 2. Connect to Socket.io
    const isDev = window.location.port === '5173';
    const serverUrl = isDev ? 'http://localhost:3000' : window.location.origin;

    const s = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      setConnected(true);
      // Try to reconnect with existing session
      s.emit('reconnect_session', { sessionId: sessionIdRef.current }, (res: any) => {
        if (res && res.success && res.room && res.player) {
          setRoom(res.room);
          setPlayer(res.player);
          roomRef.current = res.room;
          playerRef.current = res.player;
        }
      });
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('room_updated', (updatedRoom: RoomState) => {
      const currentSession = sessionIdRef.current;
      const currentMyId = playerRef.current?.id;
      const me = updatedRoom.players.find(p =>
        (p.sessionId && p.sessionId === currentSession) ||
        (currentMyId && p.id === currentMyId)
      );
      if (me) {
        setRoom(updatedRoom);
        setPlayer(me);
        roomRef.current = updatedRoom;
        playerRef.current = me;
      } else {
        // Player is not in this room anymore (left or kicked)
        if (roomRef.current && roomRef.current.id === updatedRoom.id) {
          setRoom(null);
          setPlayer(null);
          setGameState(null);
          setSeeFutureCards(null);
          roomRef.current = null;
          playerRef.current = null;
        }
      }
    });

    s.on('game_state', (state: AnyMaskedGameState) => {
      setGameState(state);
    });

    s.on('ek_see_future', (data: { cards: EKCard[] }) => {
      setSeeFutureCards(data.cards);
    });

    s.on('ek_alter_future', (data: { cards: EKCard[] }) => {
      setAlterFutureCards(data.cards);
    });

    s.on('balance_updated', (data: { balance: number }) => {
      window.dispatchEvent(new CustomEvent('omnideck:balance_updated', { detail: data }));
    });

    s.on('wallet:received', (data: any) => {
      window.dispatchEvent(new CustomEvent('omnideck:wallet_received', { detail: data }));
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const createRoom = (playerName: string, avatar: string, userId?: string, betAmount?: number, gameType?: GameType) => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('create_room', {
      sessionId: sessionIdRef.current,
      playerName,
      avatar,
      userId,
      betAmount,
      gameType
    }, (res: any) => {
      if (res.success) {
        setRoom(res.room);
        setPlayer(res.player);
        roomRef.current = res.room;
        playerRef.current = res.player;
      } else {
        setErrorMsg(res.message || 'Không thể tạo phòng.');
      }
    });
  };

  const joinRoom = (roomId: string, playerName: string, avatar: string, userId?: string) => {
    if (!socket) return;
    setErrorMsg(null);
    socket.emit('join_room', {
      roomId,
      sessionId: sessionIdRef.current,
      playerName,
      avatar,
      userId
    }, (res: any) => {
      if (res.success) {
        setRoom(res.room);
        setPlayer(res.player);
        roomRef.current = res.room;
        playerRef.current = res.player;
      } else {
        setErrorMsg(res.message || 'Không thể tham gia phòng.');
      }
    });
  };

  const addBot = () => {
    if (!socket || !room || !player) return;
    socket.emit('add_bot', { roomId: room.id, requesterId: player.id }, (res: any) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  const removeBot = (targetPlayerId: string) => {
    if (!socket || !room || !player) return;
    socket.emit('remove_bot', { roomId: room.id, requesterId: player.id, targetPlayerId }, (res: any) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  const updateSettings = (newSettings: Partial<RoomSettings>) => {
    if (!socket || !room || !player) return;
    socket.emit('update_settings', { roomId: room.id, requesterId: player.id, settings: newSettings }, (res: any) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  const setReady = (isReady: boolean) => {
    if (!socket || !room || !player) return;
    socket.emit('set_ready', { roomId: room.id, playerId: player.id, isReady }, (res: any) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  const startGame = () => {
    if (!socket || !room || !player) return;
    socket.emit('start_game', { roomId: room.id, requesterId: player.id }, (res: any) => {
      if (!res.success) setErrorMsg(res.message);
    });
  };

  const restartGame = () => {
    if (!socket || !room || !player) return;
    socket.emit('restart_game', { roomId: room.id, requesterId: player.id }, (res: any) => {
      if (res.success) {
        setGameState(null);
        setSeeFutureCards(null);
      } else {
        setErrorMsg(res.message);
      }
    });
  };

  const sendAction = (action: any) => {
    if (!socket || !room || !player) return;
    sounds.playCardSnap();
    socket.emit('game_action', { roomId: room.id, playerId: player.id, action }, (res: any) => {
      if (res && !res.success) {
        setErrorMsg(res.message);
      }
    });
  };

  const sendChatMessage = (text: string) => {
    if (!socket || !room || !player) return;
    socket.emit('send_chat', {
      roomId: room.id,
      senderId: player.id,
      senderName: player.name,
      text
    });
  };

  const leaveRoom = () => {
    if (socket && room && player) {
      socket.emit('leave_room', {
        roomId: room.id,
        playerId: player.id
      });
    }
    // Generate a fresh session ID so the server won't auto-reconnect this client to the abandoned room
    const freshSession = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    sessionIdRef.current = freshSession;
    localStorage.setItem('omnideck_session_id', freshSession);

    setRoom(null);
    setPlayer(null);
    setGameState(null);
    setSeeFutureCards(null);
    setAlterFutureCards(null);
    setErrorMsg(null);
  };

  return {
    socket,
    connected,
    room,
    player,
    gameState,
    seeFutureCards,
    setSeeFutureCards,
    alterFutureCards,
    setAlterFutureCards,
    errorMsg,
    setErrorMsg,
    createRoom,
    joinRoom,
    addBot,
    removeBot,
    updateSettings,
    setReady,
    startGame,
    restartGame,
    sendAction,
    sendChatMessage,
    leaveRoom
  };
}
