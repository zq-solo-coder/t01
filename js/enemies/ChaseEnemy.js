'use strict';

class ChaseEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'chase');
    }

    update(player, maze, deltaTime) {
        this._updateCellPosition();
        this._updateAIState(player, maze, deltaTime);
        this.pathRecalcTimer += deltaTime;

        switch (this.state) {
            case EnemyState.PATROL:
                this._wander(maze, deltaTime);
                break;
            case EnemyState.ALERT:
                this._standAndLook(player, deltaTime);
                break;
            case EnemyState.CHASE:
                this._chasePlayer(player, maze, deltaTime);
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
        this._followPath(maze, CONFIG.PATROL_SPEED * 0.9, deltaTime);
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

    _standAndLook(player, deltaTime) {
        if (this.canSeePlayer) {
            this._updateFacingDirection(player.x, player.y);
        }
    }

    _chasePlayer(player, maze, deltaTime) {
        const playerCellX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        const playerCellY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);

        if (this.pathRecalcTimer >= CONFIG.AI_PATH_RECALC_INTERVAL ||
            this.currentPath.length === 0 ||
            this.currentPathIndex >= this.currentPath.length) {
            this.currentPath = maze.findPath(this.cellX, this.cellY, playerCellX, playerCellY);
            this.currentPathIndex = 0;
            this.pathRecalcTimer = 0;
        }

        this._followPath(maze, CONFIG.CHASE_SPEED, deltaTime);
    }

    _searchLastSeen(maze, deltaTime) {
        if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
            if (this.searchIndex < this.searchPoints.length) {
                const target = this.searchPoints[this.searchIndex];
                this.searchIndex++;
                this.currentPath = maze.findPath(this.cellX, this.cellY, target.x, target.y);
                this.currentPathIndex = 0;
            } else {
                this._generateSearchPoints();
                this.searchIndex = 0;
            }
        }
        this._followPath(maze, CONFIG.PATROL_SPEED, deltaTime);
    }

    _rest(deltaTime) {
    }
}
