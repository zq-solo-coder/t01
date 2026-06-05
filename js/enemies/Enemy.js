'use strict';

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = CONFIG.ENEMY_RADIUS;
        this.cellX = 0;
        this.cellY = 0;

        this.facingDir = Direction.RIGHT;
        this.state = EnemyState.PATROL;

        this.lastSeenPlayerX = -1;
        this.lastSeenPlayerY = -1;
        this.canSeePlayer = false;

        this.stateTimer = 0;
        this.chaseDuration = 0;
        this.reactionTimer = 0;
        this.searchPoints = [];
        this.searchIndex = 0;
        this.pathRecalcTimer = 0;
        this.currentPath = [];
        this.currentPathIndex = 0;

        this.moveTimer = 0;

        this._updateCellPosition();
    }

    _updateCellPosition() {
        this.cellX = Math.floor((this.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        this.cellY = Math.floor((this.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
    }

    _getFacingAngle() {
        switch (this.facingDir) {
            case Direction.TOP: return -Math.PI / 2;
            case Direction.RIGHT: return 0;
            case Direction.BOTTOM: return Math.PI / 2;
            case Direction.LEFT: return Math.PI;
            default: return 0;
        }
    }

    _updateFacingDirection(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

        if (Math.abs(dx) > Math.abs(dy)) {
            this.facingDir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
        } else {
            this.facingDir = dy > 0 ? Direction.BOTTOM : Direction.TOP;
        }
    }

    _hasLineOfSight(player, maze) {
        const x0 = this.x;
        const y0 = this.y;
        const x1 = player.x;
        const y1 = player.y;

        const dist = Utils.distance(x0, y0, x1, y1);
        const maxDist = CONFIG.VISION_RANGE * CONFIG.CELL_SIZE;
        if (dist > maxDist) return false;

        const steps = Math.ceil(dist / (CONFIG.CELL_SIZE * 0.25));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x0 + (x1 - x0) * t;
            const py = y0 + (y1 - y0) * t;

            const cellX = Math.floor((px - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
            const cellY = Math.floor((py - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
            const cell = maze.getCell(cellX, cellY);
            if (!cell) return false;

            const localX = px - CONFIG.MAZE_OFFSET_X - cellX * CONFIG.CELL_SIZE;
            const localY = py - CONFIG.MAZE_OFFSET_Y - cellY * CONFIG.CELL_SIZE;
            const margin = 4;

            if (cell.walls[Direction.TOP] && localY < margin) return false;
            if (cell.walls[Direction.BOTTOM] && localY > CONFIG.CELL_SIZE - margin) return false;
            if (cell.walls[Direction.LEFT] && localX < margin) return false;
            if (cell.walls[Direction.RIGHT] && localX > CONFIG.CELL_SIZE - margin) return false;
        }
        return true;
    }

    _isInVisionCone(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Utils.distance(this.x, this.y, player.x, player.y);

        if (dist < CONFIG.CELL_SIZE * 0.5) return true;

        const angleToPlayer = Math.atan2(dy, dx);
        const facingAngle = this._getFacingAngle();

        let angleDiff = angleToPlayer - facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const halfCone = (CONFIG.VISION_ANGLE * Math.PI / 180) / 2;
        return Math.abs(angleDiff) <= halfCone;
    }

    canDetectPlayer(player, maze) {
        if (!this._isInVisionCone(player)) return false;
        if (!this._hasLineOfSight(player, maze)) return false;
        return true;
    }

    canHearPlayer(player) {
        if (!player.isBoosting) return false;
        const dist = Utils.distance(this.x, this.y, player.x, player.y);
        return dist <= CONFIG.AI_HEARING_RANGE * CONFIG.CELL_SIZE;
    }

    _setState(newState) {
        if (this.state === newState) return;

        if (this.state === EnemyState.CHASE) {
            this.chaseDuration = 0;
        }

        this.state = newState;
        this.stateTimer = 0;

        if (newState === EnemyState.SEARCH) {
            this._generateSearchPoints();
            this.searchIndex = 0;
        }
    }

    _generateSearchPoints() {
        this.searchPoints = [];
        const baseX = this.lastSeenPlayerX >= 0 ? this.lastSeenPlayerX : this.cellX;
        const baseY = this.lastSeenPlayerY >= 0 ? this.lastSeenPlayerY : this.cellY;

        const offsets = [
            { x: 0, y: 0 },
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
            { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
            { x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 }
        ];

        const shuffled = Utils.shuffle(offsets);
        for (const off of shuffled.slice(0, 5)) {
            this.searchPoints.push({ x: baseX + off.x, y: baseY + off.y });
        }
    }

    _updateAIState(player, maze, deltaTime) {
        this.canSeePlayer = this.canDetectPlayer(player, maze);
        const canHear = this.canHearPlayer(player);

        if (this.canSeePlayer) {
            this.lastSeenPlayerX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
            this.lastSeenPlayerY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
        }

        switch (this.state) {
            case EnemyState.PATROL:
                if (this.canSeePlayer) {
                    this.reactionTimer = CONFIG.AI_REACTION_DELAY;
                    this._setState(EnemyState.ALERT);
                } else if (canHear) {
                    this.lastSeenPlayerX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
                    this.lastSeenPlayerY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
                    this._setState(EnemyState.SEARCH);
                }
                break;

            case EnemyState.ALERT:
                this.stateTimer += deltaTime;
                this.reactionTimer -= deltaTime;
                if (this.canSeePlayer && this.reactionTimer <= 0) {
                    this._setState(EnemyState.CHASE);
                } else if (!this.canSeePlayer) {
                    if (this.stateTimer >= CONFIG.AI_ALERT_DURATION) {
                        this._setState(EnemyState.SEARCH);
                    }
                } else {
                    this.stateTimer = 0;
                }
                break;

            case EnemyState.CHASE:
                this.chaseDuration += deltaTime;
                this.stateTimer += deltaTime;

                if (!this.canSeePlayer) {
                    if (this.stateTimer >= 800) {
                        this._setState(EnemyState.SEARCH);
                    }
                } else {
                    this.stateTimer = 0;
                }

                if (this.chaseDuration >= CONFIG.AI_FATIGUE_THRESHOLD) {
                    this._setState(EnemyState.FATIGUE);
                }
                break;

            case EnemyState.SEARCH:
                this.stateTimer += deltaTime;
                if (this.canSeePlayer) {
                    this.reactionTimer = CONFIG.AI_REACTION_DELAY * 0.5;
                    this._setState(EnemyState.ALERT);
                } else if (this.stateTimer >= CONFIG.AI_SEARCH_DURATION) {
                    this._setState(EnemyState.PATROL);
                }
                break;

            case EnemyState.FATIGUE:
                this.stateTimer += deltaTime;
                if (this.canSeePlayer) {
                    this.reactionTimer = CONFIG.AI_REACTION_DELAY;
                    this._setState(EnemyState.ALERT);
                } else if (this.stateTimer >= CONFIG.AI_FATIGUE_REST) {
                    this._setState(EnemyState.PATROL);
                }
                break;
        }
    }

    _getPathTo(targetCellX, targetCellY, maze) {
        return maze.findPath(this.cellX, this.cellY, targetCellX, targetCellY);
    }

    _followPath(maze, speed, deltaTime) {
        if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
            return true;
        }

        this.moveTimer += deltaTime;
        if (this.moveTimer < 16) return false;
        this.moveTimer = 0;

        const target = this.currentPath[this.currentPathIndex];
        const targetX = target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
        const targetY = target.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;

        const dist = Utils.distance(this.x, this.y, targetX, targetY);

        if (dist < 8) {
            this.currentPathIndex++;
            return this.currentPathIndex >= this.currentPath.length;
        } else {
            this._updateFacingDirection(targetX, targetY);
            this.moveTowards(targetX, targetY, speed, maze);
            return false;
        }
    }

    _advanceSearchTarget(maze) {
        while (this.searchIndex < this.searchPoints.length) {
            const target = this.searchPoints[this.searchIndex];
            this.searchIndex++;
            const path = maze.findPath(this.cellX, this.cellY, target.x, target.y);
            if (path.length > 0) {
                this.currentPath = path;
                this.currentPathIndex = 0;
                return true;
            }
        }
        this._setState(EnemyState.PATROL);
        return false;
    }

    checkCollision(player) {
        const dist = Utils.distance(this.x, this.y, player.x, player.y);
        return dist < this.radius + player.radius;
    }

    renderVisionRange(ctx) {
        ctx.save();

        if (this.state === EnemyState.CHASE) {
            ctx.fillStyle = 'rgba(255, 50, 80, 0.2)';
        } else if (this.state === EnemyState.ALERT) {
            ctx.fillStyle = 'rgba(255, 180, 50, 0.18)';
        } else if (this.state === EnemyState.SEARCH) {
            ctx.fillStyle = 'rgba(255, 150, 50, 0.15)';
        } else {
            ctx.fillStyle = CONFIG.COLORS.ENEMY_VISION;
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

    render(ctx) {
        this.renderVisionRange(ctx);

        ctx.save();
        ctx.shadowBlur = CONFIG.GLOW_INTENSITY;
        ctx.shadowColor = CONFIG.COLORS.ENEMY_GLOW;
        ctx.fillStyle = CONFIG.COLORS.ENEMY;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        const facingAngle = this._getFacingAngle();
        const eyeOffsetX = Math.cos(facingAngle) * 5;
        const eyeOffsetY = Math.sin(facingAngle) * 5;

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + eyeOffsetX - 4, this.y + eyeOffsetY - 2, 3, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffsetX + 4, this.y + eyeOffsetY - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x + eyeOffsetX - 4, this.y + eyeOffsetY - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(this.x + eyeOffsetX + 4, this.y + eyeOffsetY - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === EnemyState.ALERT) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText('?', this.x, this.y - this.radius - 8);
        } else if (this.state === EnemyState.CHASE) {
            ctx.fillStyle = '#ff3355';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText('!', this.x, this.y - this.radius - 8);
        }

        ctx.restore();
    }

    moveTowards(targetX, targetY, speed, maze) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.01) {
            return { reached: true, x: this.x, y: this.y };
        }

        const moveX = (dx / dist) * speed;
        const moveY = (dy / dist) * speed;

        const result = maze.moveCircle(this.x, this.y, this.radius, moveX, moveY);

        const oldX = this.x;
        const oldY = this.y;

        this.x = result.x;
        this.y = result.y;
        this._updateCellPosition();

        const movedDist = Utils.distance(oldX, oldY, this.x, this.y);
        return {
            reached: movedDist >= dist * 0.9,
            collided: result.collided,
            x: this.x,
            y: this.y
        };
    }
}
