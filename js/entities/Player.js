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

        this.isPhaseDashing = false;
        this.phaseDashTimer = 0;
        this.phaseDashCooldown = 0;
        this.phaseDashDx = 0;
        this.phaseDashDy = 0;

        this.empCooldown = 0;
        this.decoyCooldown = 0;

        this.hasShield = false;
        this.speedBoostTimer = 0;

        this.flashbangCount = 0;
    }

    _getEffectiveSpeed() {
        let speed;
        if (this.isPhaseDashing) {
            speed = CONFIG.SKILL_PHASE_DASH_SPEED;
        } else if (this.isBoosting) {
            speed = CONFIG.PLAYER_BOOST_SPEED;
        } else {
            speed = CONFIG.PLAYER_SPEED;
        }
        if (this.speedBoostTimer > 0) {
            speed *= CONFIG.POWERUP_SPEED_BOOST;
        }
        return speed;
    }

    update(keys, maze, deltaTime, audio) {
        let events = {
            emitTrail: false,
            emp: false,
            decoy: false,
            flashbang: false
        };

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

        if (this.phaseDashCooldown > 0) this.phaseDashCooldown -= deltaTime;
        if (this.empCooldown > 0) this.empCooldown -= deltaTime;
        if (this.decoyCooldown > 0) this.decoyCooldown -= deltaTime;
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= deltaTime;

        if (keys['ShiftLeft'] || keys['ShiftRight']) {
            if (!this.isPhaseDashing && this.phaseDashCooldown <= 0 && (dx !== 0 || dy !== 0)) {
                this.isPhaseDashing = true;
                this.phaseDashTimer = CONFIG.SKILL_PHASE_DASH_DURATION;
                this.phaseDashCooldown = CONFIG.SKILL_PHASE_DASH_COOLDOWN;
                this.phaseDashDx = dx;
                this.phaseDashDy = dy;
                if (audio && audio.playBoost) audio.playBoost();
            }
        }

        if (this.isPhaseDashing) {
            this.phaseDashTimer -= deltaTime;
            if (this.phaseDashTimer <= 0) {
                this.isPhaseDashing = false;
            } else {
                dx = this.phaseDashDx;
                dy = this.phaseDashDy;
            }
        }

        if (!this.isPhaseDashing) {
            this.isBoosting = keys['Space'] && this.energy > 0;
        } else {
            this.isBoosting = false;
        }

        if (this.isBoosting && !this.isPhaseDashing) {
            this.energy = Math.max(0, this.energy - CONFIG.ENERGY_DRAIN);
        } else if (!this.isPhaseDashing) {
            this.energy = Math.min(CONFIG.MAX_ENERGY, this.energy + CONFIG.ENERGY_REGEN);
        }

        if (keys['KeyE'] && this.empCooldown <= 0) {
            this.empCooldown = CONFIG.SKILL_EMP_COOLDOWN;
            events.emp = true;
            keys['KeyE'] = false;
        }

        if (keys['KeyQ'] && this.decoyCooldown <= 0) {
            this.decoyCooldown = CONFIG.SKILL_DECOY_COOLDOWN;
            events.decoy = true;
            keys['KeyQ'] = false;
        }

        if (keys['KeyR'] && this.flashbangCount > 0) {
            this.flashbangCount--;
            events.flashbang = true;
            keys['KeyR'] = false;
        }

        const speed = this._getEffectiveSpeed();
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
                events.emitTrail = true;
            }
        }

        if (this.invincible) {
            this.invincibleTimer -= deltaTime;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
            }
        }

        return events;
    }

    addEnergy(amount) {
        this.energy = Utils.clamp(this.energy + amount, 0, CONFIG.MAX_ENERGY);
    }

    addShield() {
        this.hasShield = true;
    }

    addSpeedBoost() {
        this.speedBoostTimer = CONFIG.POWERUP_SPEED_DURATION;
    }

    addFlashbang() {
        this.flashbangCount++;
    }

    takeDamage() {
        if (this.invincible) return false;
        if (this.hasShield) {
            this.hasShield = false;
            this.invincible = true;
            this.invincibleTimer = 500;
            return 'shield';
        }
        this.invincible = true;
        this.invincibleTimer = 1000;
        return true;
    }

    render(ctx) {
        ctx.save();

        const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
        const alpha = this.invincible ? (Math.sin(Date.now() / 50) * 0.5 + 0.5) : 1;

        if (this.hasShield) {
            const shieldPulse = Math.sin(Date.now() / 150) * 0.2 + 0.8;
            ctx.globalAlpha = 0.5 * alpha;
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY * shieldPulse;
            ctx.shadowColor = CONFIG.COLORS.POWERUP_SHIELD_GLOW;
            ctx.strokeStyle = CONFIG.COLORS.POWERUP_SHIELD;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.speedBoostTimer > 0) {
            const spPulse = Math.sin(Date.now() / 80) * 0.3 + 0.7;
            ctx.globalAlpha = 0.4;
            ctx.shadowBlur = 10;
            ctx.shadowColor = CONFIG.COLORS.POWERUP_SPEED_GLOW;
            ctx.fillStyle = CONFIG.COLORS.POWERUP_SPEED;
            for (let i = 0; i < 3; i++) {
                const a = (Date.now() / 100 + i * 2) % (Math.PI * 2);
                const r = this.radius + 12 + Math.sin(a) * 4;
                ctx.beginPath();
                ctx.arc(this.x + Math.cos(a) * 4, this.y + Math.sin(a) * 4, 3 * spPulse, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = alpha;

        if (this.isPhaseDashing) {
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY * 1.5 * pulse;
            ctx.shadowColor = CONFIG.COLORS.SKILL_PHASE;
            ctx.fillStyle = CONFIG.COLORS.SKILL_PHASE;

            for (let i = 0; i < 3; i++) {
                const t = (Date.now() / 50 + i * 0.5) % 1;
                ctx.globalAlpha = alpha * (1 - t) * 0.5;
                ctx.beginPath();
                ctx.arc(
                    this.x - this.phaseDashDx * i * 8,
                    this.y - this.phaseDashDy * i * 8,
                    this.radius * (1 - t * 0.3),
                    0, Math.PI * 2
                );
                ctx.fill();
            }
            ctx.globalAlpha = alpha;
        } else {
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
            ctx.shadowColor = CONFIG.COLORS.PLAYER_GLOW;
            ctx.fillStyle = CONFIG.COLORS.PLAYER;
        }

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
