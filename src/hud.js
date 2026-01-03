import * as THREE from 'three';

export class AnalysisHUD {
    constructor() {
        this.isActive = false;
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '20'; 
        this.canvas.style.display = 'none'; 
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        this.targets = []; 
        this.maxTargets = 80; // Massive Density
        
        this.shaderData = new Array(10).fill().map(() => new THREE.Vector3(-1, -1, 0));

        this.resize();
    }

    toggle() {
        this.isActive = !this.isActive;
        this.canvas.style.display = this.isActive ? 'block' : 'none';
        console.log("HUD SYSTEM:", this.isActive ? "ONLINE" : "OFFLINE");
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    toScreenXY(position, camera) {
        const vector = position.clone();
        vector.project(camera); 
        return {
            x: (vector.x + 1) * this.canvas.width / 2,
            y: (-vector.y + 1) * this.canvas.height / 2,
            visible: vector.z < 1 && vector.x >= -1 && vector.x <= 1 && vector.y >= -1 && vector.y <= 1
        };
    }

    update(allTrees, camera, time) {
        for(let i=0; i<10; i++) this.shaderData[i].set(-1, -1, 0);

        if (!this.isActive) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // --- AGGRESSIVE SPAWN ---
        // Try 15 times per frame to find a target
        for (let i = 0; i < 15; i++) {
            if (this.targets.length >= this.maxTargets) break;
            const randomTree = allTrees[Math.floor(Math.random() * allTrees.length)];
            
            // Detect ANYTHING that isn't fully invisible (> 0.01)
            if (randomTree.opacity > 0.01 && randomTree.skeleton.length > 0) {
                // Pick ANY segment, not just roots
                const seg = randomTree.skeleton[Math.floor(Math.random() * randomTree.skeleton.length)];
                
                const seedPos = randomTree.seedRef.currPos || randomTree.seedRef.basePos;
                const exactPos = new THREE.Vector3(seedPos.x + seg.dir.x * 5, seedPos.y + seg.dir.y * 5, 0);
                
                const lifespan = 10 + Math.random() * 15; 

                this.targets.push({
                    pos3D: exactPos, 
                    life: lifespan, 
                    maxLife: lifespan, 
                    id: Math.floor(Math.random() * 999), 
                    val: (Math.random()*100).toFixed(0),
                    size: 20 + Math.random() * 30 
                });
            }
        }

        // --- WHITE STYLE ---
        ctx.lineWidth = 2; 
        ctx.font = 'bold 12px monospace'; 
        ctx.shadowBlur = 8; 
        ctx.shadowColor = "white"; // White Glow

        this.targets = this.targets.filter(t => t.life > 0);
        let shaderIndex = 0;

        this.targets.forEach((t, index) => {
            t.life--;
            
            const age = t.maxLife - t.life;
            const fadeIn = Math.min(1.0, age * 0.3); 
            const fadeOut = Math.min(1.0, t.life * 0.3); 
            const opacity = Math.min(fadeIn, fadeOut);

            if (opacity <= 0.01) return;

            const screenPos = this.toScreenXY(t.pos3D, camera);
            if (!screenPos.visible) return;

            const x = screenPos.x;
            const y = screenPos.y;
            const s = t.size; 
            const halfS = s / 2;
            
            // WHITE COLOR
            const alpha = (0.7 + Math.random() * 0.3) * opacity;
            const col = `rgba(255, 255, 255, ${alpha})`;
            
            ctx.strokeStyle = col;
            ctx.fillStyle = col;

            // Box
            ctx.strokeRect(x - halfS, y - halfS, s, s);
            ctx.fillText(`ID_${t.id}`, x + halfS + 5, y - 5);

            // Lines
            if (index > 0) {
                const prev = this.targets[index - 1];
                const pPos = this.toScreenXY(prev.pos3D, camera);
                if (pPos.visible) {
                    const dist = Math.hypot(x - pPos.x, y - pPos.y);
                    if (dist < 300) {
                        ctx.beginPath();
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`; // Faint white lines
                        ctx.moveTo(x, y);
                        ctx.lineTo(pPos.x, pPos.y);
                        ctx.stroke();
                        ctx.lineWidth = 2; 
                    }
                }
            }

            // Export
            if (opacity > 0.5 && shaderIndex < 10 && t.id % 3 === 0) {
                this.shaderData[shaderIndex].set(x / w, 1.0 - (y / h), (s / 2) / h);
                shaderIndex++;
            }
        });
        
        ctx.shadowBlur = 0;
    }
}