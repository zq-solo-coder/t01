'use strict';

class ScreenShake {
    constructor() {
        this.active = false;
        this.startTime = 0;
        this.duration = 0;
        this.intensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    trigger(duration = CONFIG.SHAKE_DURATION, intensity = CONFIG.SHAKE_INTENSITY) {
        this.active = true;
        this.startTime = Date.now();
        this.duration = duration;
        this.intensity = intensity;
    }

    update() {
        if (!this.active) {
            this.offsetX = 0;
            this.offsetY = 0;
            return;
        }

        const elapsed = Date.now() - this.startTime;
        const progress = elapsed / this.duration;

        if (progress >= 1) {
            this.active = false;
            this.offsetX = 0;
            this.offsetY = 0;
            return;
        }

        const decay = 1 - Utils.easeOutQuad(progress);
        this.offsetX = Utils.randomFloat(-1, 1) * this.intensity * decay;
        this.offsetY = Utils.randomFloat(-1, 1) * this.intensity * decay;
    }

    apply(ctx) {
        ctx.translate(this.offsetX, this.offsetY);
    }
}
