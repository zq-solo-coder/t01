'use strict';

class PhantomEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'phantom');
        this.currentOpacity = CONFIG.PHANTOM_OPACITY_PATROL;
        this.targetOpacity = CONFIG.PHANTOM_OPACITY_PATROL;
        this.particles = [];
        this.particleTimer = 0;
        this._initParticles();
    }

    _initParticles() {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: CONFIG.ENEMY_RADIUS + Utils.randomFloat(4, 16),
                speed: Utils.randomFloat(0.0008, 0.002),
                size: Utils.randomFloat(1.5, 3.5),
                phase: Math.random() * Math.PI * 2,
                bobSpeed: Utils.randomFloat(0.002, 0.005),
                bobAmount: Utils.randomFloat(2, 5)
            });
        }
    }

    _getTargetOpacity() {
        switch (this.state) {
            case EnemyState.PATROL:
                return CONFIG.PHANTOM_OPACITY_PATROL;
            case EnemyState.ALERT:
                return CONFIG.PHANTOM_OPACITY_ALERT;
            case EnemyState.CHASE:
                return CONFIG.PHANTOM_OPACITY_CHASE;
            case EnemyState.SEARCH:
                return CONFIG.PHANTOM_OPACITY_SEARCH;
            case EnemyState.FATIGUE:
                return CONFIG.PHANTOM_OPACITY_FATIGUE;
            case EnemyState.STUNNED:
                return CONFIG.PHANTOM_OPACITY_STUNNED;
            default:
                return CONFIG.PHANTOM_OPACITY_PATROL;
        }
    }

    _updateOpacity(deltaTime) {
        this.targetOpacity = this._getTargetOpacity();
        const diff = this.targetOpacity - this.currentOpacity;
        const step = CONFIG.PHANTOM_FADE_SPEED * deltaTime;
        if (Math.abs(diff) <= step) {
            this.currentOpacity = this.targetOpacity;
        } else {
            this.currentOpacity += Math.sign(diff) * step;
        }
    }

    _updateParticles(deltaTime) {
        for (const p of this.particles) {
            p.angle += p.speed * deltaTime;
            p.phase += p.bobSpeed * deltaTime;
        }
    }

    update(player, maze, deltaTime, decoys = []) {
        this._updateCellPosition();
        this._updateAIState(player, maze, deltaTime, decoys);
        this._updateOpacity(deltaTime);
        this._updateParticles(deltaTime);

        if (this.state === EnemyState.STUNNED) return;

        this.pathRecalcTimer += deltaTime;

        switch (this.state) {
            case EnemyState.PATROL:
                this._wander(maze, deltaTime);
                break;
            case EnemyState.ALERT:
                this._standAndLook(player, maze, deltaTime, decoys);
                break;
            case EnemyState.CHASE:
                this._chasePlayer(player, maze, deltaTime, decoys);
                break;
            case EnemyState.SEARCH:
                this._searchLastSeen(maze, deltaTime);
                break;
            case EnemyState.FATIGUE:
                this._rest(deltaTime);
                break;
        }
    }

    _wander(maze, deltaTime) {
        if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
            const target = this._getRandomNearbyCell(maze);
            if (target) {
                this.currentPath = maze.findPath(this.cellX, this.cellY, target.x, target.y);
                this.currentPathIndex = 0;
            }
        }
        this._followPath(maze, CONFIG.PATROL_SPEED * 0.85, deltaTime);
    }

    _getRandomNearbyCell(maze) {
        const candidates = [];
        const range = 4;
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const nx = this.cellX + dx;
                const ny = this.cellY + dy;
                const cell = maze.getCell(nx, ny);
                if (cell && cell.isCarved) {
                    candidates.push({ x: nx, y: ny });
                }
            }
        }
        if (candidates.length === 0) return null;
        return Utils.randomChoice(candidates);
    }

    _standAndLook(player, maze, deltaTime, decoys = []) {
        const target = this.targetDecoy || player;
        if (this.targetDecoy ? this.canDetectTarget(this.targetDecoy, maze) : this.canSeePlayer) {
            this._updateFacingDirection(target.x, target.y);
        }
    }

    _chasePlayer(player, maze, deltaTime, decoys = []) {
        const target = this.targetDecoy || player;
        const targetCellX = Math.floor((target.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        const targetCellY = Math.floor((target.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);

        if (this.pathRecalcTimer >= CONFIG.AI_PATH_RECALC_INTERVAL ||
            this.currentPath.length === 0 ||
            this.currentPathIndex >= this.currentPath.length) {
            this.currentPath = maze.findPath(this.cellX, this.cellY, targetCellX, targetCellY);
            this.currentPathIndex = 0;
            this.pathRecalcTimer = 0;
        }

        this._followPath(maze, CONFIG.PHANTOM_SPEED, deltaTime);
    }

    _searchLastSeen(maze, deltaTime) {
        if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
            if (!this._advanceSearchTarget(maze)) {
                return;
            }
        }
        this._followPath(maze, CONFIG.PATROL_SPEED, deltaTime);
    }

    _rest(deltaTime) {
    }

    renderVisionRange(ctx) {
        if (this.state === EnemyState.STUNNED) return;

        ctx.save();
        ctx.globalAlpha = this.currentOpacity * 0.8;

        if (this.state === EnemyState.CHASE) {
            ctx.fillStyle = 'rgba(170, 80, 255, 0.25)';
        } else if (this.state === EnemyState.ALERT) {
            ctx.fillStyle = 'rgba(170, 80, 255, 0.2)';
        } else if (this.state === EnemyState.SEARCH) {
            ctx.fillStyle = 'rgba(170, 80, 255, 0.15)';
        } else {
            ctx.fillStyle = 'rgba(170, 80, 255, 0.1)';
        }

        const facingAngle = this._getFacingAngle();
        const halfCone = (CONFIG.VISION_ANGLE * Math.PI / 180) / 2;
        const radius = CONFIG.VISION_RANGE * CONFIG.CELL_SIZE;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, radius, facingAngle - halfCone, facingAngle + halfCone);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    _renderParticles(ctx) {
        for (const p of this.particles) {
            const bob = Math.sin(p.phase) * p.bobAmount;
            const px = this.x + Math.cos(p.angle) * p.radius;
            const py = this.y + Math.sin(p.angle) * p.radius + bob;
            const alpha = this.currentOpacity * (0.5 + Math.sin(p.phase * 1.3) * 0.3);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = CONFIG.COLORS.PHANTOM_PARTICLE;
            ctx.shadowBlur = 12;
            ctx.shadowColor = CONFIG.COLORS.PHANTOM_GLOW;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    render(ctx) {
        this.renderVisionRange(ctx);
        this._renderParticles(ctx);

        ctx.save();

        if (this.state === EnemyState.STUNNED) {
            const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
            ctx.globalAlpha = this.currentOpacity;
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse * 1.5;
            ctx.shadowColor = CONFIG.COLORS.ENEMY_STUN_GLOW;
            ctx.fillStyle = CONFIG.COLORS.ENEMY_STUN;
        } else {
            ctx.globalAlpha = this.currentOpacity;
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY * 1.3;
            ctx.shadowColor = CONFIG.COLORS.PHANTOM_GLOW;
            ctx.fillStyle = CONFIG.COLORS.PHANTOM_BODY;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.state !== EnemyState.STUNNED) {
            ctx.save();
            ctx.globalAlpha = Math.max(this.currentOpacity, 0.35);
            ctx.strokeStyle = CONFIG.COLORS.PHANTOM_OUTLINE;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (this.state !== EnemyState.STUNNED) {
            const facingAngle = this._getFacingAngle();
            const eyeOffsetX = Math.cos(facingAngle) * 5;
            const eyeOffsetY = Math.sin(facingAngle) * 5;

            ctx.save();
            ctx.globalAlpha = this.currentOpacity;

            ctx.fillStyle = 'rgba(30, 0, 60, 0.9)';
            ctx.beginPath();
            ctx.arc(this.x + eyeOffsetX - 4, this.y + eyeOffsetY - 2, 3, 0, Math.PI * 2);
            ctx.arc(this.x + eyeOffsetX + 4, this.y + eyeOffsetY - 2, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(220, 180, 255, 1)';
            ctx.beginPath();
            ctx.arc(this.x + eyeOffsetX - 4, this.y + eyeOffsetY - 2, 1.5, 0, Math.PI * 2);
            ctx.arc(this.x + eyeOffsetX + 4, this.y + eyeOffsetY - 2, 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } else {
            ctx.save();
            ctx.globalAlpha = this.currentOpacity;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - 6, this.y - 4);
            ctx.lineTo(this.x - 2, this.y);
            ctx.lineTo(this.x - 6, this.y + 4);
            ctx.moveTo(this.x + 2, this.y - 4);
            ctx.lineTo(this.x + 6, this.y);
            ctx.lineTo(this.x + 2, this.y + 4);
            ctx.stroke();
            ctx.restore();
        }

        if (this.state === EnemyState.ALERT) {
            ctx.save();
            ctx.globalAlpha = Math.max(this.currentOpacity, 0.7);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText('?', this.x, this.y - this.radius - 8);
            ctx.restore();
        } else if (this.state === EnemyState.CHASE) {
            ctx.save();
            ctx.globalAlpha = Math.max(this.currentOpacity, 0.8);
            ctx.fillStyle = '#cc44ff';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText('!', this.x, this.y - this.radius - 8);
            ctx.restore();
        } else if (this.state === EnemyState.STUNNED) {
            const pulse = Math.sin(Date.now() / 150);
            ctx.save();
            ctx.globalAlpha = Math.max(this.currentOpacity, 0.8);
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText('★' + (pulse > 0 ? '☆' : '★'), this.x, this.y - this.radius - 8);
            ctx.restore();
        }

        ctx.restore();
    }
}
