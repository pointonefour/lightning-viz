import * as THREE from 'three';

export class VoiceTree {
    constructor(seed, borderSystem, scene) {
        this.seedId = seed.id;
        this.seedRef = seed;
        this.borderSystem = borderSystem;
        this.scene = scene;
        
        this.isActive = false; // Controlled by "R"
        this.opacity = 0;
        
        // --- BUFFERS ---
        this.maxSegments = 15000; 
        
        // DIFFERENCE: Higher Recursion
        this.maxDepth = 7; 
        
        this.treeScale = (1.0 + Math.random() * 0.8); 
        
        this.isFlashing = false;
        this.cooldownTimer = Math.random() * 2.0;

        // DIFFERENCE: Less Sensitive (Higher Threshold)
        // Tree.js was ~0.25. This is ~0.45.
        // Requires a louder vocal input to trigger.
        this.triggerThreshold = 0.45 + Math.random() * 0.2;

        // DIFFERENCE: Red Palette
        this.palette = [
            new THREE.Color(0xFF0000), // Pure Red
            new THREE.Color(0xCC0000), // Deep Red
            new THREE.Color(0xFF4444), // Bright Red
            new THREE.Color(0x880000)  // Blood Red
        ];

        this.skeleton = []; 
        
        this.initMesh();
        // Generate immediately so it's ready when "R" is pressed
        this.regenerate();
    }

    toggle(state) {
        this.isActive = state;
        if (state) {
            console.log("RED LIGHTNING ACTIVE");
            this.mesh.visible = true;
        } else {
            this.mesh.visible = false;
            this.opacity = 0;
        }
    }

    regenerate() {
        this.skeleton = []; 
        
        const currentScale = this.treeScale * (0.8 + Math.random() * 0.4);
        const trunkCount = 2 + Math.floor(Math.random() * 2); 
        
        for(let i=0; i<trunkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
            
            // DIFFERENCE: Longer Branches
            // Tree.js was (15 + random * 10). Here we use (30 + random * 15).
            const len = (30 + Math.random() * 15) * currentScale;
            
            const baseColor = this.palette[Math.floor(Math.random() * this.palette.length)].clone();
            // Slight variation
            baseColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);

            this.growBranch(-1, null, dir, 0, baseColor, len);
        }

        this.updateColorBuffer();
    }

    growBranch(parentId, startPos, direction, depth, color, length) {
        if (this.skeleton.length >= this.maxSegments) return;
        if (depth >= this.maxDepth) return;
        // Less chance to stop early compared to regular tree
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
        // --- CHECK ACTIVE FLAG ---
        if (!this.isActive) {
            if (this.mesh.visible) this.mesh.visible = false;
            return;
        }

        if (!this.mesh) return;

        // Use Wandering Position (synced with border.js)
        const anchorPos = this.seedRef.currPos || this.seedRef.basePos; 

        // Territory Check (Exact copy of logic)
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
                // --- AUDIO FILTERING (Exact Copy) ---
                const bass = audio.bass > 0.2 ? audio.bass : 0;
                const mid = audio.mid > 0.2 ? audio.mid : 0;
                const treble = audio.treble > 0.2 ? audio.treble : 0;

                // Emphasize Mid/Vocals for Red Lightning
                const audioEnergy = (bass * 0.5) + (mid * 1.5) + (treble * 1.0);
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

        // --- CLEAN JITTER (Exact Copy) ---
        const cleanTreble = audio.treble > 0.1 ? audio.treble : 0.1;
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
                // Use Clean Bass (Gated)
                const cleanBass = audio.bass > 0.2 ? audio.bass : 0;
                const currentLen = seg.len * (1.0 + cleanBass * 0.15);
                const currentDir = seg.dir.clone();
                end = start.clone().add(currentDir.multiplyScalar(currentLen));
                
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