import * as THREE from 'three';

export class AudioGrid {
    constructor(scene) {
        this.isActive = false;

        const geometry = new THREE.PlaneGeometry(50, 50, 20, 10);

        const material = new THREE.ShaderMaterial({
            wireframe: true,
            transparent: true,
            side: THREE.DoubleSide,
            uniforms: {
                uBass: { value: 0 },
                uMid: { value: 0 },
                uHigh: { value: 0 }, // New uniform for Highs
                uTreble: { value: 0 },
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0.1, 0.1, 0.2) } 
            },
            vertexShader: `
                uniform float uBass;
                uniform float uMid;
                uniform float uHigh;
                uniform float uTreble;
                uniform float uTime;
                varying float vElevation;

                void main() {
                    vec3 pos = position;
                    
                    // --- 4 CORNER MAPPING ---
                    // UV coords go from 0 to 1
                    // 0,0 is Bottom-Left. 1,1 is Top-Right.

                    // 1. Top-Right (Bass) -> uv.x * uv.y
                    float bassZone = smoothstep(0.2, 1.0, uv.x * uv.y);
                    
                    // 2. Top-Left (Mids) -> (1-x) * y
                    float midZone = smoothstep(0.2, 1.0, (1.0 - uv.x) * uv.y);

                    // 3. Bottom-Right (Highs) -> x * (1-y)
                    float highZone = smoothstep(0.2, 1.0, uv.x * (1.0 - uv.y));

                    // 4. Bottom-Left (Treble) -> (1-x) * (1-y)
                    float trebleZone = smoothstep(0.2, 1.0, (1.0 - uv.x) * (1.0 - uv.y));

                    // --- DISPLACEMENT ---
                    // Each zone has a slightly different wave pattern
                    
                    // Bass: Big Slow Rolling Hill
                    pos.z += uBass * bassZone * sin(pos.x * 0.1 + uTime) * 20.0;

                    // Mids: Medium Ripple
                    pos.z += uMid * midZone * sin(pos.y * 0.3 - uTime * 2.0) * 15.0;

                    // Highs: Fast Choppy Wave
                    pos.z += uHigh * highZone * sin(pos.x * 0.5 + uTime * 5.0) * 10.0;

                    // Treble: Spiky Noise
                    pos.z += uTreble * trebleZone * fract(sin(dot(uv, vec2(12.9, 78.2)))*43758.5) * 8.0;

                    vElevation = pos.z; 

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vElevation;

                void main() {
                    gl_FragColor = vec4(uColor, 0.15);
                }
            `
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2.5; 
        this.mesh.rotation.z = Math.PI / 4;  
        this.mesh.position.z = -60; 
        this.mesh.visible = false;
        scene.add(this.mesh);
    }

    toggle() {
        this.isActive = !this.isActive;
        this.mesh.visible = this.isActive;
    }

    update(audio, time) {
        if (!this.isActive) return;

        this.mesh.material.uniforms.uTime.value = time;
        
        // NOISE GATE (0.15)
        const gate = (val) => val > 0.05 ? (val - 0.05) * 10.0 : 0;

        // Split "Treble" into Highs and Super-Highs just for visual variety
        // Since we only get 3 bands from sound.js usually, we reuse treble for "High"
        // or split it if sound.js supported it. 
        // For now: Bass=Bass, Mid=Mid, High=Treble*0.7, Treble=Treble.
        
        this.mesh.material.uniforms.uBass.value = gate(audio.bass);
        this.mesh.material.uniforms.uMid.value = gate(audio.mid);
        this.mesh.material.uniforms.uHigh.value = gate(audio.treble * 0.8);
        this.mesh.material.uniforms.uTreble.value = gate(audio.treble);
    }
}