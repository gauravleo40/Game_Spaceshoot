export enum GameState {
  Start,
  Playing,
  Paused, // New state for when the game is paused
  GameOver,
}

export type PowerUpType = 'doubleShot' | 'rapidFire' | 'slowMotion' | 'shield';

export interface FallingObject {
  id: number;
  x: number; // percentage from left
  y: number; // percentage from top
  emoji: string;
  type: 'obstacle' | 'powerup';
  powerUpType?: PowerUpType; // Only set when type is 'powerup'
}

// New interface for bullet objects
export interface Bullet {
  id: number;
  x: number;
  y: number;
}

// Interface for visual effects
export interface Explosion {
  id: number;
  x: number;
  y: number;
  lifetime: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  color: string;
}
