import * as THREE from 'three';

export class VoiceTree {
    constructor(seed, borderSystem, scene) {
        this.seedId = seed.id;
        this.seedRef = seed;
        this.scene = scene;
        this.borderSystem = borderSystem; 
        
        this.isActive = false; 
        this.opacity = 0;
        
        this.maxSegments = 15000; 
        this.maxDepth = 6; 
        
        this.treeScale = (0.8 + Math.random() * 0.6); 
        
        this.isFlashing = false;

        // --- SENSITIVITY FIX ---
        // Old: 0.05 (triggered by everything)
        // New: 0.40 (requires distinct, loud input)
        this.triggerThreshold = 0.40; 

        // Dimmer Palette (Subtle look)
        this.palette = [
            new THREE.Color(0.8, 0.1, 0.1), 
            new THREE.Color(0.5, 0.0, 0.0), 
            new THREE.Color(0.6, 0.2, 0.2)  
        ];

        this.skeleton = []; 
        this.initMesh();
        this.regenerate(); 
    }

    toggle(state) {
        this.isActive = state;
        if (state) {
            console.log("RED LIGHTNING ARMED (Low Sensitivity)");
            this.mesh.visible = true;
        } else {
            this.mesh.visible = false;
            this.opacity = 0;
        }
    }

    regenerate() {
        this.skeleton = []; 
        const currentScale = this.treeScale * (0.8 + Math.random() * 0.4);
        const trunkCount = 2 + Math.floor(Math.random() * 3); 
        
        for(let i=0; i<trunkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
            const len = (20 + Math.random() * 10) * currentScale;
            
            const baseColor = this.palette[Math.floor(Math.random() * this.palette.length)].clone();
            this.growBranch(-1, null, dir, 0, baseColor, len);
        }
        this.updateColorBuffer();
    }

    growBranch(parentId, startPos, direction, depth, color, length) {
        if (this.skeleton.length >= this.maxSegments) return;
        if (depth >= this.maxDepth) return;
        
        const segmentSize = 2.0; 
        const steps = Math.max(2, Math.floor(length / segmentSize));
        const stepLen = length / steps;
        let currentParentId = parentId;
        
        for (let i = 0; i < steps; i++) {
            if (this.skeleton.length >= this.maxSegments) break;
            const kink = (Math.random() - 0.5) * 0.9; 
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

        let childCount = (depth === 0) ? 2 + Math.floor(Math.random() * 2) : (Math.random() < 0.6 ? 1 : 2);

        for(let i=0; i<childCount; i++) {
            const spread = 1.6 - (depth * 0.2); 
            const angleOffset = (Math.random() - 0.5) * spread;
            const newDir = direction.clone().rotateAround(new THREE.Vector2(0,0), angleOffset);
            const newLen = length * (0.6 + Math.random() * 0.3);
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
            const idx = i * 6; 
            for(let k=0; k<6; k+=3) {
                this.colors[idx+k]   = seg.color.r;
                this.colors[idx+k+1] = seg.color.g;
                this.colors[idx+k+2] = seg.color.b;
            }
        }
        this.mesh.geometry.attributes.color.needsUpdate = true;
    }

    update(audio, time) {
        if (!this.isActive) return;

        const anchorPos = this.seedRef.currPos || new THREE.Vector2(0,0);
        const dt = 0.016; 

        if (this.isFlashing) {
            this.opacity -= dt * 2.0; 
            if (this.opacity <= 0) {
                this.opacity = 0;
                this.isFlashing = false;
            }
        } else {
            // --- NOISE GATE & SENSITIVITY ---
            
            // 1. Get raw volume of "Mids" (Voice range)
            const rawVolume = audio.mid;

            // 2. NOISE GATE: 
            // If volume is below 0.2, ignore it completely.
            // This filters out background hum/fans/breathing.
            if (rawVolume > 0.2) {
                
                // 3. COMPARE TO THRESHOLD
                if (rawVolume > this.triggerThreshold) {
                    this.isFlashing = true;
                    this.opacity = 0.6; // Cap brightness
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

        // JITTER LOGIC
        const validTips = new Map(); 
        let posIndex = 0;
        
        // Only jitter if sound is loud
        const jitterStrength = (audio.mid > 0.2) ? (audio.mid * 5.0) : 0;

        for (let i = 0; i < this.skeleton.length; i++) {
            const seg = this.skeleton[i];
            let start = (seg.parentId === -1) ? anchorPos.clone() : validTips.get(seg.parentId);
            
            if (start) {
                const currentLen = seg.len;
                const currentDir = seg.dir.clone();
                let end = start.clone().add(currentDir.multiplyScalar(currentLen));
                
                if (jitterStrength > 0) {
                    end.x += (Math.random() - 0.5) * jitterStrength;
                    end.y += (Math.random() - 0.5) * jitterStrength;
                }

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
        
        while(posIndex < this.positions.length) this.positions[posIndex++] = 0;
        this.mesh.geometry.attributes.position.needsUpdate = true;
    }
}