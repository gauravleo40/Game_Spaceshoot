export const GAME_DURATION_SECONDS = 0;
export const PLAYER_SPEED = 10; // percentage of game width
export const OBJECT_VERTICAL_SPEED = 0.5; // percentage of game height per frame
export const OBJECT_SPAWN_INTERVAL_MS = 500;

// Sizes are in percentage of the game area width/height
export const PLAYER_WIDTH = 5;
export const PLAYER_HEIGHT = 5;
export const OBJECT_SIZE = 5;

// New constants for bullets
export const BULLET_SPEED = 2;
export const BULLET_WIDTH = 5;
export const BULLET_HEIGHT = 2;


// Changed from collectibles to obstacles
export const OBSTACLE_EMOJIS = ['🪨', '☄️', '🔴', '🔥', '🌟', '⚡', '💥', '🌑'];

// Power-up types and emojis
export const POWER_UP_TYPES = {
  doubleShot: '🔵',
  rapidFire: '⚡',
  slowMotion: '⏱️',
  shield: '🛡️',
} as const;

export const POWER_UP_EMOJIS = Object.values(POWER_UP_TYPES);

// Power-up durations in milliseconds
export const POWER_UP_DURATION_MS = {
  doubleShot: 10000, // 10 seconds
  rapidFire: 8000,   // 8 seconds
  slowMotion: 6000,  // 6 seconds
  shield: 12000,     // 12 seconds
};

// Visual effect constants
export const EXPLOSION_DURATION_MS = 500;
export const PARTICLE_COUNT = 8;
export const PARTICLE_LIFETIME_MS = 600;
export const SCREEN_SHAKE_DURATION_MS = 300;

// Sound effect constants
export const BULLET_COOLDOWN_MS = 200; // Default cooldown
export const RAPID_FIRE_COOLDOWN_MS = 50; // Rapid fire cooldown 
