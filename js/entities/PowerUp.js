'use strict';

const PowerUpType = {
    SHIELD: 'shield',
    SPEED: 'speed',
    FLASH: 'flash'
};

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = CONFIG.POWERUP_RADIUS;
        this.collected = false;
        this.baseY = y;
        this.angle = 0;
        this.pulsePhase = Utils.randomFloat(0, Math.PI * 2);
    }

    _getColors() {
        switch (this.type) {
            case PowerUpType.SHIELD:
                return { color: CONFIG.COLORS.POWERUP_SHIELD, glow: CONFIG.COLORS.POWERUP_SHIELD_GLOW };
            case PowerUpType.SPEED:
                return { color: CONFIG.COLORS.POWERUP_SPEED, glow: CONFIG.COLORS.POWERUP_SPEED_GLOW };
            case PowerUpType.FLASH:
                return { color: CONFIG.COLORS.POWERUP_FLASH, glow: CONFIG.COLORS.POWERUP_FLASH_GLOW };
            default:
                return { color: '#ffffff', glow: '#ffffff' };
        }
    }

    _getLabel() {
        switch (this.type) {
            case PowerUpType.SHIELD: return '盾';
            case PowerUpType.SPEED: return '速';
            case PowerUpType.FLASH: return '闪';
            default: return '?';
        }
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
        const colors = this._getColors();

        ctx.save();
        ctx.translate(this.x, this.y + float);
        ctx.rotate(this.angle);

        ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
        ctx.shadowColor = colors.glow;
        ctx.fillStyle = colors.color;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r = this.radius * pulse;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.rotate(-this.angle);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Consolas';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._getLabel(), 0, 0);

        ctx.restore();
    }
}
