'use strict';

const CONFIG = {
    LOGICAL_WIDTH: 800,
    LOGICAL_HEIGHT: 600,
    
    CELL_SIZE: 48,
    MAZE_WIDTH: 12,
    MAZE_HEIGHT: 9,
    WALL_THICKNESS: 3,
    
    PLAYER_RADIUS: 12,
    PLAYER_SPEED: 2.5,
    PLAYER_BOOST_SPEED: 5.0,
    MAX_ENERGY: 100,
    ENERGY_DRAIN: 0.4,
    ENERGY_REGEN: 0.05,

    SKILL_PHASE_DASH_COOLDOWN: 10000,
    SKILL_PHASE_DASH_DURATION: 500,
    SKILL_PHASE_DASH_SPEED: 6.0,
    SKILL_EMP_COOLDOWN: 18000,
    SKILL_EMP_RADIUS: 3,
    SKILL_EMP_PUSH_DISTANCE: 2.5,
    SKILL_EMP_STUN_DURATION: 1500,
    SKILL_DECOY_COOLDOWN: 20000,
    SKILL_DECOY_DURATION: 3000,
    
    ENEMY_RADIUS: 14,
    PATROL_SPEED: 1.5,
    CHASE_SPEED: 2.0,
    TELEPORT_SPEED: 1.8,
    PHANTOM_SPEED: 1.9,
    PHANTOM_OPACITY_PATROL: 0.12,
    PHANTOM_OPACITY_ALERT: 0.45,
    PHANTOM_OPACITY_CHASE: 1.0,
    PHANTOM_OPACITY_SEARCH: 0.3,
    PHANTOM_OPACITY_FATIGUE: 0.25,
    PHANTOM_OPACITY_STUNNED: 0.2,
    PHANTOM_FADE_SPEED: 0.008,
    VISION_RANGE: 4.5,
    VISION_ANGLE: 100,
    TELEPORT_INTERVAL: 5000,
    TELEPORT_WARNING: 1500,

    AI_REACTION_DELAY: 300,
    AI_ALERT_DURATION: 1500,
    AI_SEARCH_DURATION: 4000,
    AI_FATIGUE_THRESHOLD: 5000,
    AI_FATIGUE_REST: 2000,
    AI_HEARING_RANGE: 5,
    AI_PATH_RECALC_INTERVAL: 500,
    
    CORE_RADIUS: 10,
    CORE_COUNT_MIN: 5,
    CORE_COUNT_MAX: 8,
    CORE_ENERGY_VALUE: 25,
    CORE_SCORE_VALUE: 100,

    POWERUP_RADIUS: 11,
    POWERUP_SPEED_BOOST: 1.3,
    POWERUP_SPEED_DURATION: 10000,
    POWERUP_FLASH_RADIUS: 3,
    POWERUP_FLASH_STUN: 2000,
    POWERUP_COUNT_MIN: 2,
    POWERUP_COUNT_MAX: 3,

    DECOY_RADIUS: 12,
    
    FOG_RADIUS: 140,
    TRAIL_LENGTH: 15,
    GLOW_INTENSITY: 20,
    SHAKE_DURATION: 300,
    SHAKE_INTENSITY: 8,
    
    COLORS: {
        BACKGROUND: '#0a0a1a',
        WALL: '#9933ff',
        WALL_GLOW: '#cc66ff',
        NICHE_BG: '#1a2a3a',
        NICHE_BORDER: '#00ccff',
        NICHE_GLOW: '#66ddff',
        PLAYER: '#00ffff',
        PLAYER_GLOW: '#66ffff',
        ENEMY: '#ff0055',
        ENEMY_GLOW: '#ff6699',
        ENEMY_VISION: 'rgba(255, 0, 85, 0.15)',
        ENEMY_STUN: '#ffff00',
        ENEMY_STUN_GLOW: '#ffffaa',
        PHANTOM: 'rgba(170, 80, 255, 1)',
        PHANTOM_BODY: 'rgba(150, 60, 220, 0.7)',
        PHANTOM_GLOW: '#cc88ff',
        PHANTOM_PARTICLE: '#bb77ff',
        PHANTOM_OUTLINE: '#dd99ff',
        CORE: '#ffff00',
        CORE_GLOW: '#ffff99',
        EXIT: '#00ff66',
        EXIT_GLOW: '#66ff99',
        DECOY: '#ff00ff',
        DECOY_GLOW: '#ff88ff',
        SKILL_PHASE: '#aa00ff',
        SKILL_EMP: '#00ffaa',
        SKILL_DECOY: '#ff8800',
        POWERUP_SHIELD: '#00aaff',
        POWERUP_SHIELD_GLOW: '#66ccff',
        POWERUP_SPEED: '#00ff88',
        POWERUP_SPEED_GLOW: '#88ffbb',
        POWERUP_FLASH: '#ff8800',
        POWERUP_FLASH_GLOW: '#ffbb66',
        TEXT: '#ffffff',
        HUD_BG: 'rgba(10, 10, 26, 0.8)'
    },

    MAZE_OFFSET_X: 0,
    MAZE_OFFSET_Y: 0
};

const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover'
};

const EnemyState = {
    PATROL: 'patrol',
    ALERT: 'alert',
    CHASE: 'chase',
    SEARCH: 'search',
    FATIGUE: 'fatigue',
    STUNNED: 'stunned'
};

const Direction = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3,
    NONE: -1
};

const DIR_VECTORS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
];
