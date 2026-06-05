'use strict';

class EnergyCore {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = CONFIG.CORE_RADIUS;
        this.collected = false;
        this.baseY = y;
        this.angle = 0;
        this.pulsePhase = Utils.randomFloat(0, Math.PI * 2);
    }

    update(deltaTime) {
        this.angle += deltaTime * 0.003;
    }

    checkCollection(player) {
        if (this.collected) return false;
        
        const dist = Utils.distance(this.x, this.y, player.x, player.y);
        if (dist < this.radius + player.radius) {
            this.collected = true;
            return true;
        }
        return false;
    }

    render(ctx) {
        if (this.collected) return;

        const float = Math.sin(this.angle) * 5;
        const pulse = Math.sin(Date.now() / 200 + this.pulsePhase) * 0.3 + 0.7;

        ctx.save();
        ctx.translate(this.x, this.y + float);
        ctx.rotate(this.angle);

        ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
        ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
        ctx.fillStyle = CONFIG.COLORS.CORE;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r = i % 2 === 0 ? this.radius * pulse : this.radius * 0.5 * pulse;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
