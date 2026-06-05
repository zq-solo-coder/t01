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

    update(player, maze, deltaTime) {
        this._updateCellPosition();

        this.teleportTimer += deltaTime;

        if (this.isWarning) {
            this.warningTimer -= deltaTime;
            if (this.warningTimer <= 0) {
                this.x = this.targetX;
                this.y = this.targetY;
                this._updateCellPosition();
                this.isWarning = false;
                this.teleportTimer = 0;
            }
            return;
        }

        if (this.teleportTimer >= this.teleportInterval) {
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
                        if (cell) {
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

        const playerCellX = Math.floor((player.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        const playerCellY = Math.floor((player.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
        
        let targetCellX = this.cellX;
        let targetCellY = this.cellY;
        let found = false;
        
        const directions = Utils.shuffle([0, 1, 2, 3]);
        for (const dir of directions) {
            if (maze.canMove(this.cellX, this.cellY, dir)) {
                const newCellX = this.cellX + DIR_VECTORS[dir].x;
                const newCellY = this.cellY + DIR_VECTORS[dir].y;
                
                const currentDist = Utils.manhattanDistance(this.cellX, this.cellY, playerCellX, playerCellY);
                const newDist = Utils.manhattanDistance(newCellX, newCellY, playerCellX, playerCellY);
                
                if (newDist < currentDist) {
                    targetCellX = newCellX;
                    targetCellY = newCellY;
                    found = true;
                    break;
                }
            }
        }

        if (found) {
            const targetX = targetCellX * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_X;
            const targetY = targetCellY * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + CONFIG.MAZE_OFFSET_Y;
            this.moveTowards(targetX, targetY, CONFIG.TELEPORT_SPEED, maze);
        }
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
