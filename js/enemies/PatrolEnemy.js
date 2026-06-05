'use strict';

class PatrolEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'patrol');
        this.patrolPath = [];
        this.patrolIndex = 0;
        this.patrolDirection = 1;
    }

    setPatrolPath(path) {
        this.patrolPath = path;
        if (path.length > 0) {
            this.x = path[0].x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
            this.y = path[0].y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;
            this._updateCellPosition();
            if (path.length > 1) {
                const next = path[1];
                const nextX = next.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
                const nextY = next.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;
                this._updateFacingDirection(nextX, nextY);
            }
        }
    }

    update(player, maze, deltaTime) {
        this._updateCellPosition();
        this._updateAIState(player, maze, deltaTime);
        this.pathRecalcTimer += deltaTime;

        switch (this.state) {
            case EnemyState.PATROL:
                this._patrol(maze, deltaTime);
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

    _patrol(maze, deltaTime) {
        if (this.patrolPath.length < 2) return;

        if (this.currentPath.length === 0 || this.currentPathIndex >= this.currentPath.length) {
            const target = this.patrolPath[this.patrolIndex];
            this.patrolIndex += this.patrolDirection;
            if (this.patrolIndex >= this.patrolPath.length || this.patrolIndex < 0) {
                this.patrolDirection *= -1;
                this.patrolIndex += this.patrolDirection * 2;
            }
            this.currentPath = maze.findPath(this.cellX, this.cellY, target.x, target.y);
            this.currentPathIndex = 0;
        }
        this._followPath(maze, CONFIG.PATROL_SPEED, deltaTime);
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
            if (!this._advanceSearchTarget(maze)) {
                return;
            }
        }
        this._followPath(maze, CONFIG.PATROL_SPEED, deltaTime);
    }

    _rest(deltaTime) {
    }
}
