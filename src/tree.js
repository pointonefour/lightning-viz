import * as THREE from 'three';

export class Tree {
    constructor(seed, borderSystem, scene) {
        this.seedId = seed.id;
        this.seedRef = seed;
        this.borderSystem = borderSystem;
        this.scene = scene;
        
        this.opacity = 0;
        
        // --- BUFFERS ---
        this.maxSegments = 12000; 
        
        this.maxDepth = 6; 
        this.treeScale = (0.7 + Math.random() * 0.8); 
        
        this.isFlashing = false;
        this.cooldownTimer = Math.random() * 2.0;

        // --- FIX 1: HIGHER THRESHOLD ---
        // Old: 0.15. New: 0.55
        // This ensures the tree ignores quiet sounds and only reacts to peaks.
        this.triggerThreshold = 0.55 + Math.random() * 0.3;

        this.palette = [
            new THREE.Color(0x703BE7), // Red
            new THREE.Color(0x307D7E), // Blue
            new THREE.Color(0xAA00FF), // Purple
            new THREE.Color(0x7F00FF)  // White
        ];

        this.skeleton = []; 
        
        this.initMesh();
        this.regenerate();
    }

    regenerate() {
        this.skeleton = []; 
        
        const currentScale = this.treeScale * (0.8 + Math.random() * 0.4);
        const trunkCount = 2 + Math.floor(Math.random() * 3); 
        
        for(let i=0; i<trunkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
            const len = (15 + Math.random() * 10) * currentScale;
            
            const baseColor = this.palette[Math.floor(Math.random() * this.palette.length)].clone();
            baseColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);

            this.growBranch(-1, null, dir, 0, baseColor, len);
        }

        this.updateColorBuffer();
    }

    growBranch(parentId, startPos, direction, depth, color, length) {
        if (this.skeleton.length >= this.maxSegments) return;
        if (depth >= this.maxDepth) return;
        if (depth > 1 && Math.random() < (depth * 0.12)) return;

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

        let childCount;
        const r = Math.random();
        if (depth === 0) childCount = 2 + Math.floor(Math.random() * 3);
        else if (r < 0.3) childCount = 1;
        else if (r < 0.8) childCount = 2;
        else childCount = 3;

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

        // IMPORTANT: Use currPos if using the wandering border system, 
        // fallback to basePos if using the static one.
        const anchorPos = this.seedRef.currPos || this.seedRef.basePos; 

        if (this.borderSystem.getOwnerId(anchorPos) !== this.seedId) {
            this.opacity = 0;
            this.mesh.visible = false;
            this.isFlashing = false;
            return;
        }

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
                // --- FIX 2: AUDIO FILTERING ---
                // "Noise Gate": If audio is below 0.2, consider it 0.
                // This removes response to background hiss.
                const bass = audio.bass > 0.2 ? audio.bass : 0;
                const mid = audio.mid > 0.2 ? audio.mid : 0;
                const treble = audio.treble > 0.2 ? audio.treble : 0;

                const audioEnergy = (bass * 0.6) + (mid * 0.8) + (treble * 1.5);
                const flux = (Math.random() - 0.5) * 0.1;

                if (audioEnergy > (this.triggerThreshold + flux)) {
                    this.isFlashing = true;
                    this.opacity = 1.0; 
                    this.regenerate();
                }
            }
        }

        if (this.opacity < 0.01) {
            this.mesh.visible = false;
            return;
        }

        this.mesh.visible = true;
        this.material.opacity = this.opacity;

        // --- FIX 3: REDUCED JITTER (SLOWER MOVEMENT) ---
        // 1. We check if treble is > 0.1. If it is, we use it. If not, jitter is 0.
        // 2. We REMOVED the + Math.random() part. 
        // This stops the frantic vibration. It only shakes when the music hits high notes.
        const cleanTreble = audio.treble > 0.1 ? audio.treble : 0;
        const jitterStrength = cleanTreble * 2.0; 

        const validTips = new Map(); 
        let posIndex = 0;

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
                // Use Clean Bass (Gated) for stretching
                const cleanBass = audio.bass > 0.2 ? audio.bass : 0;
                const currentLen = seg.len * (1.0 + cleanBass * 0.15);
                const currentDir = seg.dir.clone();
                end = start.clone().add(currentDir.multiplyScalar(currentLen));
                
                // Only apply jitter if there is loud treble
                if (jitterStrength > 0.05) {
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