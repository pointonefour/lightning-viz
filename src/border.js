import * as THREE from 'three';

// ... (Keep the noise functions - copy them from previous border.js or use the one below) ...
// For brevity, I will assume the Noise functions (p, perm, noise3D) are here. 
// If you lost them, use the Border.js from the "4D Space" answer I gave previously.
// I will include the Class logic below with the speed fix.

// --- INSERT NOISE FUNCTIONS HERE IF NEEDED ---
// (Copy the p, perm, noise3D functions from the previous "4D Space" border.js code)
const p = new Uint8Array(256);
for (let i = 0; i < 256; i++) p[i] = i;
let seed = 12345; 
function random() { return (Math.sin(seed++) * 10000) % 1; }
for (let i = 0; i < 256; i++) {
    let r = Math.floor(random() * 256);
    let t = p[i]; p[i] = p[r]; p[r] = t;
}
const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);
for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
}
const G3 = 1.0 / 6.0;
const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
function noise3D(xin, yin, zin) {
    let n0, n1, n2, n3; 
    const s = (xin + yin + zin) * (1.0/3.0); 
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const X0 = i - t; const Y0 = j - t; const Z0 = k - t;
    const x0 = xin - X0; const y0 = yin - Y0; const z0 = zin - Z0;
    let i1, j1, k1, i2, j2, k2;
    if(x0>=y0) { if(y0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; } else if(x0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; } else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; } } else { if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; } else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; } else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; } }
    const x1 = x0 - i1 + G3; const y1 = y0 - j1 + G3; const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0*G3; const y2 = y0 - j2 + 2.0*G3; const z2 = z0 - k2 + 2.0*G3;
    const x3 = x0 - 1.0 + 3.0*G3; const y3 = y0 - 1.0 + 3.0*G3; const z3 = z0 - 1.0 + 3.0*G3;
    const ii = i & 255; const jj = j & 255; const kk = k & 255;
    function dot(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if(t0<0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * dot(grad3[permMod12[ii+perm[jj+perm[kk]]]], x0, y0, z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if(t1<0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * dot(grad3[permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]]], x1, y1, z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if(t2<0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * dot(grad3[permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]]], x2, y2, z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if(t3<0) n3 = 0.0; else { t3 *= t3; n3 = t3 * t3 * dot(grad3[permMod12[ii+1+perm[jj+1+perm[kk+1]]]], x3, y3, z3); }
    return 32.0 * (n0 + n1 + n2 + n3);
}

export class BorderSystem {
    constructor(count, width, height) {
        this.seeds = [];
        this.width = width;
        this.height = height;
        this.initSeeds(count);
    }

    initSeeds(count) {
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * this.width;
            const y = (Math.random() - 0.5) * this.height;

            this.seeds.push({
                id: i,
                basePos: new THREE.Vector2(x, y),
                currPos: new THREE.Vector2(x, y),
                baseWeight: 1.0 + Math.random() * 3.0, 
                currentWeight: 1.0,
                freqType: Math.floor(Math.random() * 3),
                reactivity: 5.0 + Math.random() * 10.0,
            });
        }
    }

    update(time, audio) {
        const safeAudio = (audio && typeof audio === 'object') ? audio : { bass: 0, mid: 0, treble: 0 };
        
        // --- FIX: REDUCED SPEED ---
        // Was time * 0.5. Now time * 0.05 (10x slower drift)
        const z = time * 0.05; 
        
        // --- FIX: REDUCED AUDIO WARPING ---
        // Was * 2.0. Now * 0.2 (Less twitchy)
        const w = (safeAudio.bass * 0.2) + (safeAudio.treble * 0.1); 

        this.seeds.forEach(s => {
            const scale = 0.05; 
            const nX = noise3D(s.basePos.x * scale, s.basePos.y * scale, z + w);
            const nY = noise3D(s.basePos.x * scale, s.basePos.y * scale, z + w + 100.0);

            // Amplitude: How far they drift
            const amplitude = 20.0; 

            s.currPos.x = s.basePos.x + (nX * amplitude);
            s.currPos.y = s.basePos.y + (nY * amplitude);

            // Size Pulsing
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