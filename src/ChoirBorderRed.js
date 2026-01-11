import * as THREE from 'three';

export class ChoirBorderRed {
    constructor(scene) {
        // --- CONFIGURATION ---
        const particleCount = 16000; 
        
        const progress = new Float32Array(particleCount); 
        const offsets = new Float32Array(particleCount);  
        const randoms = new Float32Array(particleCount);  
        const startPositions = new Float32Array(particleCount * 3);

        const dummyObj = new THREE.Object3D();
        
        // --- POSITION SHIFT ---
        // Blue is at -5. We put Red at -15 (Lower down).
        dummyObj.position.set(0, -10, -90); 
        
        dummyObj.rotation.x = -Math.PI / 2.5;
        dummyObj.rotation.z = Math.PI / 4;
        dummyObj.updateMatrixWorld();
        
        const inverseMatrix = dummyObj.matrixWorld.clone().invert();
        const tempVec = new THREE.Vector3();

        for (let i = 0; i < particleCount; i++) {
            progress[i] = Math.random() * 4.0;
            offsets[i] = (Math.random() - 0.5) * 0.2; 
            randoms[i] = Math.random();

            // --- STATE 1: RED WALL ---
            const screenX = (Math.random() - 0.5) * 450; 
            const screenY = (Math.random() - 0.5) * 300;
            const screenZ = 0; 

            tempVec.set(screenX, screenY, screenZ);
            tempVec.applyMatrix4(inverseMatrix);

            startPositions[i * 3] = tempVec.x;
            startPositions[i * 3 + 1] = tempVec.y;
            startPositions[i * 3 + 2] = tempVec.z;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
        
        geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));
        geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
        geometry.setAttribute('aStartPos', new THREE.BufferAttribute(startPositions, 3));

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 },
                uAudio: { value: 0 }, 
                uColor: { value: new THREE.Color(1.1, 1.4, 0.9) },
                uFormation: { value: 0.0 } 
            },
            vertexShader: `
                uniform float uTime;
                uniform float uAudio;
                uniform float uFormation;
                
                attribute float aProgress;
                attribute float aOffset;
                attribute float aRandom;
                attribute vec3 aStartPos;
                
                varying float vAlpha;

                float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                float noise(vec2 p) {
                    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
                }

                void main() {
                    // --- TARGET: TWIN CONFIGURATION ---
                    float size = 80.0;
                    float halfSize = size / 2.0;
                    float speed = 0.2; 
                    float currentT = mod(aProgress + (uTime * speed), 4.0);
                    float side = floor(currentT);
                    float t = fract(currentT);

                    vec3 borderPos = vec3(0.0);
                    if (side == 0.0) { borderPos.x = halfSize + aOffset; borderPos.y = mix(-halfSize, halfSize, t); } 
                    else if (side == 1.0) { borderPos.x = mix(halfSize, -halfSize, t); borderPos.y = halfSize + aOffset; } 
                    else if (side == 2.0) { borderPos.x = -halfSize + aOffset; borderPos.y = mix(halfSize, -halfSize, t); } 
                    else { borderPos.x = mix(-halfSize, halfSize, t); borderPos.y = -halfSize + aOffset; }
                    borderPos.z = (aRandom - 0.5) * 0.5;

                    // --- VORTEX DISPLACEMENT (Twin Logic) ---
                    float noiseScale = 0.1; 
                    // Offset time slightly so it ripples differently than Blue
                    float noiseVal = noise(vec2(borderPos.x * noiseScale + uTime + 10.0, borderPos.y * noiseScale));
                    float eruptionMask = smoothstep(0.3, 0.8, noiseVal);
                    
                    float expansionStrength = uAudio * 0.8 * eruptionMask; 
                    vec3 radialMove = vec3(borderPos.x, borderPos.y, 0.0) * expansionStrength;
                    
                    vec3 dir = normalize(vec3(borderPos.x, borderPos.y, 0.0));
                    vec3 perp = vec3(-dir.y, dir.x, 0.0);
                    float curlStrength = sin((uTime * 3.0) + (aRandom * 10.0)); 
                    vec3 swirlMove = perp * curlStrength * (length(radialMove) * 0.5);

                    borderPos += radialMove + swirlMove;
                    borderPos.z += sin(uTime * 5.0 + aRandom * 20.0) * (length(radialMove) * 0.2);

                    // --- START STATE: RED WALL WAVINESS ---
                    vec3 startPos = aStartPos;
                    startPos.z += sin(aStartPos.x * 0.05 + uTime * 2.0) * 4.0;
                    startPos.y += cos(aStartPos.y * 0.05 + uTime * 1.5) * 2.0;

                    // --- MIX ---
                    float ease = uFormation * uFormation * (3.0 - 2.0 * uFormation);
                    vec3 finalPos = mix(startPos, borderPos, ease);

                    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                    
                    gl_PointSize = (2.0 + (aRandom * 0.5)) * (40.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    float activeAlpha = 0.1 + (uAudio * 0.5) + (eruptionMask * uAudio * 0.5);
                    vAlpha = mix(0.15, activeAlpha, ease);
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
        
        // --- POSITION SET (Lower than Blue) ---
        this.mesh.rotation.x = -Math.PI / 2.5; 
        this.mesh.rotation.z = Math.PI / 4;
        this.mesh.position.set(0, 0, -90); 

        scene.add(this.mesh);

        this.smoothValue = 0;
        this.isIgnited = false;
        this.formationLevel = 0.0;
    }

    ignite() { this.isIgnited = true; }

    update(audio, time) {
        if (this.isIgnited && this.formationLevel < 1.0) {
            this.formationLevel += 0.015; 
            if(this.formationLevel > 1.0) this.formationLevel = 1.0;
            this.mesh.material.uniforms.uFormation.value = this.formationLevel;
        }

        // --- AUDIO LOGIC: NOTES (MIDS) ---
        // We combine Low Mids (Body of synth/guitar) and High Mids (Presence).
        // We ignore Bass (Kick drum) and Treble (Air/Hiss).
        const target = (audio.lowMid * 0.5) + (audio.highMid * 0.5);
        
        const attack = 0.1; 
        const decay = 0.03; 
        
        if (target > this.smoothValue) this.smoothValue += (target - this.smoothValue) * attack;
        else this.smoothValue += (target - this.smoothValue) * decay;

        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uAudio.value = this.smoothValue;
    }
}