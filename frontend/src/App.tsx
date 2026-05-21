import { useEffect } from 'react';
import { useRoomStore } from './store/useRoomStore';
import { wsController } from './websocket/socketClient';
import { AuthPage } from './pages/AuthPage';
import { LobbyPage } from './pages/LobbyPage';
import { GameRoom } from './pages/GameRoom';
import './App.css';

function App() {
  const user = useRoomStore((state) => state.user);
  const room = useRoomStore((state) => state.room);
  const syncRoom = useRoomStore((state) => state.syncRoom);

  // Auto-restore room session on page refresh/initial mount
  useEffect(() => {
    const savedRoomCode = localStorage.getItem('battle_room_code');
    if (user && savedRoomCode) {
      wsController.connect(savedRoomCode, user.token);
      syncRoom(savedRoomCode, user.token);
    }
  }, [user]);

  // Persist current room code to localStorage when room state changes
  useEffect(() => {
    if (room) {
      localStorage.setItem('battle_room_code', room.code);
    } else {
      localStorage.removeItem('battle_room_code');
    }
  }, [room]);

  // Routing based on application state
  if (!user) {
    return <AuthPage />;
  }

  if (!room) {
    return <LobbyPage />;
  }

  return <GameRoom />;
}

export default App;
