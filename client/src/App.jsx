import React from 'react';
import { useHashRoute } from './hooks.js';
import { Navbar } from './components/Navbar.jsx';
import { JoinScreen } from './components/JoinScreen.jsx';
import { StaffScreen } from './components/StaffScreen.jsx';
import { BoardScreen } from './components/BoardScreen.jsx';

export function App() {
  const [currentHash, navigate] = useHashRoute('#/join');

  const isBoard = currentHash === '#/board';

  return (
    <div className={`app-layout ${isBoard ? 'board-mode' : ''}`}>
      <Navbar currentHash={currentHash} onNavigate={navigate} />

      <main className="main-content">
        {currentHash === '#/join' && <JoinScreen />}
        {currentHash === '#/staff' && <StaffScreen />}
        {currentHash === '#/board' && <BoardScreen />}
      </main>
    </div>
  );
}

export default App;
