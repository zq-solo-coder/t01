'use strict';

class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.walls = [true, true, true, true];
        this.visited = false;
        this.isOnMainPath = false;
        this.isHideNiche = false;
    }
}
