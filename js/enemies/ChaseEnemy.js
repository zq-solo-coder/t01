'use strict';

class ChaseEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'chase');
        this.moveTimer = 0;
    }

    update(player, maze, deltaTime) {
        this._updateCellPosition();
        this.moveTimer += deltaTime;
        
        if (this.moveTimer < 16) return;
        this.moveTimer = 0;

        const playerCellX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        const playerCellY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);

        const directions = [];
        
        if (playerCellX < this.cellX) directions.push(Direction.LEFT);
        if (playerCellX > this.cellX) directions.push(Direction.RIGHT);
        if (playerCellY < this.cellY) directions.push(Direction.TOP);
        if (playerCellY > this.cellY) directions.push(Direction.BOTTOM);

        if (Math.abs(playerCellX - this.cellX) > Math.abs(playerCellY - this.cellY)) {
            directions.sort((a, b) => {
                const aHorizontal = (a === Direction.LEFT || a === Direction.RIGHT) ? 0 : 1;
                const bHorizontal = (b === Direction.LEFT || b === Direction.RIGHT) ? 0 : 1;
                return aHorizontal - bHorizontal;
            });
        }

        let targetCellX = this.cellX;
        let targetCellY = this.cellY;
        let found = false;
        
        for (const dir of directions) {
            if (maze.canMove(this.cellX, this.cellY, dir)) {
                targetCellX = this.cellX + DIR_VECTORS[dir].x;
                targetCellY = this.cellY + DIR_VECTORS[dir].y;
                found = true;
                break;
            }
        }

        if (!found) {
            const allDirs = Utils.shuffle([0, 1, 2, 3]);
            for (const dir of allDirs) {
                if (maze.canMove(this.cellX, this.cellY, dir)) {
                    targetCellX = this.cellX + DIR_VECTORS[dir].x;
                    targetCellY = this.cellY + DIR_VECTORS[dir].y;
                    found = true;
                    break;
                }
            }
        }

        if (found) {
            const targetX = targetCellX * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
            const targetY = targetCellY * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;
            this.moveTowards(targetX, targetY, CONFIG.CHASE_SPEED, maze);
        }
    }
}
