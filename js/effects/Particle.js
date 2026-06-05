'use strict';

class Particle {
    constructor() {
        this.reset();
        this.active = false;
    }

    reset(x, y, vx, vy, color, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.active = true;
    }

    update(deltaTime) {
        if (!this.active) return;
        
        this.x += this.vx * deltaTime / 16;
        this.y += this.vy * deltaTime / 16;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= deltaTime;
        
        if (this.life <= 0) {
            this.active = false;
        }
    }

    render(ctx) {
        if (!this.active) return;
        
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
