'use strict';

class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.soundCooldown = {};
    }

    _init() {
        if (this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
            this.enabled = false;
        }
    }

    _canPlaySound(name, cooldown = 50) {
        const now = Date.now();
        if (this.soundCooldown[name] && now - this.soundCooldown[name] < cooldown) {
            return false;
        }
        this.soundCooldown[name] = now;
        return true;
    }

    _playTone(frequency, duration, type = 'sine', volume = 0.1) {
        if (!this.enabled) return;
        this._init();
        if (!this.audioContext) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playMove() {
        if (!this._canPlaySound('move', 80)) return;
        this._playTone(200, 0.05, 'square', 0.03);
    }

    playCollect() {
        if (!this._canPlaySound('collect', 100)) return;
        this._playTone(523, 0.1, 'sine', 0.1);
        setTimeout(() => this._playTone(659, 0.1, 'sine', 0.1), 50);
        setTimeout(() => this._playTone(784, 0.15, 'sine', 0.1), 100);
    }

    playHurt() {
        if (!this._canPlaySound('hurt', 200)) return;
        this._playTone(150, 0.3, 'sawtooth', 0.15);
        setTimeout(() => this._playTone(100, 0.2, 'sawtooth', 0.1), 50);
    }

    playLevelUp() {
        if (!this._canPlaySound('levelup', 300)) return;
        const notes = [523, 659, 784, 1047];
        notes.forEach((note, i) => {
            setTimeout(() => this._playTone(note, 0.2, 'sine', 0.1), i * 100);
        });
    }

    playGameOver() {
        if (!this._canPlaySound('gameover', 500)) return;
        const notes = [392, 349, 330, 262];
        notes.forEach((note, i) => {
            setTimeout(() => this._playTone(note, 0.3, 'triangle', 0.1), i * 150);
        });
    }

    playBoost() {
        if (!this._canPlaySound('boost', 100)) return;
        this._playTone(440, 0.1, 'sawtooth', 0.05);
    }
}
