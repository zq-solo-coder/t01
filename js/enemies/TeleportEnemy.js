'use strict';

class TeleportEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'teleport');
        this.teleportTimer = 0;
        this.isWarning = false;
        this.warningTimer = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.teleportInterval = CONFIG.TELEPORT_INTERVAL;
    }

    update(player, maze, deltaTime, decoys = []) {
        this._updateCellPosition();

        if (this.state === EnemyState.STUNNED) {
            this._updateAIState(player, maze, deltaTime, decoys);
            return;
        }

        if (this.isWarning) {
            this.warningTimer -= deltaTime;
            if (this.warningTimer <= 0) {
                this.x = this.targetX;
                this.y = this.targetY;
                this._updateCellPosition();
                this.isWarning = false;
                this.teleportTimer = 0;
                this.currentPath = [];
                this.currentPathIndex = 0;
            }
            return;
        }

        this._updateAIState(player, maze, deltaTime, decoys);

        if (this.state === EnemyState.STUNNED) return;

        this.pathRecalcTimer += deltaTime;
        this.teleportTimer += deltaTime;

        const shouldTeleport = (this.state === EnemyState.CHASE || this.state === EnemyState.ALERT)
            && this.teleportTimer >= this.teleportInterval
            && !this.canSeePlayer;

        if (shouldTeleport) {
            this._tryTeleport(player, maze);
            if (this.isWarning) return;
        }

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

    _tryTeleport(player, maze) {
        const playerCellX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        const playerCellY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);

        const validPositions = [];
        for (let dx = -5; dx <= 5; dx++) {
            for (let dy = -5; dy <= 5; dy++) {
                const dist = Math.abs(dx) + Math.abs(dy);
                if (dist >= 3 && dist <= 5) {
                    const nx = playerCellX + dx;
                    const ny = playerCellY + dy;
                    const cell = maze.getCell(nx, ny);
                    if (cell && cell.isCarved) {
                        validPositions.push({ x: nx, y: ny });
                    }
                }
            }
        }

        if (validPositions.length > 0) {
            const target = Utils.randomChoice(validPositions);
            this.targetX = target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
            this.targetY = target.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;
            this.isWarning = true;
            this.warningTimer = CONFIG.TELEPORT_WARNING;
        } else {
            this.teleportTimer = 0;
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
        this._followPath(maze, CONFIG.PATROL_SPEED * 0.8, deltaTime);
    }

    _getRandomNearbyCell(maze) {
        const candidates = [];
        const range = 5;
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

        this._followPath(maze, CONFIG.TELEPORT_SPEED, deltaTime);
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

    render(ctx) {
        if (this.isWarning) {
            ctx.save();
            const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5;
            ctx.globalAlpha = pulse;
            ctx.shadowBlur = 30;
            ctx.shadowColor = CONFIG.COLORS.ENEMY_GLOW;
            ctx.fillStyle = CONFIG.COLORS.ENEMY;

            ctx.beginPath();
            ctx.arc(this.targetX, this.targetY, this.radius * 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = CONFIG.COLORS.ENEMY;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.targetX, this.targetY, this.radius * 2 + pulse * 20, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }

        super.render(ctx);
    }
}
