'use strict';

class Decoy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = CONFIG.DECOY_RADIUS;
        this.duration = CONFIG.SKILL_DECOY_DURATION;
        this.lifeTimer = CONFIG.SKILL_DECOY_DURATION;
        this.expired = false;
        this.pulsePhase = 0;
    }

    update(deltaTime) {
        this.lifeTimer -= deltaTime;
        this.pulsePhase += deltaTime * 0.005;
        if (this.lifeTimer <= 0) {
            this.expired = true;
        }
    }

    render(ctx) {
        if (this.expired) return;

        const lifePercent = this.lifeTimer / this.duration;
        const pulse = Math.sin(this.pulsePhase) * 0.2 + 0.8;
        const alpha = Utils.clamp(lifePercent * 1.5, 0.3, 1);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
        ctx.shadowColor = CONFIG.COLORS.DECOY_GLOW;
        ctx.fillStyle = CONFIG.COLORS.DECOY;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = CONFIG.COLORS.DECOY_GLOW;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 4 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
