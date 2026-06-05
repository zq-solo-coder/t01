'use strict';

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = CONFIG.ENEMY_RADIUS;
        this.cellX = 0;
        this.cellY = 0;
        this._updateCellPosition();
    }

    _updateCellPosition() {
        this.cellX = Math.floor((this.x - CONFIG.MAZE_OFFSET_X) / CONFIG.CELL_SIZE);
        this.cellY = Math.floor((this.y - CONFIG.MAZE_OFFSET_Y) / CONFIG.CELL_SIZE);
    }

    checkCollision(player) {
        const dist = Utils.distance(this.x, this.y, player.x, player.y);
        return dist < this.radius + player.radius;
    }

    renderVisionRange(ctx) {
        ctx.save();
        ctx.fillStyle = CONFIG.COLORS.ENEMY_VISION;
        ctx.beginPath();
        ctx.arc(this.x, this.y, CONFIG.VISION_RANGE * CONFIG.CELL_SIZE, 0, Math.PI * 2);
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
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - 2, 3, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
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
