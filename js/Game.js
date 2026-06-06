'use strict';

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.state = GameState.MENU;
        this.level = 1;
        this.score = 0;
        this.highScore = this._loadHighScore();
        this.highestLevel = this._loadHighestLevel();

        this.keys = {};
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedTimeStep = 1000 / 60;

        this.maze = null;
        this.player = null;
        this.enemies = [];
        this.cores = [];
        this.powerups = [];
        this.decoys = [];
        this.particleSystem = new ParticleSystem();
        this.audio = new AudioSystem();
        this.screenShake = new ScreenShake();

        this.menuTimer = 0;
        this.blinkTimer = 0;

        this._setupInput();
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
    }

    _loadHighScore() {
        try {
            return parseInt(localStorage.getItem('neonMaze_highScore') || '0');
        } catch {
            return 0;
        }
    }

    _loadHighestLevel() {
        try {
            return parseInt(localStorage.getItem('neonMaze_highestLevel') || '1');
        } catch {
            return 1;
        }
    }

    _saveHighScore() {
        try {
            localStorage.setItem('neonMaze_highScore', this.highScore.toString());
            localStorage.setItem('neonMaze_highestLevel', this.highestLevel.toString());
        } catch {}
    }

    _setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'Enter') {
                if (this.state === GameState.MENU) {
                    this.start();
                } else if (this.state === GameState.GAMEOVER) {
                    this.state = GameState.MENU;
                }
            }

            if (e.code === 'Escape') {
                if (this.state === GameState.PLAYING) {
                    this.state = GameState.PAUSED;
                } else if (this.state === GameState.PAUSED) {
                    this.state = GameState.PLAYING;
                }
            }

            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'KeyR'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    _resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const ratio = CONFIG.LOGICAL_WIDTH / CONFIG.LOGICAL_HEIGHT;
        
        let width = window.innerWidth;
        let height = window.innerHeight;
        
        if (width / height > ratio) {
            width = height * ratio;
        } else {
            height = width / ratio;
        }
        
        const scale = Math.min(width / CONFIG.LOGICAL_WIDTH, height / CONFIG.LOGICAL_HEIGHT);
        container.style.transform = `scale(${scale})`;
    }

    start() {
        this.level = 1;
        this.score = 0;
        this.state = GameState.PLAYING;
        this._initLevel();
    }

    _initLevel() {
        this.maze = new Maze(CONFIG.MAZE_WIDTH, CONFIG.MAZE_HEIGHT, this.level);
        this.maze.generate();

        CONFIG.MAZE_OFFSET_X = this.maze.offsetX;
        CONFIG.MAZE_OFFSET_Y = this.maze.offsetY;

        const startX = this.maze.offsetX + this.maze.startCell.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const startY = this.maze.offsetY + this.maze.startCell.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        this.player = new Player(startX, startY);

        this._spawnEnemies();
        this._spawnCores();
        this._spawnPowerups();

        this.decoys = [];
        this.particleSystem.clear();
    }

    _spawnEnemies() {
        this.enemies = [];
        
        const enemyCount = Math.min(2 + Math.floor(this.level / 3), 5);
        const avoidCells = [this.maze.startCell, this.maze.endCell];
        
        for (let i = 0; i < enemyCount; i++) {
            const pos = this.maze.getRandomEmptyPosition(avoidCells);
            if (!pos) continue;
            
            let enemy;
            const rand = Math.random();
            
            if (this.level >= 5 && rand < 0.2) {
                enemy = new TeleportEnemy(pos.x, pos.y);
                enemy.teleportInterval = Math.max(3000, CONFIG.TELEPORT_INTERVAL - this.level * 200);
            } else if (this.level >= 3 && rand < 0.35) {
                enemy = new PhantomEnemy(pos.x, pos.y);
            } else if (rand < 0.5) {
                enemy = new PatrolEnemy(pos.x, pos.y);
                const patrolPath = this._generatePatrolPath(pos.cellX, pos.cellY);
                enemy.setPatrolPath(patrolPath);
            } else {
                enemy = new ChaseEnemy(pos.x, pos.y);
            }
            
            this.enemies.push(enemy);
            avoidCells.push({ x: pos.cellX, y: pos.cellY });
        }
    }

    _generatePatrolPath(startX, startY) {
        const path = [];
        const length = Utils.randomInt(3, 6);
        let current = this.maze.getCell(startX, startY);
        const visited = new Set();
        
        for (let i = 0; i < length && current; i++) {
            path.push({ x: current.x, y: current.y });
            visited.add(`${current.x},${current.y}`);
            
            const neighbors = [];
            for (let dir = 0; dir < 4; dir++) {
                if (!current.walls[dir]) {
                    const nx = current.x + DIR_VECTORS[dir].x;
                    const ny = current.y + DIR_VECTORS[dir].y;
                    const key = `${nx},${ny}`;
                    if (!visited.has(key)) {
                        const next = this.maze.getCell(nx, ny);
                        if (next) neighbors.push(next);
                    }
                }
            }
            
            if (neighbors.length > 0) {
                current = Utils.randomChoice(neighbors);
            } else {
                break;
            }
        }
        
        return path;
    }

    _spawnCores() {
        this.cores = [];
        
        const count = Utils.randomInt(CONFIG.CORE_COUNT_MIN, CONFIG.CORE_COUNT_MAX);
        const avoidCells = [this.maze.startCell, this.maze.endCell];
        
        for (let i = 0; i < count; i++) {
            const pos = this.maze.getRandomEmptyPosition(avoidCells);
            if (!pos) continue;
            
            this.cores.push(new EnergyCore(pos.x, pos.y));
            avoidCells.push({ x: pos.cellX, y: pos.cellY });
        }
    }

    _spawnPowerups() {
        this.powerups = [];

        const count = Utils.randomInt(CONFIG.POWERUP_COUNT_MIN, CONFIG.POWERUP_COUNT_MAX);
        const avoidCells = [this.maze.startCell, this.maze.endCell];

        const types = [PowerUpType.SHIELD, PowerUpType.SPEED, PowerUpType.FLASH];

        for (let i = 0; i < count; i++) {
            const pos = this.maze.getRandomEmptyPosition(avoidCells);
            if (!pos) continue;

            const type = Utils.randomChoice(types);
            this.powerups.push(new PowerUp(pos.x, pos.y, type));
            avoidCells.push({ x: pos.cellX, y: pos.cellY });
        }
    }

    nextLevel() {
        this.level++;
        this.score += 500 * this.level;
        this.audio.playLevelUp();
        this._initLevel();
        
        if (this.level > this.highestLevel) {
            this.highestLevel = this.level;
            this._saveHighScore();
        }
    }

    gameOver() {
        this.state = GameState.GAMEOVER;
        this.audio.playGameOver();
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this._saveHighScore();
        }
        
        this.particleSystem.emit(
            this.player.x,
            this.player.y,
            CONFIG.COLORS.PLAYER,
            50,
            5,
            1000,
            6
        );
    }

    update(deltaTime) {
        if (this.state !== GameState.PLAYING) {
            this.menuTimer += deltaTime;
            this.blinkTimer += deltaTime;
            this.particleSystem.update(deltaTime);
            this.screenShake.update();
            return;
        }

        const events = this.player.update(this.keys, this.maze, deltaTime, this.audio);

        if (events.emitTrail) {
            const trailColor = this.player.isPhaseDashing ? CONFIG.COLORS.SKILL_PHASE : CONFIG.COLORS.PLAYER;
            this.particleSystem.emitTrail(this.player.x, this.player.y, trailColor);
            if (this.player.isBoosting || this.player.isPhaseDashing) {
                this.audio.playBoost();
            }
        }

        if (events.emp) {
            this._triggerEMP();
        }

        if (events.decoy) {
            this.decoys.push(new Decoy(this.player.x, this.player.y));
            this.particleSystem.emit(
                this.player.x, this.player.y,
                CONFIG.COLORS.DECOY, 30, 3, 600, 5
            );
        }

        if (events.flashbang) {
            this._triggerFlashbang();
        }

        if (this.player.energy <= 0) {
            this.gameOver();
            return;
        }

        for (const decoy of this.decoys) {
            decoy.update(deltaTime);
        }
        this.decoys = this.decoys.filter(d => !d.expired);

        for (const enemy of this.enemies) {
            enemy.update(this.player, this.maze, deltaTime, this.decoys);

            if (enemy.state === EnemyState.STUNNED) continue;
            if (this.player.isPhaseDashing) continue;

            if (enemy.checkCollision(this.player)) {
                const dmgResult = this.player.takeDamage();
                if (dmgResult === false) continue;

                if (dmgResult === 'shield') {
                    this.particleSystem.emit(
                        this.player.x, this.player.y,
                        CONFIG.COLORS.POWERUP_SHIELD, 25, 4, 600, 5
                    );
                } else if (dmgResult === true) {
                    this.screenShake.trigger();
                    this.audio.playHurt();
                    this.player.energy = Math.max(0, this.player.energy - 30);
                    this.particleSystem.emit(
                        this.player.x,
                        this.player.y,
                        CONFIG.COLORS.ENEMY,
                        20,
                        4,
                        500,
                        4
                    );

                    if (this.player.energy <= 0) {
                        this.gameOver();
                        return;
                    }
                }
            }
        }

        for (const core of this.cores) {
            core.update(deltaTime);

            if (core.checkCollection(this.player)) {
                this.score += CONFIG.CORE_SCORE_VALUE;
                this.player.addEnergy(CONFIG.CORE_ENERGY_VALUE);
                this.audio.playCollect();
                this.particleSystem.emit(
                    core.x,
                    core.y,
                    CONFIG.COLORS.CORE,
                    30,
                    4,
                    800,
                    5
                );

                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    this._saveHighScore();
                }
            }
        }

        this.cores = this.cores.filter(c => !c.collected);

        for (const powerup of this.powerups) {
            powerup.update(deltaTime);

            if (powerup.checkCollection(this.player)) {
                this._applyPowerup(powerup);
            }
        }
        this.powerups = this.powerups.filter(p => !p.collected);

        const endX = this.maze.offsetX + this.maze.endCell.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const endY = this.maze.offsetY + this.maze.endCell.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const distToExit = Utils.distance(this.player.x, this.player.y, endX, endY);

        if (distToExit < CONFIG.CELL_SIZE / 2) {
            this.nextLevel();
            return;
        }

        this.particleSystem.update(deltaTime);
        this.screenShake.update();
    }

    _triggerEMP() {
        this.screenShake.trigger();
        this.audio.playHurt();

        const empRadius = CONFIG.SKILL_EMP_RADIUS * CONFIG.CELL_SIZE;
        for (const enemy of this.enemies) {
            const dist = Utils.distance(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist <= empRadius) {
                enemy.pushAway(this.player.x, this.player.y, CONFIG.SKILL_EMP_PUSH_DISTANCE, this.maze);
                enemy.stun(CONFIG.SKILL_EMP_STUN_DURATION);
            }
        }

        this.particleSystem.emit(
            this.player.x, this.player.y,
            CONFIG.COLORS.SKILL_EMP, 60, 6, 800, 6
        );
    }

    _triggerFlashbang() {
        const flashRadius = CONFIG.POWERUP_FLASH_RADIUS * CONFIG.CELL_SIZE;
        for (const enemy of this.enemies) {
            const dist = Utils.distance(this.player.x, this.player.y, enemy.x, enemy.y);
            if (dist <= flashRadius) {
                enemy.stun(CONFIG.POWERUP_FLASH_STUN);
            }
        }

        this.particleSystem.emit(
            this.player.x, this.player.y,
            CONFIG.COLORS.POWERUP_FLASH, 80, 8, 1000, 8
        );
    }

    _applyPowerup(powerup) {
        this.score += 50;
        this.audio.playCollect();

        switch (powerup.type) {
            case PowerUpType.SHIELD:
                this.player.addShield();
                this.particleSystem.emit(
                    powerup.x, powerup.y,
                    CONFIG.COLORS.POWERUP_SHIELD, 25, 4, 700, 5
                );
                break;
            case PowerUpType.SPEED:
                this.player.addSpeedBoost();
                this.particleSystem.emit(
                    powerup.x, powerup.y,
                    CONFIG.COLORS.POWERUP_SPEED, 25, 4, 700, 5
                );
                break;
            case PowerUpType.FLASH:
                this.player.addFlashbang();
                this.particleSystem.emit(
                    powerup.x, powerup.y,
                    CONFIG.COLORS.POWERUP_FLASH, 25, 4, 700, 5
                );
                break;
        }
    }

    render() {
        const ctx = this.ctx;

        ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        ctx.save();
        this.screenShake.apply(ctx);

        if (this.state === GameState.PLAYING || 
            this.state === GameState.PAUSED || 
            this.state === GameState.GAMEOVER) {
            
            if (this.maze) {
                this.maze.render(ctx);
            }

            for (const core of this.cores) {
                core.render(ctx);
            }

            for (const powerup of this.powerups) {
                powerup.render(ctx);
            }

            for (const decoy of this.decoys) {
                decoy.render(ctx);
            }

            for (const enemy of this.enemies) {
                enemy.render(ctx);
            }

            this.particleSystem.render(ctx);

            if (this.player && this.state !== GameState.GAMEOVER) {
                this.player.render(ctx);
            }

            if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
                this._renderFog(ctx);
            }

            if (this.state !== GameState.GAMEOVER) {
                this._renderHUD(ctx);
            }
        }

        ctx.restore();

        if (this.state === GameState.MENU) {
            this._renderMenu(ctx);
        } else if (this.state === GameState.PAUSED) {
            this._renderPause(ctx);
        } else if (this.state === GameState.GAMEOVER) {
            this._renderGameOver(ctx);
        }
    }

    _renderFog(ctx) {
        if (!this.player) return;

        ctx.save();
        
        const gradient = ctx.createRadialGradient(
            this.player.x, this.player.y, 0,
            this.player.x, this.player.y, CONFIG.FOG_RADIUS
        );
        gradient.addColorStop(0, 'rgba(10, 10, 26, 0)');
        gradient.addColorStop(0.7, 'rgba(10, 10, 26, 0.5)');
        gradient.addColorStop(1, 'rgba(10, 10, 26, 0.92)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        
        ctx.restore();
    }

    _renderHUD(ctx) {
        ctx.save();

        ctx.fillStyle = CONFIG.COLORS.HUD_BG;
        ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, 45);

        ctx.shadowBlur = 10;

        ctx.shadowColor = CONFIG.COLORS.WALL_GLOW;
        ctx.fillStyle = CONFIG.COLORS.WALL;
        ctx.font = 'bold 18px Consolas';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`第 ${this.level} 层`, 20, 22);

        ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
        ctx.fillStyle = CONFIG.COLORS.CORE;
        ctx.textAlign = 'center';
        ctx.fillText(`分数: ${this.score}`, CONFIG.LOGICAL_WIDTH / 2, 22);

        const energyBarX = CONFIG.LOGICAL_WIDTH - 180;
        const energyBarY = 10;
        const energyBarWidth = 150;
        const energyBarHeight = 24;

        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.COLORS.PLAYER_GLOW;
        ctx.strokeStyle = CONFIG.COLORS.PLAYER;
        ctx.lineWidth = 2;
        ctx.strokeRect(energyBarX, energyBarY, energyBarWidth, energyBarHeight);

        const energyPercent = this.player.energy / CONFIG.MAX_ENERGY;
        const fillWidth = energyBarWidth * energyPercent;

        const energyGradient = ctx.createLinearGradient(
            energyBarX, energyBarY,
            energyBarX + energyBarWidth, energyBarY
        );
        energyGradient.addColorStop(0, CONFIG.COLORS.PLAYER);
        energyGradient.addColorStop(1, CONFIG.COLORS.PLAYER_GLOW);

        ctx.fillStyle = energyGradient;
        ctx.fillRect(energyBarX + 2, energyBarY + 2, fillWidth - 4, energyBarHeight - 4);

        ctx.shadowBlur = 0;
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.font = 'bold 12px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${Math.floor(this.player.energy)}/${CONFIG.MAX_ENERGY}`,
            energyBarX + energyBarWidth / 2,
            energyBarY + energyBarHeight / 2
        );

        this._renderSkillBar(ctx);

        ctx.restore();
    }

    _renderSkillBar(ctx) {
        const barY = CONFIG.LOGICAL_HEIGHT - 55;
        const barHeight = 45;
        ctx.fillStyle = CONFIG.COLORS.HUD_BG;
        ctx.fillRect(0, barY, CONFIG.LOGICAL_WIDTH, barHeight);

        const skills = [
            {
                key: 'Shift',
                label: '相位',
                color: CONFIG.COLORS.SKILL_PHASE,
                cooldown: this.player.phaseDashCooldown,
                maxCooldown: CONFIG.SKILL_PHASE_DASH_COOLDOWN
            },
            {
                key: 'E',
                label: '震荡',
                color: CONFIG.COLORS.SKILL_EMP,
                cooldown: this.player.empCooldown,
                maxCooldown: CONFIG.SKILL_EMP_COOLDOWN
            },
            {
                key: 'Q',
                label: '诱饵',
                color: CONFIG.COLORS.SKILL_DECOY,
                cooldown: this.player.decoyCooldown,
                maxCooldown: CONFIG.SKILL_DECOY_COOLDOWN
            }
        ];

        const skillSize = 36;
        const spacing = 12;
        const totalWidth = skills.length * skillSize + (skills.length - 1) * spacing;
        let startX = 20;
        const centerY = barY + barHeight / 2;

        skills.forEach((skill, i) => {
            const x = startX + i * (skillSize + spacing);
            const ready = skill.cooldown <= 0;
            const cdPercent = ready ? 0 : skill.cooldown / skill.maxCooldown;

            ctx.save();
            ctx.shadowBlur = ready ? 15 : 5;
            ctx.shadowColor = skill.color;

            ctx.fillStyle = ready ? skill.color : '#333344';
            ctx.strokeStyle = skill.color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.roundRect(x, centerY - skillSize / 2, skillSize, skillSize, 6);
            ctx.fill();
            ctx.stroke();

            if (!ready) {
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = '#000000';
                const fillHeight = skillSize * cdPercent;
                ctx.fillRect(x + 2, centerY - skillSize / 2 + 2, skillSize - 4, fillHeight - 4);
                ctx.globalAlpha = 1;
            }

            ctx.shadowBlur = 0;
            ctx.fillStyle = ready ? '#ffffff' : '#888888';
            ctx.font = 'bold 12px Consolas';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(skill.label, x + skillSize / 2, centerY - skillSize / 2 + 4);

            ctx.font = 'bold 10px Consolas';
            ctx.textBaseline = 'bottom';
            if (!ready) {
                ctx.fillText((skill.cooldown / 1000).toFixed(1) + 's', x + skillSize / 2, centerY + skillSize / 2 - 2);
            } else {
                ctx.fillText('[' + skill.key + ']', x + skillSize / 2, centerY + skillSize / 2 - 2);
            }

            ctx.restore();
        });

        startX = 20 + totalWidth + 30;

        const itemSize = 36;
        const items = [
            {
                active: this.player.hasShield,
                label: '盾',
                color: CONFIG.COLORS.POWERUP_SHIELD,
                glow: CONFIG.COLORS.POWERUP_SHIELD_GLOW,
                key: ''
            },
            {
                active: this.player.speedBoostTimer > 0,
                label: '速',
                color: CONFIG.COLORS.POWERUP_SPEED,
                glow: CONFIG.COLORS.POWERUP_SPEED_GLOW,
                key: this.player.speedBoostTimer > 0 ? (this.player.speedBoostTimer / 1000).toFixed(1) + 's' : ''
            },
            {
                active: this.player.flashbangCount > 0,
                label: '闪',
                color: CONFIG.COLORS.POWERUP_FLASH,
                glow: CONFIG.COLORS.POWERUP_FLASH_GLOW,
                key: 'x' + this.player.flashbangCount + ' [R]'
            }
        ];

        items.forEach((item, i) => {
            const x = startX + i * (itemSize + spacing);
            ctx.save();

            ctx.shadowBlur = item.active ? 15 : 3;
            ctx.shadowColor = item.glow;
            ctx.fillStyle = item.active ? item.color : '#222233';
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.roundRect(x, centerY - itemSize / 2, itemSize, itemSize, 6);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = item.active ? '#ffffff' : '#555566';
            ctx.font = 'bold 14px Consolas';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(item.label, x + itemSize / 2, centerY - itemSize / 2 + 6);

            if (item.key) {
                ctx.font = 'bold 10px Consolas';
                ctx.textBaseline = 'bottom';
                ctx.fillText(item.key, x + itemSize / 2, centerY + itemSize / 2 - 2);
            }

            ctx.restore();
        });

        ctx.shadowBlur = 5;
        ctx.shadowColor = CONFIG.COLORS.WALL_GLOW;
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.font = '12px Consolas';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('空格:冲刺(耗能量)', CONFIG.LOGICAL_WIDTH - 20, centerY);
    }

    _renderMenu(ctx) {
        ctx.save();

        const pulse = Math.sin(this.menuTimer / 500) * 0.2 + 0.8;
        
        ctx.shadowBlur = 30 * pulse;
        ctx.shadowColor = CONFIG.COLORS.PLAYER_GLOW;
        ctx.fillStyle = CONFIG.COLORS.PLAYER;
        ctx.font = 'bold 56px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('霓虹迷宫大逃亡', CONFIG.LOGICAL_WIDTH / 2, 180);

        ctx.shadowBlur = 20;
        ctx.shadowColor = CONFIG.COLORS.WALL_GLOW;
        ctx.fillStyle = CONFIG.COLORS.WALL;
        ctx.font = 'bold 24px Consolas';
        ctx.fillText('NEON MAZE ESCAPE', CONFIG.LOGICAL_WIDTH / 2, 230);

        const blink = Math.sin(this.blinkTimer / 300) > 0;
        if (blink) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
            ctx.fillStyle = CONFIG.COLORS.CORE;
            ctx.font = 'bold 20px Consolas';
            ctx.fillText('按 Enter 开始游戏', CONFIG.LOGICAL_WIDTH / 2, 320);
        }

        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.COLORS.ENEMY_GLOW;
        ctx.fillStyle = CONFIG.COLORS.ENEMY;
        ctx.font = '16px Consolas';
        ctx.fillText('━ 操作说明 ━', CONFIG.LOGICAL_WIDTH / 2, 370);

        ctx.shadowBlur = 5;
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.font = '13px Consolas';
        const instructions = [
            'WASD / 方向键 - 移动',
            '空格键 - 加速冲刺（消耗能量）',
            'Shift - 相位冲刺（穿怪突围，冷却8秒）',
            'E - 震荡波 EMP（推开并眩晕怪物，冷却15秒）',
            'Q - 全息诱饵（吸引怪物，冷却20秒）',
            'R - 使用闪光弹（道具）',
            'ESC - 暂停游戏',
            '',
            '收集能量核心恢复能量，拾取道具获得增益！'
        ];

        instructions.forEach((text, i) => {
            ctx.fillText(text, CONFIG.LOGICAL_WIDTH / 2, 400 + i * 20);
        });

        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
        ctx.fillStyle = CONFIG.COLORS.CORE;
        ctx.font = '14px Consolas';
        ctx.fillText(`最高记录: ${this.highScore} 分 | 最高层数: ${this.highestLevel}`, CONFIG.LOGICAL_WIDTH / 2, 565);

        ctx.restore();
    }

    _renderPause(ctx) {
        ctx.save();

        ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
        ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        const pulse = Math.sin(this.menuTimer / 300) * 0.2 + 0.8;
        ctx.shadowBlur = 30 * pulse;
        ctx.shadowColor = CONFIG.COLORS.WALL_GLOW;
        ctx.fillStyle = CONFIG.COLORS.WALL;
        ctx.font = 'bold 48px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('游戏暂停', CONFIG.LOGICAL_WIDTH / 2, 280);

        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
        ctx.fillStyle = CONFIG.COLORS.CORE;
        ctx.font = 'bold 18px Consolas';
        ctx.fillText('按 ESC 继续游戏', CONFIG.LOGICAL_WIDTH / 2, 340);

        ctx.restore();
    }

    _renderGameOver(ctx) {
        ctx.save();

        ctx.fillStyle = 'rgba(10, 10, 26, 0.8)';
        ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        const shake = Math.sin(this.menuTimer / 50) * 2;
        const pulse = Math.sin(this.menuTimer / 400) * 0.1 + 0.9;

        ctx.shadowBlur = 40 * pulse;
        ctx.shadowColor = CONFIG.COLORS.ENEMY_GLOW;
        ctx.fillStyle = CONFIG.COLORS.ENEMY;
        ctx.font = 'bold 64px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CONFIG.LOGICAL_WIDTH / 2 + shake, 180);

        ctx.shadowBlur = 20;
        ctx.shadowColor = CONFIG.COLORS.WALL_GLOW;
        ctx.fillStyle = CONFIG.COLORS.WALL;
        ctx.font = 'bold 24px Consolas';
        ctx.fillText('━ 本局数据 ━', CONFIG.LOGICAL_WIDTH / 2, 260);

        ctx.shadowBlur = 10;
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.font = '20px Consolas';
        ctx.fillText(`到达层数: 第 ${this.level} 层`, CONFIG.LOGICAL_WIDTH / 2, 310);
        ctx.fillText(`本局得分: ${this.score} 分`, CONFIG.LOGICAL_WIDTH / 2, 345);

        const isNewHighScore = this.score >= this.highScore && this.score > 0;
        if (isNewHighScore) {
            const newRecordPulse = Math.sin(this.menuTimer / 200) * 0.3 + 0.7;
            ctx.shadowBlur = 20 * newRecordPulse;
            ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
            ctx.fillStyle = CONFIG.COLORS.CORE;
            ctx.font = 'bold 22px Consolas';
            ctx.fillText('★ 新纪录！★', CONFIG.LOGICAL_WIDTH / 2, 395);
        }

        ctx.shadowBlur = 10;
        ctx.shadowColor = CONFIG.COLORS.PLAYER_GLOW;
        ctx.fillStyle = CONFIG.COLORS.PLAYER;
        ctx.font = '18px Consolas';
        ctx.fillText(`最高记录: ${this.highScore} 分 | 最高层数: ${this.highestLevel}`, CONFIG.LOGICAL_WIDTH / 2, 440);

        const blink = Math.sin(this.blinkTimer / 300) > 0;
        if (blink) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = CONFIG.COLORS.CORE_GLOW;
            ctx.fillStyle = CONFIG.COLORS.CORE;
            ctx.font = 'bold 18px Consolas';
            ctx.fillText('按 Enter 返回主菜单', CONFIG.LOGICAL_WIDTH / 2, 520);
        }

        ctx.restore();
    }

    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.accumulator += Math.min(deltaTime, 100);

        while (this.accumulator >= this.fixedTimeStep) {
            this.update(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
        }

        this.render();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    startLoop() {
        requestAnimationFrame((t) => this.gameLoop(t));
    }
}
