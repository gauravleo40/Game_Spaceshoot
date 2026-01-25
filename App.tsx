import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, FallingObject, Bullet } from './types';
import {
  GAME_DURATION_SECONDS,
  PLAYER_SPEED,
  OBJECT_VERTICAL_SPEED,
  OBJECT_SPAWN_INTERVAL_MS,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  OBJECT_SIZE,
  OBSTACLE_EMOJIS,
  BULLET_SPEED,
  BULLET_WIDTH,
  BULLET_HEIGHT,
  POWER_UP_EMOJIS,
} from './constants';

// --- UI Components (defined outside App to prevent re-creation on re-renders) ---

interface StartScreenProps {
  onPlay: () => void;
}
const StartScreen: React.FC<StartScreenProps> = ({ onPlay }) => (
  <div className="text-center bg-slate-800 p-8 md:p-12 rounded-2xl shadow-2xl border-2 border-cyan-500/50 w-full max-w-lg animate-[fadeIn_0.5s_ease-out]">
    <h1 className="text-5xl md:text-6xl font-bold mb-4 text-cyan-400 drop-shadow-[0_2px_2px_rgba(0,255,255,0.4)]">Rock Blaster!</h1>
    <p className="text-lg md:text-xl mb-6 text-slate-300">Use Arrow Keys to move and Spacebar to shoot the falling rocks. Avoid touching them!</p>
    <p className="text-md md:text-lg mb-8 text-slate-400">Press 'P' to Pause/Resume. Press 'Q' to Quit.</p>
    <button
      onClick={onPlay}
      className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-4 px-10 rounded-full text-2xl transition-transform transform hover:scale-105 shadow-lg shadow-cyan-500/50"
    >
      Play
    </button>
  </div>
);

interface GameOverScreenProps {
  score: number;
  onPlayAgain: () => void;
}
const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, onPlayAgain }) => (
  <div className="text-center bg-slate-800 p-8 md:p-12 rounded-2xl shadow-2xl border-2 border-amber-500/50 w-full max-w-lg animate-[fadeIn_0.5s_ease-out]">
    <h2 className="text-5xl md:text-6xl font-bold mb-4 text-amber-400 drop-shadow-[0_2px_2px_rgba(255,191,0,0.4)]">Game Over</h2>
    <p className="text-3xl mb-2 text-slate-300">Your Final Score:</p>
    <p className="text-7xl font-bold mb-8 text-white">{score}</p>
    <button
      onClick={onPlayAgain}
      className="bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 px-10 rounded-full text-2xl transition-transform transform hover:scale-105 shadow-lg shadow-amber-500/50"
    >
      Play Again
    </button>
  </div>
);


// --- Main App Component ---

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Start);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(GAME_DURATION_SECONDS);
  // Add y-axis position for up/down movement
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number }>({ x: 50, y: 85 });
  const [objects, setObjects] = useState<FallingObject[]>([]);
  // Add state for bullets
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [doubleShot, setDoubleShot] = useState<boolean>(false);
  
  const gameLoopRef = useRef<number>();
  const objectSpawnerRef = useRef<number>();
  const timerRef = useRef<number>();

  const resetGame = useCallback(() => {
    setScore(0);
    setTimeLeft(0); // Start from 0
    setPlayerPosition({ x: 50 - PLAYER_WIDTH / 2, y: 100 - PLAYER_HEIGHT * 1.5 });
    setObjects([]);
    setBullets([]); // Reset bullets
    setDoubleShot(false);
  }, []);
  
  const startGame = useCallback(() => {
    resetGame();
    setGameState(GameState.Playing);
  }, [resetGame]);

  const gameOver = useCallback(() => {
    setGameState(GameState.GameOver);
  }, []);
  
  // Game timer countdown (for display only, game ends on 'q' press)
  useEffect(() => {
    if (gameState === GameState.Playing) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Object spawner (now pauses correctly)
  useEffect(() => {
    if (gameState === GameState.Playing) {
      objectSpawnerRef.current = window.setInterval(() => {
        const isPowerUp = Math.random() < 0.2; // 20% chance for power-up
        const emoji = isPowerUp
          ? POWER_UP_EMOJIS[Math.floor(Math.random() * POWER_UP_EMOJIS.length)]
          : OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
        const newObject: FallingObject = {
          id: Date.now() + Math.random(),
          x: Math.random() * (100 - OBJECT_SIZE),
          y: -OBJECT_SIZE, // Start just above the screen
          emoji,
          type: isPowerUp ? 'powerup' : 'obstacle',
        };
        setObjects(prev => [...prev, newObject]);
      }, OBJECT_SPAWN_INTERVAL_MS);
    }
    return () => {
      if (objectSpawnerRef.current) clearInterval(objectSpawnerRef.current);
    };
  }, [gameState]);

  // Player input handler for movement, shooting, and pausing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow input only when game is active
      if (gameState !== GameState.Playing && gameState !== GameState.Paused) return;

      // Pause/Resume functionality
      if (e.key.toLowerCase() === 'p') {
        setGameState(prev => {
          if (prev === GameState.Playing) return GameState.Paused;
          if (prev === GameState.Paused) return GameState.Playing;
          return prev;
        });
        return; // Stop further processing
      }

      // End game functionality
      if (e.key.toLowerCase() === 'q') {
        gameOver();
        return;
      }

      // Do not process movement/shooting if paused
      if (gameState === GameState.Paused) return;

      if (e.key === ' ') { // Spacebar to shoot
        e.preventDefault();
        const bulletX = playerPosition.x + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2;
        const newBullets: Bullet[] = [
          {
            id: Date.now(),
            x: bulletX,
            y: playerPosition.y,
          },
        ];
        if (doubleShot) {
          newBullets.push({
            id: Date.now() + 1,
            x: bulletX - BULLET_WIDTH, // Left bullet
            y: playerPosition.y,
          });
          newBullets.push({
            id: Date.now() + 2,
            x: bulletX + BULLET_WIDTH, // Right bullet
            y: playerPosition.y,
          });
        }
        setBullets(prev => [...prev, ...newBullets]);
      } else {
        setPlayerPosition(prev => {
          let newX = prev.x;
          let newY = prev.y;
          if (e.key === 'ArrowLeft') newX -= PLAYER_SPEED;
          else if (e.key === 'ArrowRight') newX += PLAYER_SPEED;
          else if (e.key === 'ArrowUp') newY -= PLAYER_SPEED; // Up movement
          else if (e.key === 'ArrowDown') newY += PLAYER_SPEED; // Down movement

          // Clamp position to stay within game area boundaries
          const clampedX = Math.max(0, Math.min(100 - PLAYER_WIDTH, newX));
          const clampedY = Math.max(0, Math.min(100 - PLAYER_HEIGHT, newY));
          return { x: clampedX, y: clampedY };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, playerPosition.x, playerPosition.y]);

  // Main game loop using requestAnimationFrame
  const gameLoop = useCallback(() => {
    // 1. Detect collisions between bullets and objects
    const hitObjectIds = new Set<number>();
    const hitBulletIds = new Set<number>();
    let scoreIncrease = 0;
    
    // Using state directly is fine here because this function is re-created when state changes
    for (const bullet of bullets) {
        for (const obj of objects) {
            // AABB collision detection
            if (
                bullet.x < obj.x + OBJECT_SIZE &&
                bullet.x + BULLET_WIDTH > obj.x &&
                bullet.y < obj.y + OBJECT_SIZE &&
                bullet.y + BULLET_HEIGHT > obj.y
            ) {
                hitObjectIds.add(obj.id);
                hitBulletIds.add(bullet.id);
                scoreIncrease++;
            }
        }
    }

    if (scoreIncrease > 0) {
        setScore(s => s + scoreIncrease);
    }

    // 2. Detect collisions between player and objects
    const collectedPowerUps = new Set<number>();
    for (const obj of objects) {
        if (
            playerPosition.x < obj.x + OBJECT_SIZE &&
            playerPosition.x + PLAYER_WIDTH > obj.x &&
            playerPosition.y < obj.y + OBJECT_SIZE &&
            playerPosition.y + PLAYER_HEIGHT > obj.y
        ) {
            if (obj.type === 'obstacle') {
                gameOver();
                return; // Stop the game loop
            } else if (obj.type === 'powerup') {
                collectedPowerUps.add(obj.id);
                setDoubleShot(true); // Activate double shot
            }
        }
    }

    // 3. Update objects: filter hits, collected power-ups, move down, filter off-screen
    setObjects(prev =>
        prev
            .filter(obj => !hitObjectIds.has(obj.id) && !collectedPowerUps.has(obj.id))
            .map(obj => ({ ...obj, y: obj.y + OBJECT_VERTICAL_SPEED }))
            .filter(obj => obj.y < 100)
    );

    // 4. Update bullets: filter hits, move up, filter off-screen
    setBullets(prev =>
        prev
            .filter(bullet => !hitBulletIds.has(bullet.id))
            .map(bullet => ({ ...bullet, y: bullet.y - BULLET_SPEED }))
            .filter(bullet => bullet.y + BULLET_HEIGHT > 0)
    );

  }, [bullets, objects, playerPosition.x, playerPosition.y, gameOver]);

  // Effect to run the game loop
  useEffect(() => {
    if (gameState === GameState.Playing) {
      const tick = () => {
        gameLoop();
        gameLoopRef.current = requestAnimationFrame(tick);
      }
      gameLoopRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, gameLoop]);
  
  const renderGameScreen = () => (
    <div className="w-full h-full max-w-2xl aspect-[3/4] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg shadow-inner shadow-black/50 overflow-hidden relative border-4 border-slate-700">
      {/* Game Paused Overlay */}
      {gameState === GameState.Paused && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
            <h2 className="text-4xl font-bold text-white animate-pulse">Game Paused</h2>
        </div>
      )}
      {/* Game area */}
      <div className="w-full h-full relative">
        {/* Player */}
        <div
          className="absolute flex items-center justify-center text-5xl md:text-6xl"
          style={{
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
            width: `${PLAYER_WIDTH}%`,
            height: `${PLAYER_HEIGHT}%`,
          }}
        >
          <span role="img" aria-label="player" className="drop-shadow-lg">🚀</span>
        </div>

        {/* Falling Objects */}
        {objects.map(obj => (
          <div
            key={obj.id}
            className="absolute flex items-center justify-center text-3xl md:text-4xl"
            style={{
              left: `${obj.x}%`,
              top: `${obj.y}%`,
              width: `${OBJECT_SIZE}%`,
              height: `${OBJECT_SIZE}%`,
            }}
          >
            <span role="img" aria-label="obstacle" className="drop-shadow-md">{obj.emoji}</span>
          </div>
        ))}

        {/* Bullets */}
        {bullets.map(bullet => (
            <div
                key={bullet.id}
                className="absolute bg-yellow-400 rounded-sm shadow-lg shadow-yellow-400/50"
                style={{
                    left: `${bullet.x}%`,
                    top: `${bullet.y}%`,
                    width: `${BULLET_WIDTH}%`,
                    height: `${BULLET_HEIGHT}%`,
                }}
            />
        ))}
      </div>
      {/* HUD */}
      <div className="absolute top-2 left-2 right-2 flex justify-between text-2xl font-bold p-2 bg-black/30 rounded-md backdrop-blur-sm">
        <span className="text-amber-400">Score: {score}</span>
        <span className="text-cyan-400">Time: {timeLeft}</span>
      </div>
    </div>
  );
  
  const renderContent = () => {
    switch (gameState) {
      case GameState.Playing:
      case GameState.Paused:
        return renderGameScreen();
      case GameState.GameOver:
        return <GameOverScreen score={score} onPlayAgain={startGame} />;
      case GameState.Start:
      default:
        return <StartScreen onPlay={startGame} />;
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-900 font-sans p-4 select-none">
      {renderContent()}
    </main>
  );
};

export default App;
