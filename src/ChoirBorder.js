import * as THREE from 'three';

export class ChoirBorder {
    constructor(scene) {
        // --- CONFIGURATION ---
        const particleCount = 16000; 
        const size = 60; 
        const half = size / 2;
        
        const positions = new Float32Array(particleCount * 3);
        const randoms = new Float32Array(particleCount);
        
        // Note: We don't even need 'directions' array anymore 
        // because we use the position itself to determine direction.

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const side = Math.floor(Math.random() * 4); 
            const t = Math.random(); 

            let x, y, z;

            // Tight line thickness (0.2)
            const thick = (Math.random() - 0.5) * 0.2; 

            switch(side) {
                case 0: // TOP
                    x = (t * size) - half;
                    y = half + thick;
                    break;
                case 1: // RIGHT
                    x = half + thick;
                    y = (t * size) - half;
                    break;
                case 2: // BOTTOM
                    x = (t * size) - half;
                    y = -half + thick;
                    break;
                case 3: // LEFT
                    x = -half + thick;
                    y = (t * size) - half;
                    break;
            }
            
            // Flat depth
            z = (Math.random() - 0.5) * 0.5; 

            positions[i3] = x;
            positions[i3+1] = y;
            positions[i3+2] = z;

            randoms[i] = Math.random();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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
                
                attribute float aRandom;
                
                varying float vAlpha;

                // Noise Functions
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

                    // --- 1. NOISY ERUPTION MASK ---
                    float noiseScale = 0.05; 
                    float noiseSpeed = uTime * 3.0;
                    float noiseVal = noise(vec2(pos.x * noiseScale + noiseSpeed, pos.y * noiseScale));
                    float eruptionMask = smoothstep(0.3, 0.8, noiseVal);

                    // --- 2. EXPANSION (SCALING METHOD) ---
                    // Instead of adding a vector, we calculate a Scale Factor.
                    // This ensures corners move diagonally and stay connected.
                    
                    // Base expansion + Noisy Eruption
                    float expansionStrength = uAudio * 0.8 * eruptionMask; 
                    
                    // Calculate the "Move Out" vector based on position from center (0,0)
                    // We treat the Z axis separately so it doesn't get huge.
                    vec3 radialMove = vec3(pos.x, pos.y, 0.0) * expansionStrength;


                    // --- 3. VORTICITY (CURL) ---
                    // We still want the swirl. We calculate it based on the radial vector.
                    
                    // Normalize radial vector to get direction
                    vec3 dir = normalize(vec3(pos.x, pos.y, 0.0));
                    
                    // Calculate perpendicular (Tangent) vector for swirl
                    vec3 perp = vec3(-dir.y, dir.x, 0.0);
                    
                    float curlAngle = (uTime * 3.0) + (aRandom * 50.0);
                    float curlStrength = sin(curlAngle); 
                    
                    // The curl amount depends on how far out we expanded
                    vec3 swirlMove = perp * curlStrength * (length(radialMove) * 0.5);


                    // --- 4. APPLY ---
                    pos += radialMove + swirlMove;
                    
                    // Chaotic Z-depth
                    pos.z += sin(uTime * 5.0 + aRandom * 20.0) * (length(radialMove) * 0.2);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    gl_PointSize = (2.0 + (aRandom * 3.0)) * (30.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

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
        const target = (audio.highMid * 0.6) + (audio.treble * 0.4);
        
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