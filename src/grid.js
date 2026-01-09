import * as THREE from 'three';

export class AudioGrid {
    constructor(scene) {
        this.isActive = false;

        const geometry = new THREE.PlaneGeometry(50, 50, 20, 20);

        const material = new THREE.ShaderMaterial({
            wireframe: true,
            transparent: true,
            side: THREE.DoubleSide,
            uniforms: {
                uBass: { value: 0 },
                uMid: { value: 0 },
                uTreble: { value: 0 },
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0.0, 0.1, 0.1) } 
            },
            vertexShader: `
                uniform float uBass;
                uniform float uMid;
                uniform float uTreble;
                uniform float uTime;
                varying float vElevation;

                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }

                void main() {
                    vec3 pos = position;
                    
                    // --- 1. CENTER MASK ---
                    float dist = distance(uv, vec2(0.5));
                    float mask = 1.0 - smoothstep(0.0, 0.55, dist);

                    // --- 2. SMOOTH RANDOM TRANSITION ---
                    // Instead of snapping, we calculate "Now" and "Next" and blend them.
                    
                    float speed = 1.2; // How fast spikes change location
                    float t = uTime * speed;
                    
                    float tick1 = floor(t);       // Current State (e.g., 1.0)
                    float tick2 = tick1 + 1.0;    // Next State    (e.g., 2.0)
                    float progress = fract(t);    // 0.0 -> 1.0 transition
                    
                    // Use smoothstep to ease the transition (Slow start, slow end)
                    float mixVal = smoothstep(0.0, 1.0, progress);

                    // Calculate Random Noise for BOTH states
                    float rnd1 = random(uv + vec2(tick1));
                    float rnd2 = random(uv + vec2(tick2));

                    // --- 3. SELECTION ---
                    // Select spikes for state 1 and state 2 independently
                    // Using smoothstep(0.7, 1.0) creates a tapered spike instead of a block
                    float spike1 = smoothstep(0.1, 1.0, rnd1);
                    float spike2 = smoothstep(0.1, 1.0, rnd2);

                    // BLEND the two spike maps together
                    float currentSpike = mix(spike1, spike2, mixVal);

                    // --- 4. AUDIO ENERGY ---
                    float energy = (uBass * 4.0) + (uMid * 10.0) + (uTreble * 10.0);

                    // --- 5. APPLY ---
                    // Spikes grow up based on audio energy
                    pos.z += currentSpike * (2.0 + energy) * mask;

                    // Small idle wave
                    pos.z += sin(pos.x * 0.01 + uTime) * 0.1;

                    vElevation = pos.z; 

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vElevation;

                void main() {
                    float alpha = 0.2 + smoothstep(0.0, 10.0, vElevation) * 0.8;
                    gl_FragColor = vec4(uColor, alpha);
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
        this.mesh.material.uniforms.uBass.value = (audio.bass || 0) * 5.0;
        this.mesh.material.uniforms.uMid.value = (audio.mid || 0) * 5.0;
        this.mesh.material.uniforms.uTreble.value = (audio.treble || 0) * 5.0;
    }
}