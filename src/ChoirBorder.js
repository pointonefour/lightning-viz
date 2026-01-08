import * as THREE from 'three';

export class ChoirBorder {
    constructor(scene) {
        // --- CONFIGURATION ---
        const particleCount = 16000; 
        const size = 50; 
        const half = size / 2;
        
        const positions = new Float32Array(particleCount * 3);
        const randoms = new Float32Array(particleCount);
        const directions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const side = Math.floor(Math.random() * 4); 
            const t = Math.random(); 

            let x, y, z;
            let dirX, dirY, dirZ;

            // Tight line thickness (0.2)
            const thick = (Math.random() - 0.5) * 0.2; 

            switch(side) {
                case 0: // TOP
                    x = (t * size) - half;
                    y = half + thick;
                    dirX = 0; dirY = 1; dirZ = 0;
                    break;
                case 1: // RIGHT
                    x = half + thick;
                    y = (t * size) - half;
                    dirX = 1; dirY = 0; dirZ = 0;
                    break;
                case 2: // BOTTOM
                    x = (t * size) - half;
                    y = -half + thick;
                    dirX = 0; dirY = -1; dirZ = 0;
                    break;
                case 3: // LEFT
                    x = -half + thick;
                    y = (t * size) - half;
                    dirX = -1; dirY = 0; dirZ = 0;
                    break;
            }
            
            // Flat depth
            z = (Math.random() - 0.5) * 0.5; 

            positions[i3] = x;
            positions[i3+1] = y;
            positions[i3+2] = z;

            directions[i3] = dirX;
            directions[i3+1] = dirY;
            directions[i3+2] = 0; 

            randoms[i] = Math.random();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 },
                uAudio: { value: 0 }, 
                uColor: { value: new THREE.Color(0.2, 0.6, 1.0) } 
            },
            vertexShader: `
                uniform float uTime;
                uniform float uAudio;
                
                attribute vec3 aDirection;
                attribute float aRandom;
                
                varying float vAlpha;

                // --- 1. NOISE FUNCTIONS (Pseudo-Random) ---
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }

                void main() {
                    vec3 pos = position;

                    // --- 2. CALCULATE UNEVEN MASK ---
                    // We use the position (x,y) to sample the noise.
                    // We add uTime so the noise "scrolls" along the border.
                    float noiseScale = 0.05; 
                    float noiseSpeed = uTime * 2.0;
                    
                    // This returns 0.0 to 1.0 based on position
                    float noiseVal = noise(vec2(pos.x * noiseScale + noiseSpeed, pos.y * noiseScale));
                    
                    // Make it harsher: 
                    // smoothstep(0.3, 0.7, ...) means areas below 0.3 stay flat, areas above 0.7 explode fully.
                    float eruptionMask = smoothstep(0.3, 0.8, noiseVal);

                    // --- 3. VORTICITY LOGIC ---
                    vec3 perp = vec3(-aDirection.y, aDirection.x, 0.0);
                    
                    // Swirl angle
                    float curlAngle = (uTime * 3.0) + (aRandom * 10.0);
                    float curlStrength = sin(curlAngle); 
                    
                    // --- 4. APPLY FORCES ---
                    // Multiply everything by our new 'eruptionMask'
                    
                    // Increased max distance to 40.0 because the mask hides some parts
                    float expansion = uAudio * 40.0 * eruptionMask; 

                    vec3 moveOut = aDirection * expansion;
                    vec3 moveSwirl = perp * curlStrength * (expansion * 0.4); 

                    // Apply displacement
                    pos += moveOut + moveSwirl;
                    
                    // Add chaotic Z-depth (also masked by eruption)
                    pos.z += sin(uTime * 5.0 + aRandom * 20.0) * expansion * 0.2;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    gl_PointSize = (2.0 + (aRandom * 3.0)) * (30.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    // Alpha Logic
                    // Base visibility (0.1) + Audio intensity.
                    // The eruption mask makes the exploding parts brighter.
                    vAlpha = 0.1 + (uAudio * 0.5) + (eruptionMask * uAudio * 0.5);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;

                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
                    strength = pow(strength, 3.0);
                    gl_FragColor = vec4(uColor, strength * vAlpha);
                }
            `
        });

        this.mesh = new THREE.Points(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2.5; 
        this.mesh.rotation.z = Math.PI / 4;
        this.mesh.position.z = -60; 
        this.mesh.position.y = -5; 

        scene.add(this.mesh);

        this.smoothValue = 0;
    }

    update(audio, time) {
        // High Mids + Treble focus
        const target = (audio.highMid * 0.7) + (audio.treble * 0.3);
        
        const attack = 0.1; 
        const decay = 0.03; 
        
        if (target > this.smoothValue) {
            this.smoothValue += (target - this.smoothValue) * attack;
        } else {
            this.smoothValue += (target - this.smoothValue) * decay;
        }

        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uAudio.value = this.smoothValue;
    }
}