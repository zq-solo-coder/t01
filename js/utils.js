'use strict';

const Utils = {
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },
    
    shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },
    
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    
    manhattanDistance(x1, y1, x2, y2) {
        return Math.abs(x2 - x1) + Math.abs(y2 - y1);
    },
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    
    easeOutQuad(t) {
        return t * (2 - t);
    }
};
