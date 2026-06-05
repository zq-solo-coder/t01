'use strict';

class Maze {
    constructor(width, height, level = 1) {
        this.width = width;
        this.height = height;
        this.level = level;
        this.cells = [];
        this.startCell = null;
        this.endCell = null;
        this.mainPath = [];
        this.offsetX = (CONFIG.LOGICAL_WIDTH - width * CONFIG.CELL_SIZE) / 2;
        this.offsetY = (CONFIG.LOGICAL_HEIGHT - height * CONFIG.CELL_SIZE) / 2;
    }

    generate() {
        this._initCells();
        this._generateMainPath();
        this._addLoops();
        this._addHideNiches();
        this._addDeadEnds();
        this._setStartAndEnd();
    }

    _initCells() {
        this.cells = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(new Cell(x, y));
            }
            this.cells.push(row);
        }
    }

    _generateMainPath() {
        const startX = 0;
        const startY = Math.floor(this.height / 2);
        const startCell = this.getCell(startX, startY);
        startCell.isCarved = true;
        startCell.isOnMainPath = true;

        const stack = [startCell];
        this.mainPath = [startCell];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this._getUncarvedNeighbors(current);

            if (neighbors.length > 0) {
                const next = Utils.randomChoice(neighbors);
                this._removeWall(current, next);
                next.isCarved = true;
                next.isOnMainPath = true;
                stack.push(next);
                this.mainPath.push(next);
            } else {
                stack.pop();
            }
        }
    }

    _addLoops() {
        const loopCount = Math.max(2, 5 - Math.floor(this.level / 2));
        const zoneCols = Math.max(1, Math.ceil(this.width / 3));
        const zoneRows = Math.max(1, Math.ceil(this.height / 2));
        const seenKeys = new Set();
        const allCandidates = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.getCell(x, y);
                if (!cell.isCarved || cell.isHideNiche) continue;

                for (let dir = 0; dir < 4; dir++) {
                    const nx = x + DIR_VECTORS[dir].x;
                    const ny = y + DIR_VECTORS[dir].y;
                    const neighbor = this.getCell(nx, ny);
                    if (!neighbor) continue;
                    if (!neighbor.isCarved || neighbor.isHideNiche) continue;
                    if (!cell.walls[dir]) continue;

                    const minX = Math.min(x, nx);
                    const minY = Math.min(y, ny);
                    const maxX = Math.max(x, nx);
                    const maxY = Math.max(y, ny);
                    const key = `${minX},${minY},${maxX},${maxY}`;
                    if (seenKeys.has(key)) continue;
                    seenKeys.add(key);

                    const midX = (x + nx) / 2;
                    const midY = (y + ny) / 2;
                    const zoneX = Math.floor(midX / zoneCols);
                    const zoneY = Math.floor(midY / zoneRows);
                    const wallDir = cell.x < neighbor.x ? Direction.RIGHT :
                                    cell.x > neighbor.x ? Direction.LEFT :
                                    cell.y < neighbor.y ? Direction.BOTTOM : Direction.TOP;

                    allCandidates.push({
                        key,
                        c1: cell,
                        c2: neighbor,
                        wallDir,
                        zoneX,
                        zoneY
                    });
                }
            }
        }

        const zones = new Map();
        for (const c of allCandidates) {
            const zk = `${c.zoneX},${c.zoneY}`;
            if (!zones.has(zk)) zones.set(zk, []);
            zones.get(zk).push(c);
        }
        for (const list of zones.values()) Utils.shuffle(list);
        const zoneKeys = Utils.shuffle([...zones.keys()]);

        const processed = new Set();
        const zoneLists = [...zones.values()];
        const maxRound = zoneLists.length > 0
            ? Math.max(...zoneLists.map(l => l.length))
            : 0;

        let created = 0;
        let round = 0;
        while (created < loopCount && round < maxRound) {
            let progressed = false;
            for (const zk of zoneKeys) {
                const list = zones.get(zk);
                if (!list || round >= list.length) continue;

                const pair = list[round];
                if (processed.has(pair.key)) continue;
                processed.add(pair.key);

                if (pair.c1.walls[pair.wallDir]) {
                    this._removeWall(pair.c1, pair.c2);
                    created++;
                    progressed = true;
                    if (created >= loopCount) break;
                }
            }
            if (!progressed) break;
            round++;
        }

        if (created < loopCount) {
            const remaining = Utils.shuffle(allCandidates);
            for (const pair of remaining) {
                if (processed.has(pair.key)) continue;
                processed.add(pair.key);
                if (pair.c1.walls[pair.wallDir]) {
                    this._removeWall(pair.c1, pair.c2);
                    created++;
                    if (created >= loopCount) break;
                }
            }
        }
    }

    _addHideNiches() {
        const nicheCount = Math.max(3, 6 - Math.floor(this.level / 3));
        const nicheCells = [];
        const candidates = [];

        for (let i = 1; i < this.mainPath.length - 1; i++) {
            const pathCell = this.mainPath[i];
            if (this._isEdgeCell(pathCell)) continue;

            const prevCell = this.mainPath[i - 1];
            const nextCell = this.mainPath[i + 1];
            const pathDirs = new Set();
            if (prevCell) {
                const dx = prevCell.x - pathCell.x;
                const dy = prevCell.y - pathCell.y;
                if (dx === 1) pathDirs.add(Direction.RIGHT);
                else if (dx === -1) pathDirs.add(Direction.LEFT);
                else if (dy === 1) pathDirs.add(Direction.BOTTOM);
                else if (dy === -1) pathDirs.add(Direction.TOP);
            }
            if (nextCell) {
                const dx = nextCell.x - pathCell.x;
                const dy = nextCell.y - pathCell.y;
                if (dx === 1) pathDirs.add(Direction.RIGHT);
                else if (dx === -1) pathDirs.add(Direction.LEFT);
                else if (dy === 1) pathDirs.add(Direction.BOTTOM);
                else if (dy === -1) pathDirs.add(Direction.TOP);
            }

            const perpendicularDirs = [];
            if (!pathDirs.has(Direction.TOP) && !pathDirs.has(Direction.BOTTOM)) {
                perpendicularDirs.push(Direction.TOP, Direction.BOTTOM);
            }
            if (!pathDirs.has(Direction.LEFT) && !pathDirs.has(Direction.RIGHT)) {
                perpendicularDirs.push(Direction.LEFT, Direction.RIGHT);
            }
            if (perpendicularDirs.length === 0) {
                for (let d = 0; d < 4; d++) {
                    if (!pathDirs.has(d)) perpendicularDirs.push(d);
                }
            }
            Utils.shuffle(perpendicularDirs);

            for (const dir of perpendicularDirs) {
                const nx = pathCell.x + DIR_VECTORS[dir].x;
                const ny = pathCell.y + DIR_VECTORS[dir].y;
                const nicheEntry = this.getCell(nx, ny);
                if (nicheEntry && !nicheEntry.isCarved && !nicheEntry.isHideNiche && !this._isEdgeCell(nicheEntry)) {
                    candidates.push({ pathCell, dir, entryCell: nicheEntry });
                }
            }
        }

        const shuffled = Utils.shuffle(candidates);
        for (const cand of shuffled) {
            if (nicheCells.length >= nicheCount) break;
            if (cand.entryCell.isCarved || cand.entryCell.isHideNiche) continue;

            this._removeWall(cand.pathCell, cand.entryCell);
            cand.entryCell.isCarved = true;
            cand.entryCell.isHideNiche = true;
            nicheCells.push(cand.entryCell);

            if (Utils.randomChoice([true, false])) {
                const depth = Utils.randomInt(1, 2);
                let current = cand.entryCell;
                for (let d = 0; d < depth; d++) {
                    const nnx = current.x + DIR_VECTORS[cand.dir].x;
                    const nny = current.y + DIR_VECTORS[cand.dir].y;
                    const deeper = this.getCell(nnx, nny);
                    if (deeper && !deeper.isCarved && !deeper.isHideNiche && !this._isEdgeCell(deeper)) {
                        this._removeWall(current, deeper);
                        deeper.isCarved = true;
                        deeper.isHideNiche = true;
                        nicheCells.push(deeper);
                        current = deeper;
                    } else {
                        break;
                    }
                }
            }
        }
    }

    _addDeadEnds() {
        const branchCount = Utils.randomInt(2, 3);
        const pathCells = this.mainPath.filter(c => !this._isEdgeCell(c));
        
        for (let i = 0; i < branchCount; i++) {
            const branchStart = Utils.randomChoice(pathCells);
            this._growBranch(branchStart);
        }
    }

    _growBranch(startCell) {
        let current = startCell;
        const branchLength = Utils.randomInt(2, 4);

        for (let i = 0; i < branchLength; i++) {
            const neighbors = this._getUncarvedNeighbors(current);
            if (neighbors.length === 0) break;

            const next = Utils.randomChoice(neighbors);
            this._removeWall(current, next);
            next.isCarved = true;
            current = next;
        }
    }

    _setStartAndEnd() {
        this.startCell = this.getCell(0, Math.floor(this.height / 2));
        this.endCell = this.getCell(this.width - 1, Math.floor(this.height / 2));
    }

    _getUncarvedNeighbors(cell) {
        const neighbors = [];
        for (let dir = 0; dir < 4; dir++) {
            const nx = cell.x + DIR_VECTORS[dir].x;
            const ny = cell.y + DIR_VECTORS[dir].y;
            const neighbor = this.getCell(nx, ny);
            if (neighbor && !neighbor.isCarved) {
                neighbors.push(neighbor);
            }
        }
        return Utils.shuffle(neighbors);
    }

    _removeWall(cell1, cell2) {
        const dx = cell2.x - cell1.x;
        const dy = cell2.y - cell1.y;

        if (dx === 1) {
            cell1.walls[Direction.RIGHT] = false;
            cell2.walls[Direction.LEFT] = false;
        } else if (dx === -1) {
            cell1.walls[Direction.LEFT] = false;
            cell2.walls[Direction.RIGHT] = false;
        } else if (dy === 1) {
            cell1.walls[Direction.BOTTOM] = false;
            cell2.walls[Direction.TOP] = false;
        } else if (dy === -1) {
            cell1.walls[Direction.TOP] = false;
            cell2.walls[Direction.BOTTOM] = false;
        }
    }

    _isEdgeCell(cell) {
        return cell.x === 0 || cell.x === this.width - 1 || 
               cell.y === 0 || cell.y === this.height - 1;
    }

    getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }
        return this.cells[y][x];
    }

    canMove(cellX, cellY, direction) {
        const cell = this.getCell(cellX, cellY);
        return cell && !cell.walls[direction];
    }

    moveCircle(x, y, radius, dx, dy) {
        const result = { x: x + dx, y: y + dy, collided: false };
        const totalDist = Math.sqrt(dx * dx + dy * dy);
        
        if (totalDist < 0.01) {
            return this.resolvePosition(result.x, result.y, radius);
        }
        
        const subSteps = Math.max(1, Math.ceil(totalDist / (radius * 0.5)));
        const stepDx = dx / subSteps;
        const stepDy = dy / subSteps;
        
        let currentX = x;
        let currentY = y;
        
        for (let i = 0; i < subSteps; i++) {
            const nextX = currentX + stepDx;
            const nextY = currentY + stepDy;
            
            const collision = this._checkCircleCollision(nextX, nextY, radius);
            
            if (!collision.collided) {
                currentX = nextX;
                currentY = nextY;
            } else {
                result.collided = true;
                
                const slideResult = this._slideAlongWall(
                    currentX, currentY, 
                    stepDx, stepDy, 
                    radius, collision
                );
                
                currentX = slideResult.x;
                currentY = slideResult.y;
            }
        }
        
        const finalPos = this.resolvePosition(currentX, currentY, radius);
        result.x = finalPos.x;
        result.y = finalPos.y;
        
        return result;
    }

    _checkCircleCollision(cx, cy, radius) {
        const result = {
            collided: false,
            nearestX: 0,
            nearestY: 0,
            penetrationX: 0,
            penetrationY: 0,
            penetrationDepth: 0
        };
        
        const localX = cx - this.offsetX;
        const localY = cy - this.offsetY;
        
        if (localX < radius || localX >= this.width * CONFIG.CELL_SIZE - radius ||
            localY < radius || localY >= this.height * CONFIG.CELL_SIZE - radius) {
            result.collided = true;
            
            const clampedX = Utils.clamp(localX, radius, this.width * CONFIG.CELL_SIZE - radius);
            const clampedY = Utils.clamp(localY, radius, this.height * CONFIG.CELL_SIZE - radius);
            
            result.nearestX = clampedX + this.offsetX;
            result.nearestY = clampedY + this.offsetY;
            
            const dx = cx - result.nearestX;
            const dy = cy - result.nearestY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0.001) {
                result.penetrationX = dx / dist;
                result.penetrationY = dy / dist;
                result.penetrationDepth = radius - dist;
            } else {
                result.penetrationX = 0;
                result.penetrationY = -1;
                result.penetrationDepth = radius;
            }
            
            return result;
        }
        
        const cellX = Math.floor(localX / CONFIG.CELL_SIZE);
        const cellY = Math.floor(localY / CONFIG.CELL_SIZE);
        const cell = this.getCell(cellX, cellY);
        
        if (!cell) {
            result.collided = true;
            return result;
        }
        
        const cellPx = this.offsetX + cellX * CONFIG.CELL_SIZE;
        const cellPy = this.offsetY + cellY * CONFIG.CELL_SIZE;
        const thickness = CONFIG.WALL_THICKNESS;
        
        const collisions = [];
        
        if (cell.walls[Direction.TOP]) {
            const wallY = cellPy;
            const nearestX = Utils.clamp(cx, cellPx, cellPx + CONFIG.CELL_SIZE);
            const nearestY = wallY;
            const ddx = cx - nearestX;
            const ddy = cy - nearestY;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            
            if (d < radius) {
                collisions.push({
                    dist: d,
                    nearestX,
                    nearestY,
                    normalX: d > 0.001 ? ddx / d : 0,
                    normalY: d > 0.001 ? ddy / d : -1
                });
            }
        }
        
        if (cell.walls[Direction.BOTTOM]) {
            const wallY = cellPy + CONFIG.CELL_SIZE;
            const nearestX = Utils.clamp(cx, cellPx, cellPx + CONFIG.CELL_SIZE);
            const nearestY = wallY;
            const ddx = cx - nearestX;
            const ddy = cy - nearestY;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            
            if (d < radius) {
                collisions.push({
                    dist: d,
                    nearestX,
                    nearestY,
                    normalX: d > 0.001 ? ddx / d : 0,
                    normalY: d > 0.001 ? ddy / d : 1
                });
            }
        }
        
        if (cell.walls[Direction.LEFT]) {
            const wallX = cellPx;
            const nearestX = wallX;
            const nearestY = Utils.clamp(cy, cellPy, cellPy + CONFIG.CELL_SIZE);
            const ddx = cx - nearestX;
            const ddy = cy - nearestY;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            
            if (d < radius) {
                collisions.push({
                    dist: d,
                    nearestX,
                    nearestY,
                    normalX: d > 0.001 ? ddx / d : -1,
                    normalY: d > 0.001 ? ddy / d : 0
                });
            }
        }
        
        if (cell.walls[Direction.RIGHT]) {
            const wallX = cellPx + CONFIG.CELL_SIZE;
            const nearestX = wallX;
            const nearestY = Utils.clamp(cy, cellPy, cellPy + CONFIG.CELL_SIZE);
            const ddx = cx - nearestX;
            const ddy = cy - nearestY;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            
            if (d < radius) {
                collisions.push({
                    dist: d,
                    nearestX,
                    nearestY,
                    normalX: d > 0.001 ? ddx / d : 1,
                    normalY: d > 0.001 ? ddy / d : 0
                });
            }
        }
        
        if (collisions.length === 1) {
            const c = collisions[0];
            result.collided = true;
            result.nearestX = c.nearestX;
            result.nearestY = c.nearestY;
            result.penetrationX = c.normalX;
            result.penetrationY = c.normalY;
            result.penetrationDepth = radius - c.dist;
        } else if (collisions.length >= 2) {
            collisions.sort((a, b) => a.dist - b.dist);
            
            let avgNormalX = 0;
            let avgNormalY = 0;
            let totalWeight = 0;
            
            for (const c of collisions) {
                const weight = 1 / (c.dist + 0.01);
                avgNormalX += c.normalX * weight;
                avgNormalY += c.normalY * weight;
                totalWeight += weight;
            }
            
            avgNormalX /= totalWeight;
            avgNormalY /= totalWeight;
            
            const len = Math.sqrt(avgNormalX * avgNormalX + avgNormalY * avgNormalY);
            if (len > 0.001) {
                avgNormalX /= len;
                avgNormalY /= len;
            }
            
            const minDist = collisions[0].dist;
            const avgDist = collisions.reduce((sum, c) => sum + c.dist, 0) / collisions.length;
            
            result.collided = true;
            result.nearestX = collisions[0].nearestX;
            result.nearestY = collisions[0].nearestY;
            result.penetrationX = avgNormalX;
            result.penetrationY = avgNormalY;
            result.penetrationDepth = radius - Math.min(minDist, avgDist * 0.8);
        }
        
        return result;
    }

    _slideAlongWall(x, y, dx, dy, radius, collision) {
        const nx = collision.penetrationX;
        const ny = collision.penetrationY;
        
        const dotProduct = dx * nx + dy * ny;
        const slideDx = dx - dotProduct * nx;
        const slideDy = dy - dotProduct * ny;
        
        const slideDist = Math.sqrt(slideDx * slideDx + slideDy * slideDy);
        if (slideDist < 0.01) {
            return { x, y };
        }
        
        const nextX = x + slideDx;
        const nextY = y + slideDy;
        
        const newCollision = this._checkCircleCollision(nextX, nextY, radius);
        
        if (!newCollision.collided) {
            return { x: nextX, y: nextY };
        }
        
        const pushedX = nextX + newCollision.penetrationX * newCollision.penetrationDepth * 1.01;
        const pushedY = nextY + newCollision.penetrationY * newCollision.penetrationDepth * 1.01;
        
        const finalCollision = this._checkCircleCollision(pushedX, pushedY, radius);
        if (!finalCollision.collided) {
            return { x: pushedX, y: pushedY };
        }
        
        return { x, y };
    }

    resolvePosition(x, y, radius) {
        let collision = this._checkCircleCollision(x, y, radius);
        
        if (!collision.collided) {
            return { x, y };
        }
        
        const maxPushAttempts = 10;
        let currentX = x;
        let currentY = y;
        
        for (let attempt = 0; attempt < maxPushAttempts; attempt++) {
            collision = this._checkCircleCollision(currentX, currentY, radius);
            
            if (!collision.collided) {
                break;
            }
            
            const pushDist = Math.max(collision.penetrationDepth + 1, 2);
            const pushX = collision.penetrationX * pushDist;
            const pushY = collision.penetrationY * pushDist;
            
            currentX += pushX;
            currentY += pushY;
            
            const testCollision = this._checkCircleCollision(currentX, currentY, radius);
            if (!testCollision.collided) {
                break;
            }
        }
        
        collision = this._checkCircleCollision(currentX, currentY, radius);
        if (!collision.collided) {
            return { x: currentX, y: currentY };
        }
        
        let bestX = currentX;
        let bestY = currentY;
        let minPenetration = Infinity;
        
        const searchRange = Math.ceil(radius * 1.5) + 5;
        const step = 1;
        
        for (let sy = -searchRange; sy <= searchRange; sy += step) {
            for (let sx = -searchRange; sx <= searchRange; sx += step) {
                if (sx === 0 && sy === 0) continue;
                
                const testX = x + sx;
                const testY = y + sy;
                const testCollision = this._checkCircleCollision(testX, testY, radius);
                
                if (!testCollision.collided) {
                    const dist = Math.abs(sx) + Math.abs(sy);
                    if (dist < minPenetration) {
                        minPenetration = dist;
                        bestX = testX;
                        bestY = testY;
                    }
                }
            }
        }
        
        if (minPenetration < Infinity) {
            return { x: bestX, y: bestY };
        }
        
        const cellX = Math.floor((x - this.offsetX) / CONFIG.CELL_SIZE);
        const cellY = Math.floor((y - this.offsetY) / CONFIG.CELL_SIZE);
        const centerX = this.offsetX + cellX * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const centerY = this.offsetY + cellY * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        
        return { x: centerX, y: centerY };
    }

    isValidPosition(x, y, radius) {
        const collision = this._checkCircleCollision(x, y, radius);
        return !collision.collided;
    }

    getRandomEmptyPosition(avoidCells = []) {
        let attempts = 0;
        while (attempts < 100) {
            const cellX = Utils.randomInt(0, this.width - 1);
            const cellY = Utils.randomInt(0, this.height - 1);
            const cell = this.getCell(cellX, cellY);
            
            if (cell && !avoidCells.some(c => c.x === cellX && c.y === cellY)) {
                return {
                    x: this.offsetX + cellX * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
                    y: this.offsetY + cellY * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
                    cellX,
                    cellY
                };
            }
            attempts++;
        }
        return null;
    }

    render(ctx) {
        ctx.save();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.cells[y][x];
                const px = this.offsetX + x * CONFIG.CELL_SIZE;
                const py = this.offsetY + y * CONFIG.CELL_SIZE;

                ctx.fillStyle = cell.isHideNiche ? CONFIG.COLORS.NICHE_BG : '#1a1a2e';
                ctx.fillRect(px, py, CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);
            }
        }

        ctx.shadowBlur = CONFIG.GLOW_INTENSITY;
        ctx.shadowColor = CONFIG.COLORS.WALL_GLOW;
        ctx.strokeStyle = CONFIG.COLORS.WALL;
        ctx.lineWidth = CONFIG.WALL_THICKNESS;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.cells[y][x];
                const px = this.offsetX + x * CONFIG.CELL_SIZE;
                const py = this.offsetY + y * CONFIG.CELL_SIZE;

                if (cell.walls[Direction.TOP]) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + CONFIG.CELL_SIZE, py);
                    ctx.stroke();
                }
                if (cell.walls[Direction.RIGHT]) {
                    ctx.beginPath();
                    ctx.moveTo(px + CONFIG.CELL_SIZE, py);
                    ctx.lineTo(px + CONFIG.CELL_SIZE, py + CONFIG.CELL_SIZE);
                    ctx.stroke();
                }
                if (cell.walls[Direction.BOTTOM]) {
                    ctx.beginPath();
                    ctx.moveTo(px, py + CONFIG.CELL_SIZE);
                    ctx.lineTo(px + CONFIG.CELL_SIZE, py + CONFIG.CELL_SIZE);
                    ctx.stroke();
                }
                if (cell.walls[Direction.LEFT]) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px, py + CONFIG.CELL_SIZE);
                    ctx.stroke();
                }
            }
        }

        const pulse = Math.sin(Date.now() / 400) * 0.2 + 0.8;
        ctx.shadowBlur = CONFIG.GLOW_INTENSITY * 0.6 * pulse;
        ctx.shadowColor = CONFIG.COLORS.NICHE_GLOW;
        ctx.strokeStyle = CONFIG.COLORS.NICHE_BORDER;
        ctx.lineWidth = 2;

        const inset = CONFIG.WALL_THICKNESS;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.cells[y][x];
                if (!cell.isHideNiche) continue;
                const px = this.offsetX + x * CONFIG.CELL_SIZE;
                const py = this.offsetY + y * CONFIG.CELL_SIZE;
                const innerL = px + inset;
                const innerT = py + inset;
                const innerR = px + CONFIG.CELL_SIZE - inset;
                const innerB = py + CONFIG.CELL_SIZE - inset;

                if (cell.walls[Direction.TOP]) {
                    ctx.beginPath();
                    ctx.moveTo(innerL, innerT);
                    ctx.lineTo(innerR, innerT);
                    ctx.stroke();
                }
                if (cell.walls[Direction.RIGHT]) {
                    ctx.beginPath();
                    ctx.moveTo(innerR, innerT);
                    ctx.lineTo(innerR, innerB);
                    ctx.stroke();
                }
                if (cell.walls[Direction.BOTTOM]) {
                    ctx.beginPath();
                    ctx.moveTo(innerL, innerB);
                    ctx.lineTo(innerR, innerB);
                    ctx.stroke();
                }
                if (cell.walls[Direction.LEFT]) {
                    ctx.beginPath();
                    ctx.moveTo(innerL, innerT);
                    ctx.lineTo(innerL, innerB);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();

        this._renderExit(ctx);
    }

    _renderExit(ctx) {
        if (!this.endCell) return;
        
        const px = this.offsetX + this.endCell.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const py = this.offsetY + this.endCell.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
        
        ctx.save();
        ctx.shadowBlur = CONFIG.GLOW_INTENSITY * pulse;
        ctx.shadowColor = CONFIG.COLORS.EXIT_GLOW;
        ctx.fillStyle = CONFIG.COLORS.EXIT;
        
        ctx.beginPath();
        ctx.arc(px, py, CONFIG.CORE_RADIUS * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.font = 'bold 12px Consolas';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('出口', px, py);
        
        ctx.restore();
    }

    findPath(startX, startY, endX, endY) {
        const start = this.getCell(startX, startY);
        const end = this.getCell(endX, endY);
        
        if (!start || !end) return [];
        
        const queue = [start];
        const visited = new Set();
        const parent = new Map();
        
        visited.add(`${start.x},${start.y}`);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.x === end.x && current.y === end.y) {
                return this._reconstructPath(parent, start, end);
            }
            
            for (let dir = 0; dir < 4; dir++) {
                if (!current.walls[dir]) {
                    const nx = current.x + DIR_VECTORS[dir].x;
                    const ny = current.y + DIR_VECTORS[dir].y;
                    const key = `${nx},${ny}`;
                    
                    if (!visited.has(key)) {
                        const next = this.getCell(nx, ny);
                        if (next) {
                            visited.add(key);
                            parent.set(key, current);
                            queue.push(next);
                        }
                    }
                }
            }
        }
        
        return [];
    }

    _reconstructPath(parent, start, end) {
        const path = [];
        let current = end;
        const startKey = `${start.x},${start.y}`;
        
        while (current) {
            path.unshift(current);
            const key = `${current.x},${current.y}`;
            if (key === startKey) break;
            current = parent.get(key);
        }
        
        return path;
    }
}
