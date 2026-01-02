import * as THREE from 'three';

export class VoiceTree {
    constructor(seed, borderSystem, scene) {
        this.seedId = seed.id;
        this.seedRef = seed;
        this.borderSystem = borderSystem;
        this.scene = scene;
        
        this.isActive = false; 
        this.masterAlpha = 0.0; 
        
        this.opacity = 0;
        
        this.maxSegments = 15000; 
        this.maxDepth = 7; 
        
        this.treeScale = (1.0 + Math.random() * 0.8); 
        
        this.isFlashing = false;
        this.cooldownTimer = Math.random() * 2.0;

        // --- SENSITIVITY CONFIG ---
        // Threshold is now compared against "Squared Energy"
        // 0.3 is a good balance for ignoring breath but catching speech
        this.triggerThreshold = 0.3;

        this.palette = [
            new THREE.Color(0xFF0000), 
            new THREE.Color(0xCC0000), 
            new THREE.Color(0xFF4444), 
            new THREE.Color(0x880000)  
        ];

        this.skeleton = []; 
        this.initMesh();
        this.regenerate();
    }

    toggle(state) {
        this.isActive = state;
        if (state) {
            console.log("RED LIGHTNING FADING IN...");
            this.mesh.visible = true; 
            this.isFlashing = true;
            this.opacity = 1.0;
            this.regenerate();
        } else {
            console.log("RED LIGHTNING FADING OUT...");
        }
    }

    regenerate() {
        this.skeleton = []; 
        const currentScale = this.treeScale * (0.8 + Math.random() * 0.4);
        const trunkCount = 2 + Math.floor(Math.random() * 2); 
        
        for(let i=0; i<trunkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
            const len = (30 + Math.random() * 15) * currentScale;
            
            const baseColor = this.palette[Math.floor(Math.random() * this.palette.length)].clone();
            baseColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);

            this.growBranch(-1, null, dir, 0, baseColor, len);
        }
        this.updateColorBuffer();
    }

    growBranch(parentId, startPos, direction, depth, color, length) {
        if (this.skeleton.length >= this.maxSegments) return;
        if (depth >= this.maxDepth) return;
        if (depth > 2 && Math.random() < (depth * 0.1)) return;

        const segmentSize = 2.0; 
        const steps = Math.max(2, Math.floor(length / segmentSize));
        const stepLen = length / steps;
        let currentParentId = parentId;
        
        for (let i = 0; i < steps; i++) {
            if (this.skeleton.length >= this.maxSegments) break;
            const kink = (Math.random() - 0.5) * 0.8; 
            const currentDir = direction.clone().rotateAround(new THREE.Vector2(0,0), kink);

            const seg = {
                id: this.skeleton.length,
                parentId: currentParentId,
                depth: depth,
                dir: currentDir,
                len: stepLen,
                color: color 
            };
            this.skeleton.push(seg);
            currentParentId = seg.id;
        }

        let childCount = (depth === 0) ? 2 + Math.floor(Math.random() * 3) : (Math.random() < 0.3 ? 1 : (Math.random() < 0.8 ? 2 : 3));

        for(let i=0; i<childCount; i++) {
            const spread = 1.6 - (depth * 0.2); 
            const angleOffset = (Math.random() - 0.5) * spread;
            const newDir = direction.clone().rotateAround(new THREE.Vector2(0,0), angleOffset);
            const decay = 0.6 + Math.random() * 0.3;
            const newLen = length * decay;
            this.growBranch(currentParentId, null, newDir, depth + 1, color, newLen);
        }
    }

    initMesh() {
        const count = this.maxSegments * 2; 
        this.positions = new Float32Array(count * 3);
        this.colors = new Float32Array(count * 3);   
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);

        this.material = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.LineSegments(geometry, this.material);
        this.mesh.frustumCulled = false;
        this.scene.add(this.mesh);
    }

    updateColorBuffer() {
        for (let i = 0; i < this.skeleton.length; i++) {
            const seg = this.skeleton[i];
            const r = seg.color.r;
            const g = seg.color.g;
            const b = seg.color.b;
            const tipGlow = (seg.depth / this.maxDepth) * 0.8;
            const idx = i * 6; 
            for(let k=0; k<6; k+=3) {
                this.colors[idx+k]   = Math.min(1, r + tipGlow);
                this.colors[idx+k+1] = Math.min(1, g + tipGlow);
                this.colors[idx+k+2] = Math.min(1, b + tipGlow);
            }
        }
        this.mesh.geometry.attributes.color.needsUpdate = true;
    }

    update(audio, time) {
        if (!this.mesh) return;

        // --- 1. MASTER FADE LOGIC ---
        const targetMaster = this.isActive ? 1.0 : 0.0;
        this.masterAlpha += (targetMaster - this.masterAlpha) * 0.05;

        if (this.masterAlpha < 0.01 && !this.isActive) {
            this.mesh.visible = false;
            return;
        }
        this.mesh.visible = true;

        // --- 2. LIGHTNING LOGIC ---
        const anchorPos = this.seedRef.currPos || this.seedRef.basePos; 

        if (this.borderSystem.getOwnerId(anchorPos) !== this.seedId) {
            this.opacity = 0;
            this.isFlashing = false;
        } else {
            const dt = 0.016; 
            if (this.isFlashing) {
                this.opacity -= dt * 2.5; 
                if (this.opacity <= 0) {
                    this.opacity = 0;
                    this.isFlashing = false;
                    this.cooldownTimer = 0.2 + Math.random() * 1.5;
                }
            } else {
                if (this.cooldownTimer > 0) {
                    this.cooldownTimer -= dt;
                } else {
                    // --- NOISE GATE LOGIC START ---
                    
                    // 1. Isolate Mids (Human Voice)
                    let rawVoice = audio.mid;

                    // 2. Hard Cutoff (The Breath Filter)
                    // If volume is below 35%, ignore it completely.
                    // Most breathing is around 0.1 - 0.2
                    if (rawVoice < 0.35) {
                        rawVoice = 0;
                    }

                    // 3. Exponential Boost
                    // This separates loud sounds from quiet sounds drastically.
                    // 0.4 * 0.4 = 0.16 (Weak)
                    // 0.8 * 0.8 = 0.64 (Strong)
                    const energy = (rawVoice * rawVoice) * 3.0; // Multiplier to bring it back up to threshold levels

                    // 4. Trigger
                    if (energy > this.triggerThreshold) {
                        this.isFlashing = true;
                        this.opacity = 1.0; 
                        this.regenerate();
                    }
                    // --- NOISE GATE LOGIC END ---
                }
            }
        }

        // --- 3. APPLY VISIBILITY ---
        this.material.opacity = this.opacity * this.masterAlpha;

        if (this.material.opacity < 0.01) return;

        // --- 4. GEOMETRY UPDATES ---
        const cleanBass = audio.bass > 0.2 ? audio.bass : 0;
        const validTips = new Map(); 
        let posIndex = 0;

        // Jitter only happens on loud sounds now
        const jitterStrength = (audio.mid > 0.3) ? (audio.mid * 2.0) : 0; 

        for (let i = 0; i < this.skeleton.length; i++) {
            const seg = this.skeleton[i];
            let start;
            let isBranchValid = true;

            if (seg.parentId === -1) {
                start = anchorPos.clone();
            } else {
                start = validTips.get(seg.parentId);
                if (!start) isBranchValid = false; 
            }

            let end;
            if (isBranchValid) {
                const currentLen = seg.len * (1.0 + cleanBass * 0.15);
                const currentDir = seg.dir.clone();
                end = start.clone().add(currentDir.multiplyScalar(currentLen));
                
                if (jitterStrength > 0.01) {
                    end.x += (Math.random() - 0.5) * jitterStrength;
                    end.y += (Math.random() - 0.5) * jitterStrength;
                }

                if (this.borderSystem.getOwnerId(end) !== this.seedId) {
                    end = start.clone().add(currentDir.normalize().multiplyScalar(currentLen * 0.1));
                    if (this.borderSystem.getOwnerId(end) !== this.seedId) {
                        isBranchValid = false;
                    }
                }
            }

            if (isBranchValid) {
                validTips.set(seg.id, end); 
                this.positions[posIndex++] = start.x;
                this.positions[posIndex++] = start.y;
                this.positions[posIndex++] = 0;
                this.positions[posIndex++] = end.x;
                this.positions[posIndex++] = end.y;
                this.positions[posIndex++] = 0;
            } else {
                for(let k=0; k<6; k++) this.positions[posIndex++] = 0;
            }
        }
        
        while(posIndex < this.positions.length) {
            this.positions[posIndex++] = 0;
        }

        this.mesh.geometry.attributes.position.needsUpdate = true;
    }
}