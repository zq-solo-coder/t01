'use strict';

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
    window.game.startLoop();
});
