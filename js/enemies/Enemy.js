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
        this.targetDecoy = null;

        this.stateTimer = 0;
        this.chaseDuration = 0;
        this.reactionTimer = 0;
        this.searchPoints = [];
        this.searchIndex = 0;
        this.pathRecalcTimer = 0;
        this.currentPath = [];
        this.currentPathIndex = 0;

        this.moveTimer = 0;
        this.stunTimer = 0;

        this._updateCellPosition();
    }

    stun(duration) {
        this.state = EnemyState.STUNNED;
        this.stunTimer = duration;
        this.currentPath = [];
    }

    pushAway(fromX, fromY, distanceCells, maze) {
        const dx = this.x - fromX;
        const dy = this.y - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) return;

        const pushDist = distanceCells * CONFIG.CELL_SIZE;
        const targetX = this.x + (dx / dist) * pushDist;
        const targetY = this.y + (dy / dist) * pushDist;

        const steps = 10;
        let finalX = this.x;
        let finalY = this.y;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const testX = this.x + (targetX - this.x) * t;
            const testY = this.y + (targetY - this.y) * t;
            if (maze.isValidPosition(testX, testY, this.radius)) {
                finalX = testX;
                finalY = testY;
            } else {
                break;
            }
        }

        this.x = finalX;
        this.y = finalY;
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

    _raycastVisionDistance(angle, maxDist, maze) {
        const stepSize = CONFIG.CELL_SIZE * 0.2;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const steps = Math.ceil(maxDist / stepSize);

        for (let i = 1; i <= steps; i++) {
            const dist = i * stepSize;
            const px = this.x + dirX * dist;
            const py = this.y + dirY * dist;

            const cellX = Math.floor((px - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
            const cellY = Math.floor((py - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
            const cell = maze.getCell(cellX, cellY);
            if (!cell) return dist;

            const localX = px - CONFIG.MAZE_OFFSET_X - cellX * CONFIG.CELL_SIZE;
            const localY = py - CONFIG.MAZE_OFFSET_Y - cellY * CONFIG.CELL_SIZE;
            const margin = 4;

            if (cell.walls[Direction.TOP] && localY < margin) return dist;
            if (cell.walls[Direction.BOTTOM] && localY > CONFIG.CELL_SIZE - margin) return dist;
            if (cell.walls[Direction.LEFT] && localX < margin) return dist;
            if (cell.walls[Direction.RIGHT] && localX > CONFIG.CELL_SIZE - margin) return dist;
        }
        return maxDist;
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

    canDetectTarget(target, maze) {
        if (!target) return false;
        if (!this._isTargetInVisionCone(target)) return false;
        if (!this._hasLineOfSightTo(target, maze)) return false;
        return true;
    }

    canDetectPlayer(player, maze) {
        if (!this._isInVisionCone(player)) return false;
        if (!this._hasLineOfSight(player, maze)) return false;
        return true;
    }

    canHearPlayer(player) {
        if (!player.isBoosting && !player.isPhaseDashing) return false;
        const dist = Utils.distance(this.x, this.y, player.x, player.y);
        return dist <= CONFIG.AI_HEARING_RANGE * CONFIG.CELL_SIZE;
    }

    _isTargetInVisionCone(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Utils.distance(this.x, this.y, target.x, target.y);

        if (dist < CONFIG.CELL_SIZE * 0.5) return true;

        const angleToPlayer = Math.atan2(dy, dx);
        const facingAngle = this._getFacingAngle();

        let angleDiff = angleToPlayer - facingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const halfCone = (CONFIG.VISION_ANGLE * Math.PI / 180) / 2;
        return Math.abs(angleDiff) <= halfCone;
    }

    _hasLineOfSightTo(target, maze) {
        const x0 = this.x;
        const y0 = this.y;
        const x1 = target.x;
        const y1 = target.y;

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

    _updateAIState(player, maze, deltaTime, decoys = []) {
        if (this.state === EnemyState.STUNNED) {
            this.stunTimer -= deltaTime;
            if (this.stunTimer <= 0) {
                this._setState(EnemyState.PATROL);
                this.targetDecoy = null;
            }
            return;
        }

        let activeDecoy = null;
        for (const decoy of decoys) {
            if (decoy && !decoy.expired && this.canDetectTarget(decoy, maze)) {
                activeDecoy = decoy;
                break;
            }
        }
        this.targetDecoy = activeDecoy;

        const effectiveTarget = activeDecoy || player;
        const canSeeTarget = activeDecoy ? this.canDetectTarget(activeDecoy, maze) : this.canDetectPlayer(player, maze);
        this.canSeePlayer = this.canDetectPlayer(player, maze);
        const canHear = this.canHearPlayer(player);

        if (canSeeTarget) {
            this.lastSeenPlayerX = Math.floor((effectiveTarget.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
            this.lastSeenPlayerY = Math.floor((effectiveTarget.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
        }

        switch (this.state) {
            case EnemyState.PATROL:
                if (canSeeTarget) {
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
                if (canSeeTarget && this.reactionTimer <= 0) {
                    this._setState(EnemyState.CHASE);
                } else if (!canSeeTarget) {
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

                if (!canSeeTarget) {
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
                if (canSeeTarget) {
                    this.reactionTimer = CONFIG.AI_REACTION_DELAY * 0.5;
                    this._setState(EnemyState.ALERT);
                } else if (this.stateTimer >= CONFIG.AI_SEARCH_DURATION) {
                    this._setState(EnemyState.PATROL);
                }
                break;

            case EnemyState.FATIGUE:
                this.stateTimer += deltaTime;
                if (canSeeTarget) {
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

    renderVisionRange(ctx, maze) {
        if (this.state === EnemyState.STUNNED) return;
        if (!maze) return;

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
        const maxRadius = CONFIG.VISION_RANGE * CONFIG.CELL_SIZE;
        const rayCount = 40;
        const angleStep = (halfCone * 2) / rayCount;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);

        for (let i = 0; i <= rayCount; i++) {
            const angle = facingAngle - halfCone + i * angleStep;
            const dist = this._raycastVisionDistance(angle, maxRadius, maze);
            const px = this.x + Math.cos(angle) * dist;
            const py = this.y + Math.sin(angle) * dist;
            ctx.lineTo(px, py);
        }

        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    render(ctx, maze) {
        this.renderVisionRange(ctx, maze);

        ctx.save();
        if (this.state === EnemyState.STUNNED) {
            const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
            ctx.shadowColor = CONFIG.COLORS.ENEMY_STUN_GLOW;
            ctx.fillStyle = CONFIG.COLORS.ENEMY_STUN;
        } else {
            ctx.shadowBlur = CONFIG.GLOW_INTENSITY;
            ctx.shadowColor = CONFIG.COLORS.ENEMY_GLOW;
            ctx.fillStyle = CONFIG.COLORS.ENEMY;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.state !== EnemyState.STUNNED) {
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
        } else {
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
        }

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
        } else if (this.state === EnemyState.STUNNED) {
            const pulse = Math.sin(Date.now() / 150);
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText('★' + (pulse > 0 ? '☆' : '★'), this.x, this.y - this.radius - 8);
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
