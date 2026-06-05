'use strict';

const CONFIG = {
    LOGICAL_WIDTH: 800,
    LOGICAL_HEIGHT: 600,
    
    CELL_SIZE: 40,
    MAZE_WIDTH: 15,
    MAZE_HEIGHT: 11,
    WALL_THICKNESS: 3,
    
    PLAYER_RADIUS: 12,
    PLAYER_SPEED: 2.5,
    PLAYER_BOOST_SPEED: 5.0,
    MAX_ENERGY: 100,
    ENERGY_DRAIN: 0.4,
    ENERGY_REGEN: 0.05,
    
    ENEMY_RADIUS: 14,
    PATROL_SPEED: 1.5,
    CHASE_SPEED: 2.0,
    TELEPORT_SPEED: 1.8,
    VISION_RANGE: 3,
    TELEPORT_INTERVAL: 5000,
    TELEPORT_WARNING: 1500,
    
    CORE_RADIUS: 10,
    CORE_COUNT_MIN: 5,
    CORE_COUNT_MAX: 8,
    CORE_ENERGY_VALUE: 25,
    CORE_SCORE_VALUE: 100,
    
    FOG_RADIUS: 140,
    TRAIL_LENGTH: 15,
    GLOW_INTENSITY: 20,
    SHAKE_DURATION: 300,
    SHAKE_INTENSITY: 8,
    
    COLORS: {
        BACKGROUND: '#0a0a1a',
        WALL: '#9933ff',
        WALL_GLOW: '#cc66ff',
        PLAYER: '#00ffff',
        PLAYER_GLOW: '#66ffff',
        ENEMY: '#ff0055',
        ENEMY_GLOW: '#ff6699',
        ENEMY_VISION: 'rgba(255, 0, 85, 0.15)',
        CORE: '#ffff00',
        CORE_GLOW: '#ffff99',
        EXIT: '#00ff66',
        EXIT_GLOW: '#66ff99',
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
