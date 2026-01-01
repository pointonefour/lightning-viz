import * as THREE from 'three';

export class Tree {
    constructor(seed, borderSystem, scene) {
        this.seedId = seed.id;
        this.seedRef = seed;
        this.borderSystem = borderSystem;
        this.scene = scene;
        
        this.opacity = 0;
        
        // --- BUFFERS ---
        // We allocate enough space for a massive tree.
        // We will reuse this memory every time the tree changes shape.
        this.maxSegments = 12000; 
        
        this.maxDepth = 6; 
        this.treeScale = (0.7 + Math.random() * 0.8); 
        
        this.isFlashing = false;
        this.cooldownTimer = Math.random() * 2.0;
        this.triggerThreshold = 0.15 + Math.random() * 0.25;

        this.palette = [
            new THREE.Color(0xFF0044), // Red
            new THREE.Color(0x00AAFF), // Blue
            new THREE.Color(0xAA00FF), // Purple
            new THREE.Color(0xFFFFFF)  // White
        ];

        this.skeleton = []; 
        
        // 1. Create the buffers ONCE
        this.initMesh();
        
        // 2. Generate initial shape (so it's not empty)
        this.regenerate();
    }

    /**
     * Completely rebuilds the tree structure.
     * Called every time the lightning strikes.
     */
    regenerate() {
        this.skeleton = []; // Clear old shape
        
        // Randomize scale slightly every strike
        const currentScale = this.treeScale * (0.8 + Math.random() * 0.4);

        // Start 2-4 Trunks
        const trunkCount = 2 + Math.floor(Math.random() * 3); 
        
        for(let i=0; i<trunkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
            const len = (15 + Math.random() * 10) * currentScale;
            
            // Random color for this strike
            const baseColor = this.palette[Math.floor(Math.random() * this.palette.length)].clone();
            baseColor.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);

            this.growBranch(-1, null, dir, 0, baseColor, len);
        }

        // IMPORTANT: Update Color Buffer immediately
        // because the structure changed, the colors might have moved.
        this.updateColorBuffer();
    }

    growBranch(parentId, startPos, direction, depth, color, length) {
        if (this.skeleton.length >= this.maxSegments) return;
        if (depth >= this.maxDepth) return;
        if (depth > 1 && Math.random() < (depth * 0.12)) return;

        // Create Zig-Zag segments
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

        // Recursion (Branching)
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
        // Allocate max memory
        const count = this.maxSegments * 2; 
        this.positions = new Float32Array(count * 3);
        this.colors = new Float32Array(count * 3);   

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        
        // Ensure frusum culling doesn't hide dynamic geometry
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
            
            // Tips glow white
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
        const anchorPos = this.seedRef.basePos; 

        // 1. TERRITORY CHECK
        if (this.borderSystem.getOwnerId(anchorPos) !== this.seedId) {
            this.opacity = 0;
            this.mesh.visible = false;
            this.isFlashing = false;
            return;
        }

        const dt = 0.016; 

        if (this.isFlashing) {
            // Decay Phase
            this.opacity -= dt * 2.5; 
            
            if (this.opacity <= 0) {
                this.opacity = 0;
                this.isFlashing = false;
                this.cooldownTimer = 0.2 + Math.random() * 1.5;
            }
        } else {
            // Wait Phase
            if (this.cooldownTimer > 0) {
                this.cooldownTimer -= dt;
            } else {
                // Check Trigger
                const audioEnergy = (audio.bass * 0.6) + (audio.mid * 0.8) + (audio.treble * 1.5);
                const flux = (Math.random() - 0.5) * 0.15;

                if (audioEnergy > (this.triggerThreshold + flux)) {
                    // --- IGNITION ---
                    this.isFlashing = true;
                    this.opacity = 1.0; 
                    
                    // REGENERATE SHAPE NOW!
                    // This creates a brand new unique tree for this specific flash
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

        // 3. JITTER & POSITION UPDATE
        const validTips = new Map(); 
        let posIndex = 0;
        const jitterStrength = 0.1 + (audio.treble * 4.0) + (Math.random() * 0.3);

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
                // Audio Stretch
                const currentLen = seg.len * (1.0 + audio.bass * 0.15);
                const currentDir = seg.dir.clone();
                end = start.clone().add(currentDir.multiplyScalar(currentLen));
                
                // Jitter
                end.x += (Math.random() - 0.5) * jitterStrength;
                end.y += (Math.random() - 0.5) * jitterStrength;

                // Border Clip
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
                // Collapse unused segment
                for(let k=0; k<6; k++) this.positions[posIndex++] = 0;
            }
        }
        
        // IMPORTANT: Zero out the rest of the buffer 
        // if the new tree is smaller than the previous one
        while(posIndex < this.positions.length) {
            this.positions[posIndex++] = 0;
        }

        this.mesh.geometry.attributes.position.needsUpdate = true;
    }
}