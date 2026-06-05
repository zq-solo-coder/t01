'use strict';

class PatrolEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'patrol');
        this.path = [];
        this.pathIndex = 0;
        this.direction = 1;
        this.isChasing = false;
        this.chasePath = [];
        this.chaseTimer = 0;
        this.moveTimer = 0;
    }

    setPatrolPath(path) {
        this.path = path;
        if (path.length > 0) {
            this.x = path[0].x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
            this.y = path[0].y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;
            this._updateCellPosition();
        }
    }

    update(player, maze, deltaTime) {
        this._updateCellPosition();

        const playerCellX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        const playerCellY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
        const distToPlayer = Utils.manhattanDistance(this.cellX, this.cellY, playerCellX, playerCellY);

        if (distToPlayer <= CONFIG.VISION_RANGE && !this.isChasing) {
            this.isChasing = true;
            this.chasePath = maze.findPath(this.cellX, this.cellY, playerCellX, playerCellY);
            this.chaseTimer = 3000;
        }

        if (this.isChasing) {
            this.chaseTimer -= deltaTime;
            if (this.chaseTimer <= 0 || this.chasePath.length === 0) {
                this.isChasing = false;
            } else {
                this._chasePlayer(maze, deltaTime);
            }
        } else {
            this._patrol(maze, deltaTime);
        }
    }

    _patrol(maze, deltaTime) {
        if (this.path.length < 2) return;

        this.moveTimer += deltaTime;
        if (this.moveTimer < 16) return;
        this.moveTimer = 0;

        const target = this.path[this.pathIndex];
        const targetX = target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
        const targetY = target.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;

        const dist = Utils.distance(this.x, this.y, targetX, targetY);

        if (dist < 5) {
            this.pathIndex += this.direction;
            if (this.pathIndex >= this.path.length || this.pathIndex < 0) {
                this.direction *= -1;
                this.pathIndex += this.direction * 2;
            }
        } else {
            this.moveTowards(targetX, targetY, CONFIG.PATROL_SPEED, maze);
        }
    }

    _chasePlayer(maze, deltaTime) {
        if (this.chasePath.length === 0) return;

        this.moveTimer += deltaTime;
        if (this.moveTimer < 16) return;
        this.moveTimer = 0;

        const target = this.chasePath[0];
        const targetX = target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
        const targetY = target.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;

        const dist = Utils.distance(this.x, this.y, targetX, targetY);

        if (dist < 8) {
            this.chasePath.shift();
        } else {
            this.moveTowards(targetX, targetY, CONFIG.CHASE_SPEED, maze);
        }
    }
}
