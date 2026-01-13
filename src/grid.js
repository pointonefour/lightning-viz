import * as THREE from 'three';

export class AudioGrid {
    constructor(scene) {
        this.isActive = false; // Logic state
        this.isClosing = false; // Animation state
        this.startupTimer = 0.0; 

        const geometry = new THREE.PlaneGeometry(30, 30, 20, 20);

        const material = new THREE.ShaderMaterial({
            wireframe: true,
            transparent: true,
            side: THREE.DoubleSide,
            uniforms: {
                uBass: { value: 0 },
                uMid: { value: 0 },
                uTreble: { value: 0 },
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0.3, 1.5, 1.4) },
                uStartupTime: { value: 0.0 } 
            },
            vertexShader: `
                uniform float uBass;
                uniform float uMid;
                uniform float uTreble;
                uniform float uTime;
                varying float vElevation;
                varying vec3 vPos;

                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }

                void main() {
                    vec3 pos = position;
                    vPos = pos; 

                    float dist = distance(uv, vec2(0.5));
                    float mask = 1.0 - smoothstep(0.0, 0.55, dist);

                    float speed = 1.2; 
                    float t = uTime * speed;
                    float tick1 = floor(t);       
                    float tick2 = tick1 + 1.0;    
                    float progress = fract(t);    
                    float mixVal = smoothstep(0.0, 1.0, progress);

                    float rnd1 = random(uv + vec2(tick1));
                    float rnd2 = random(uv + vec2(tick2));

                    float spike1 = smoothstep(0.1, 1.0, rnd1);
                    float spike2 = smoothstep(0.1, 1.0, rnd2);

                    float currentSpike = mix(spike1, spike2, mixVal);
                    float energy = (uBass * 2.0) + (uMid * 20.0) + (uTreble * 10.0);

                    pos.z += currentSpike * (2.0 + energy) * mask;
                    pos.z += sin(pos.x * 0.01 + uTime) * 0.1;

                    vElevation = pos.z; 

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uStartupTime;
                uniform float uTime;
                varying float vElevation;
                varying vec3 vPos;

                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }

                void main() {
                    float alpha = 0.2 + smoothstep(0.0, 10.0, vElevation) * 0.8;

                    // --- FLICKER LOGIC ---
                    float flickerSeed = floor(vPos.x * 0.5) + floor(vPos.y * 0.5) + (uTime * 10.0);
                    float flicker = random(vec2(flickerSeed, uTime)); // Use uTime for constant flicker

                    // Map timer 0->3 to probability 0->1
                    float probability = smoothstep(0.0, 2.5, uStartupTime);

                    if (flicker > probability) {
                        discard;
                    }

                    gl_FragColor = vec4(uColor, alpha);
                }
            `
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2.5; 
        this.mesh.rotation.z = Math.PI / 4;  
        this.mesh.position.z = -60; 
        this.mesh.position.y = 0;
        
        this.mesh.visible = false;
        scene.add(this.mesh);
        //this.mesh.layers.enable(4);//layer
    }

    toggle() {
        if (!this.isActive && !this.isClosing) {
            // START UP
            this.isActive = true;
            this.mesh.visible = true;
            this.startupTimer = 0.0;
        } else if (this.isActive) {
            // START SHUT DOWN
            this.isActive = false;
            this.isClosing = true;
            // Don't hide mesh yet! Wait for update loop to drain timer.
        }
        console.log("GRID STATE:", this.isActive ? "OPENING" : "CLOSING");
    }

    update(audio, time) {
        // Only stop updating if fully closed
        if (!this.isActive && !this.isClosing && this.mesh.visible) {
            this.mesh.visible = false;
            return;
        }
        if (!this.mesh.visible && !this.isActive) return;

        // --- TIMER LOGIC ---
        const dt = 0.05; // Speed of transition

        if (this.isActive) {
            // Opening: Count UP to 3.0
            if (this.startupTimer < 3.0) {
                this.startupTimer += dt;
            }
        } else if (this.isClosing) {
            // Closing: Count DOWN to 0.0
            if (this.startupTimer > 0.0) {
                this.startupTimer -= dt;
            } else {
                // Done closing
                this.isClosing = false;
                this.mesh.visible = false;
                this.startupTimer = 0.0;
            }
        }

        this.mesh.material.uniforms.uStartupTime.value = this.startupTimer;
        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uBass.value = (audio.bass || 0) * 5.0;
        this.mesh.material.uniforms.uMid.value = (audio.mid || 0) * 5.0;
        this.mesh.material.uniforms.uTreble.value = (audio.treble || 0) * 5.0;
    }
}