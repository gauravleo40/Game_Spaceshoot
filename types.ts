export enum GameState {
  Start,
  Playing,
  Paused, // New state for when the game is paused
  GameOver,
}

export interface FallingObject {
  id: number;
  x: number; // percentage from left
  y: number; // percentage from top
  emoji: string;
  type: 'obstacle' | 'powerup';
}

// New interface for bullet objects
export interface Bullet {
  id: number;
  x: number;
  y: number;
}
