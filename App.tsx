import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, FallingObject, Bullet, PowerUpType, Explosion, Particle } from './types';
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
  POWER_UP_TYPES,
  POWER_UP_DURATION_MS,
  EXPLOSION_DURATION_MS,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME_MS,
  SCREEN_SHAKE_DURATION_MS,
  BULLET_COOLDOWN_MS,
  RAPID_FIRE_COOLDOWN_MS,
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


// --- Sound Effects System ---
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    }
    // Resume audio context if suspended (required after user interaction)
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {
        // Silently fail if resume doesn't work
      });
    }
    return audioContext;
  } catch (error) {
    // AudioContext not supported or failed to create
    return null;
  }
};

const createSound = (frequency: number, duration: number, type: 'sine' | 'square' | 'sawtooth' = 'sine') => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return; // Audio not supported
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (error) {
    // Silently fail if sound creation fails
  }
};

const playShootSound = () => createSound(800, 0.1, 'square');
const playHitSound = () => createSound(200, 0.2, 'square');
const playPowerUpSound = () => {
  createSound(400, 0.1, 'sine');
  setTimeout(() => createSound(600, 0.1, 'sine'), 100);
  setTimeout(() => createSound(800, 0.1, 'sine'), 200);
};
const playGameOverSound = () => {
  createSound(150, 0.3, 'sawtooth');
  setTimeout(() => createSound(100, 0.3, 'sawtooth'), 300);
};

// --- Main App Component ---

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Start);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(GAME_DURATION_SECONDS);
  const [playerPosition, setPlayerPosition] = useState<{ x: number; y: number }>({ x: 50, y: 85 });
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [screenShake, setScreenShake] = useState<number>(0);
  
  // Power-up states with timers
  const [activePowerUps, setActivePowerUps] = useState<Map<PowerUpType, number>>(new Map());
  const [lastShotTime, setLastShotTime] = useState<number>(0);
  
  const gameLoopRef = useRef<number>();
  const objectSpawnerRef = useRef<number>();
  const timerRef = useRef<number>();
  const powerUpTimersRef = useRef<Map<PowerUpType, number>>(new Map());

  // Helper function to create explosion effect
  const createExplosion = useCallback((x: number, y: number) => {
    const explosionId = Date.now() + Math.random();
    setExplosions(prev => [...prev, { id: explosionId, x, y, lifetime: EXPLOSION_DURATION_MS }]);
    
    // Create particles
    const newParticles: Particle[] = [];
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#FFE66D'];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
      const speed = 0.5 + Math.random() * 0.5;
      newParticles.push({
        id: explosionId * 1000 + i,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: PARTICLE_LIFETIME_MS,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Helper function to activate power-up
  const activatePowerUp = useCallback((type: PowerUpType) => {
    setActivePowerUps(prev => {
      const newMap = new Map(prev);
      newMap.set(type, Date.now() + POWER_UP_DURATION_MS[type]);
      return newMap;
    });
    playPowerUpSound();
  }, []);

  // Helper function to check if power-up is active
  const isPowerUpActive = useCallback((type: PowerUpType): boolean => {
    const expiry = activePowerUps.get(type);
    return expiry !== undefined && expiry > Date.now();
  }, [activePowerUps]);

  const resetGame = useCallback(() => {
    setScore(0);
    setTimeLeft(0);
    setPlayerPosition({ x: 50 - PLAYER_WIDTH / 2, y: 100 - PLAYER_HEIGHT * 1.5 });
    setObjects([]);
    setBullets([]);
    setExplosions([]);
    setParticles([]);
    setScreenShake(0);
    setActivePowerUps(new Map());
    setLastShotTime(0);
    powerUpTimersRef.current.clear();
  }, []);
  
  const startGame = useCallback(() => {
    resetGame();
    setGameState(GameState.Playing);
  }, [resetGame]);

  const gameOver = useCallback(() => {
    playGameOverSound();
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

  // Object spawner with multiple power-up types
  useEffect(() => {
    if (gameState === GameState.Playing) {
      const isSlowMotion = isPowerUpActive('slowMotion');
      const spawnInterval = isSlowMotion 
        ? OBJECT_SPAWN_INTERVAL_MS * 1.5 
        : OBJECT_SPAWN_INTERVAL_MS;
      
      objectSpawnerRef.current = window.setInterval(() => {
        const isPowerUp = Math.random() < 0.2; // 20% chance for power-up
        let emoji: string;
        let powerUpType: PowerUpType | undefined;
        
        if (isPowerUp) {
          const powerUpTypes = Object.keys(POWER_UP_TYPES) as PowerUpType[];
          powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
          emoji = POWER_UP_TYPES[powerUpType];
        } else {
          emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
        }
        
        const newObject: FallingObject = {
          id: Date.now() + Math.random(),
          x: Math.random() * (100 - OBJECT_SIZE),
          y: -OBJECT_SIZE,
          emoji,
          type: isPowerUp ? 'powerup' : 'obstacle',
          powerUpType,
        };
        setObjects(prev => [...prev, newObject]);
      }, spawnInterval);
      
      return () => {
        if (objectSpawnerRef.current) clearInterval(objectSpawnerRef.current);
      };
    }
  }, [gameState, isPowerUpActive]);

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
        const now = Date.now();
        const cooldown = isPowerUpActive('rapidFire') ? RAPID_FIRE_COOLDOWN_MS : BULLET_COOLDOWN_MS;
        
        if (now - lastShotTime < cooldown) return;
        
        setLastShotTime(now);
        playShootSound();
        
        const bulletX = playerPosition.x + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2;
        const newBullets: Bullet[] = [
          {
            id: Date.now(),
            x: bulletX,
            y: playerPosition.y,
          },
        ];
        
        if (isPowerUpActive('doubleShot')) {
          newBullets.push({
            id: Date.now() + 1,
            x: bulletX - BULLET_WIDTH * 1.5,
            y: playerPosition.y,
          });
          newBullets.push({
            id: Date.now() + 2,
            x: bulletX + BULLET_WIDTH * 1.5,
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
  }, [gameState, playerPosition.x, playerPosition.y, lastShotTime, isPowerUpActive, gameOver]);

  // Main game loop using requestAnimationFrame
  const gameLoop = useCallback(() => {
    const speedMultiplier = isPowerUpActive('slowMotion') ? 0.5 : 1;
    
    // 1. Detect collisions between bullets and objects
    const hitObjectIds = new Set<number>();
    const hitBulletIds = new Set<number>();
    let scoreIncrease = 0;
    
    for (const bullet of bullets) {
        for (const obj of objects) {
            if (obj.type === 'obstacle') {
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
                    playHitSound();
                    createExplosion(obj.x + OBJECT_SIZE / 2, obj.y + OBJECT_SIZE / 2);
                }
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
                // Check if shield is active
                if (!isPowerUpActive('shield')) {
                    setScreenShake(SCREEN_SHAKE_DURATION_MS);
                    gameOver();
                    return;
                } else {
                    // Shield protects, remove obstacle
                    hitObjectIds.add(obj.id);
                    playHitSound();
                    createExplosion(obj.x + OBJECT_SIZE / 2, obj.y + OBJECT_SIZE / 2);
                }
            } else if (obj.type === 'powerup' && obj.powerUpType) {
                collectedPowerUps.add(obj.id);
                activatePowerUp(obj.powerUpType);
            }
        }
    }

    // 3. Update objects: filter hits, collected power-ups, move down, filter off-screen
    setObjects(prev =>
        prev
            .filter(obj => !hitObjectIds.has(obj.id) && !collectedPowerUps.has(obj.id))
            .map(obj => ({ ...obj, y: obj.y + OBJECT_VERTICAL_SPEED * speedMultiplier }))
            .filter(obj => obj.y < 100)
    );

    // 4. Update bullets: filter hits, move up, filter off-screen
    setBullets(prev =>
        prev
            .filter(bullet => !hitBulletIds.has(bullet.id))
            .map(bullet => ({ ...bullet, y: bullet.y - BULLET_SPEED }))
            .filter(bullet => bullet.y + BULLET_HEIGHT > 0)
    );

    // 5. Update explosions
    setExplosions(prev => 
        prev
            .map(exp => ({ ...exp, lifetime: exp.lifetime - 16 }))
            .filter(exp => exp.lifetime > 0)
    );

    // 6. Update particles
    setParticles(prev =>
        prev
            .map(particle => ({
                ...particle,
                x: particle.x + particle.vx,
                y: particle.y + particle.vy,
                lifetime: particle.lifetime - 16,
            }))
            .filter(particle => particle.lifetime > 0)
    );

    // 7. Update screen shake
    setScreenShake(prev => prev > 0 ? Math.max(0, prev - 16) : 0);

    // 8. Clean up expired power-ups
    setActivePowerUps(prev => {
      const now = Date.now();
      const newMap = new Map<PowerUpType, number>();
      for (const [type, expiry] of prev.entries()) {
        if (expiry > now) {
          newMap.set(type, expiry);
        }
      }
      return newMap.size !== prev.size ? newMap : prev;
    });

  }, [bullets, objects, playerPosition, gameOver, createExplosion, activatePowerUp, isPowerUpActive]);

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
  
  const renderGameScreen = () => {
    const shakeX = screenShake > 0 ? (Math.random() - 0.5) * 10 : 0;
    const shakeY = screenShake > 0 ? (Math.random() - 0.5) * 10 : 0;
    
    return (
      <div 
        className="w-full h-full max-w-2xl aspect-[3/4] bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg shadow-inner shadow-black/50 overflow-hidden relative border-4 border-slate-700 transition-transform duration-75"
        style={{
          transform: `translate(${shakeX}px, ${shakeY}px)`,
        }}
      >
        {/* Game Paused Overlay */}
        {gameState === GameState.Paused && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
              <h2 className="text-4xl font-bold text-white animate-pulse">Game Paused</h2>
          </div>
        )}
        {/* Game area */}
        <div className="w-full h-full relative">
          {/* Player with shield effect */}
          <div
            className="absolute flex items-center justify-center text-5xl md:text-6xl"
            style={{
              left: `${playerPosition.x}%`,
              top: `${playerPosition.y}%`,
              width: `${PLAYER_WIDTH}%`,
              height: `${PLAYER_HEIGHT}%`,
            }}
          >
            {isPowerUpActive('shield') && (
              <div className="absolute inset-0 border-4 border-cyan-400 rounded-full animate-pulse" style={{
                boxShadow: '0 0 20px rgba(96, 165, 250, 0.8)',
              }} />
            )}
            <span role="img" aria-label="player" className="drop-shadow-lg">🚀</span>
          </div>

          {/* Falling Objects */}
          {objects.map(obj => (
            <div
              key={obj.id}
              className="absolute flex items-center justify-center text-3xl md:text-4xl transition-transform"
              style={{
                left: `${obj.x}%`,
                top: `${obj.y}%`,
                width: `${OBJECT_SIZE}%`,
                height: `${OBJECT_SIZE}%`,
                transform: isPowerUpActive('slowMotion') ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <span role="img" aria-label={obj.type} className="drop-shadow-md">{obj.emoji}</span>
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

          {/* Explosions */}
          {explosions.map(exp => {
            const scale = 1 - (exp.lifetime / EXPLOSION_DURATION_MS);
            return (
              <div
                key={exp.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${exp.x}%`,
                  top: `${exp.y}%`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                }}
              >
                <div className="text-6xl animate-ping">💥</div>
              </div>
            );
          })}

          {/* Particles */}
          {particles.map(particle => {
            const opacity = particle.lifetime / PARTICLE_LIFETIME_MS;
            return (
              <div
                key={particle.id}
                className="absolute w-2 h-2 rounded-full pointer-events-none"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  backgroundColor: particle.color,
                  opacity,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: `0 0 10px ${particle.color}`,
                }}
              />
            );
          })}
        </div>
        {/* HUD */}
        <div className="absolute top-2 left-2 right-2 flex justify-between text-2xl font-bold p-2 bg-black/30 rounded-md backdrop-blur-sm z-40">
          <span className="text-amber-400">Score: {score}</span>
          <span className="text-cyan-400">Time: {timeLeft}</span>
        </div>
        
        {/* Active Power-ups Display */}
        <div className="absolute bottom-2 left-2 right-2 flex gap-2 justify-center z-40">
          {Array.from(activePowerUps.entries()).map(([type, expiry]) => {
            const timeLeft = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
            if (timeLeft <= 0) return null;
            return (
              <div
                key={type}
                className="bg-black/50 px-3 py-1 rounded-md flex items-center gap-2 backdrop-blur-sm"
              >
                <span className="text-2xl">{POWER_UP_TYPES[type]}</span>
                <span className="text-sm text-white">{timeLeft}s</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
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
