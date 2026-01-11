import * as THREE from 'three';

export class ChoirBorder {
    constructor(scene) {
        // --- CONFIGURATION ---
        const particleCount = 16000; 
        
        const progress = new Float32Array(particleCount); 
        const offsets = new Float32Array(particleCount);  
        const randoms = new Float32Array(particleCount);  
        const startPositions = new Float32Array(particleCount * 3);

        // --- 1. SETUP MATH ---
        const dummyObj = new THREE.Object3D();
        dummyObj.position.set(0, 20, -90); 
        dummyObj.rotation.x = -Math.PI / 2.5;
        dummyObj.rotation.z = Math.PI / 4;
        dummyObj.updateMatrixWorld();
        
        const inverseMatrix = dummyObj.matrixWorld.clone().invert();
        const tempVec = new THREE.Vector3();

        for (let i = 0; i < particleCount; i++) {
            progress[i] = Math.random() * 4.0;
            offsets[i] = (Math.random() - 0.5) * 0.2; 
            randoms[i] = Math.random();

            // --- 2. STATE 1: FLAT WALL ---
            const screenX = (Math.random() - 0.5) * 400; 
            const screenY = (Math.random() - 0.5) * 250;
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
                uColor: { value: new THREE.Color(0.4, 0.9, 2.5) },
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
                    // --- TARGET: BORDER ---
                    float size = 60.0;
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

                    // Audio Reaction
                    float noiseScale = 0.1; 
                    float noiseVal = noise(vec2(borderPos.x * noiseScale + uTime, borderPos.y * noiseScale));
                    float eruptionMask = smoothstep(0.3, 0.8, noiseVal);
                    float expansionStrength = uAudio * 0.8 * eruptionMask; 
                    vec3 radialMove = vec3(borderPos.x, borderPos.y, 0.0) * expansionStrength;
                    
                    vec3 dir = normalize(vec3(borderPos.x, borderPos.y, 0.0));
                    vec3 perp = vec3(-dir.y, dir.x, 0.0);
                    float curlStrength = sin((uTime * 3.0) + (aRandom * 10.0)); 
                    vec3 swirlMove = perp * curlStrength * (length(radialMove) * 0.5);

                    borderPos += radialMove + swirlMove;
                    borderPos.z += sin(uTime * 5.0 + aRandom * 20.0) * (length(radialMove) * 0.2);

                    // --- START: GENTLE WAVING WALL ---
                    vec3 startPos = aStartPos;
                    // Slow sine wave (uTime * 0.5)
                    // Amplitude 4.0 creates visible but gentle breathing
                    startPos.z += sin(aStartPos.x * 0.02 + uTime * 0.5) * 4.0; 

                    // --- MIX ---
                    float ease = uFormation * uFormation * (3.0 - 2.0 * uFormation);
                    vec3 finalPos = mix(startPos, borderPos, ease);

                    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                    
                    // --- SIZE ---
                    // Kept uniform (2.0 + small random) to prevent bloom artifacts
                    gl_PointSize = (2.0 + (aRandom * 0.5)) * (40.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    // --- ALPHA ---
                    float borderAlpha = 0.1 + (uAudio * 0.4) + (eruptionMask * uAudio * 0.4);
                    vAlpha = mix(0.15, borderAlpha, ease);
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
        this.mesh.position.set(0, 5, -90); 

        scene.add(this.mesh);

        this.smoothValue = 0;
        this.isIgnited = false;
        this.formationLevel = 0.0;
    }

    ignite() {
        this.isIgnited = true;
    }

    update(audio, time) {
        if (this.isIgnited && this.formationLevel < 1.0) {
            this.formationLevel += 0.01; 
            if(this.formationLevel > 1.0) this.formationLevel = 1.0;
            this.mesh.material.uniforms.uFormation.value = this.formationLevel;
        }

        const target = (audio.highMid * 0.6) + (audio.treble * 0.4);
        const attack = 0.1; 
        const decay = 0.03; 
        if (target > this.smoothValue) this.smoothValue += (target - this.smoothValue) * attack;
        else this.smoothValue += (target - this.smoothValue) * decay;

        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uAudio.value = this.smoothValue;
    }
}