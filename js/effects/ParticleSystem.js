'use strict';

class ParticleSystem {
    constructor(initialSize = 200, hardLimit = 600) {
        this.pool = [];
        this.activeParticles = [];
        this.hardLimit = hardLimit;
        this._forceReclaimThreshold = 30;

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new Particle());
        }
    }

    _removeFromActive(particle) {
        const idx = this.activeParticles.indexOf(particle);
        if (idx !== -1) {
            this.activeParticles.splice(idx, 1);
        }
    }

    _getParticle() {
        for (const particle of this.pool) {
            if (!particle.active) {
                return particle;
            }
        }

        let oldestParticle = null;
        let minLife = Infinity;
        for (const particle of this.activeParticles) {
            if (particle.life < minLife) {
                minLife = particle.life;
                oldestParticle = particle;
            }
        }

        if (oldestParticle !== null && minLife <= this._forceReclaimThreshold) {
            this._removeFromActive(oldestParticle);
            return oldestParticle;
        }

        if (this.pool.length < this.hardLimit) {
            const newParticle = new Particle();
            this.pool.push(newParticle);
            return newParticle;
        }

        if (oldestParticle !== null) {
            this._removeFromActive(oldestParticle);
            return oldestParticle;
        }

        return this.pool[0];
    }

    emit(x, y, color, count = 10, speed = 3, life = 500, size = 4) {
        for (let i = 0; i < count; i++) {
            const particle = this._getParticle();
            const angle = Utils.randomFloat(0, Math.PI * 2);
            const spd = Utils.randomFloat(speed * 0.5, speed);
            const vx = Math.cos(angle) * spd;
            const vy = Math.sin(angle) * spd;
            
            particle.reset(x, y, vx, vy, color, life, size);
            
            if (!this.activeParticles.includes(particle)) {
                this.activeParticles.push(particle);
            }
        }
    }

    emitTrail(x, y, color) {
        const particle = this._getParticle();
        particle.reset(x, y, 0, 0, color, 200, CONFIG.PLAYER_RADIUS * 0.6);
        
        if (!this.activeParticles.includes(particle)) {
            this.activeParticles.push(particle);
        }
    }

    update(deltaTime) {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];
            particle.update(deltaTime);
            
            if (!particle.active) {
                this.activeParticles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        for (const particle of this.activeParticles) {
            particle.render(ctx);
        }
    }

    clear() {
        for (const particle of this.activeParticles) {
            particle.active = false;
        }
        this.activeParticles = [];
    }
}
