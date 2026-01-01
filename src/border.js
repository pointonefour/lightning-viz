import * as THREE from 'three';

export class BorderSystem {
    constructor(count, width, height) {
        this.seeds = [];
        this.width = width;
        this.height = height;
        this.initSeeds(count);
    }

    initSeeds(count) {
        for (let i = 0; i < count; i++) {
            const freqType = Math.floor(Math.random() * 3);

            this.seeds.push({
                id: i,
                basePos: new THREE.Vector2((Math.random()-0.5)*this.width, (Math.random()-0.5)*this.height),
                currPos: new THREE.Vector2(),
                
                baseWeight: 1.0 + Math.random() * 3.0, 
                currentWeight: 1.0,
                freqType: freqType,
                reactivity: 5.0 + Math.random() * 10.0,

                phaseX: Math.random() * Math.PI * 2,
                phaseY: Math.random() * Math.PI * 2,
                speedX: 4.0 + Math.random() * 4.0,
                speedY: 4.0 + Math.random() * 4.0,
                ampX: 15.0 + Math.random() * 25.0,
                ampY: 15.0 + Math.random() * 25.0
            });
        }
    }

    update(time, audio) {
        // FIX: Create a fallback object if 'audio' is missing
        const safeAudio = (audio && typeof audio === 'object') ? audio : { bass: 0, mid: 0, treble: 0 };

        this.seeds.forEach(s => {
            // 1. Position
            const xOff = (Math.sin(time * s.speedX + s.phaseX) * s.ampX) + 
                         (Math.cos(time * s.speedX * 0.5) * s.ampX * 0.5);

            const yOff = (Math.cos(time * s.speedY + s.phaseY) * s.ampY) +
                         (Math.sin(time * s.speedY * 0.5) * s.ampY * 0.5);
            
            s.currPos.copy(s.basePos).add(new THREE.Vector2(xOff, yOff));

            // 2. Size (Use safeAudio instead of audio)
            let energy = 0;
            if (s.freqType === 0) energy = safeAudio.bass;
            else if (s.freqType === 1) energy = safeAudio.mid;
            else energy = safeAudio.treble;

            s.currentWeight = s.baseWeight + (energy * s.reactivity);
        });
    }

    getOwnerId(point) {
        let minDist = Infinity;
        let id = -1;
        this.seeds.forEach(s => {
            const d = point.distanceTo(s.currPos) / s.currentWeight;
            if (d < minDist) {
                minDist = d;
                id = s.id;
            }
        });
        return id;
    }
}