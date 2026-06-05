'use strict';

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = CONFIG.PLAYER_RADIUS;
        this.energy = CONFIG.MAX_ENERGY;
        this.isBoosting = false;
        this.trailTimer = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
    }

    update(keys, maze, deltaTime, audio) {
        let dx = 0;
        let dy = 0;

        if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        this.isBoosting = keys['Space'] && this.energy > 0;
        const speed = this.isBoosting ? CONFIG.PLAYER_BOOST_SPEED : CONFIG.PLAYER_SPEED;

        if (this.isBoosting) {
            this.energy = Math.max(0, this.energy - CONFIG.ENERGY_DRAIN);
        } else {
            this.energy = Math.min(CONFIG.MAX_ENERGY, this.energy + CONFIG.ENERGY_REGEN);
        }

        const moveX = dx * speed;
        const moveY = dy * speed;

        const moveResult = maze.moveCircle(this.x, this.y, this.radius, moveX, moveY);
        const moved = (moveResult.x !== this.x || moveResult.y !== this.y);
        
        this.x = moveResult.x;
        this.y = moveResult.y;

        if ((dx !== 0 || dy !== 0) && moved) {
            this.trailTimer += deltaTime;
            if (this.trailTimer > 30) {
                this.trailTimer = 0;
                return true;
            }
        }

        if (this.invincible) {
            this.invincibleTimer -= deltaTime;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        return false;
    }

    addEnergy(amount) {
        this.energy = Utils.clamp(this.energy + amount, 0, CONFIG.MAX_ENERGY);
    }

    takeDamage() {
        if (this.invincible) return false;
        this.invincible = true;
        this.invincibleTimer = 1000;
        return true;
    }

    render(ctx) {
        ctx.save();
        
        const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
        const alpha = this.invincible ? (Math.sin(Date.now() / 50) * 0.5 + 0.5) : 1;
        
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
        ctx.shadowColor = CONFIG.COLORS.PLAYER_GLOW;
        ctx.fillStyle = CONFIG.COLORS.PLAYER;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
