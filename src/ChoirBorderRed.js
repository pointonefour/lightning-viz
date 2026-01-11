import * as THREE from 'three';

export class ChoirBorderRed {
    constructor(scene) {
        // --- CONFIGURATION ---
        const particleCount = 12000; 
        
        const progress = new Float32Array(particleCount); 
        const offsets = new Float32Array(particleCount);  
        const randoms = new Float32Array(particleCount);  
        const startPositions = new Float32Array(particleCount * 3);

        const dummyObj = new THREE.Object3D();
        dummyObj.position.set(0, 0, -50); 
        dummyObj.updateMatrixWorld();
        
        const inverseMatrix = dummyObj.matrixWorld.clone().invert();
        const tempVec = new THREE.Vector3();

        for (let i = 0; i < particleCount; i++) {
            progress[i] = Math.random() * 4.0;
            offsets[i] = (Math.random() - 0.5) * 0.1; 
            randoms[i] = Math.random();

            const screenX = (Math.random() - 0.5) * 300; 
            const screenY = (Math.random() - 0.5) * 180;
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
                // Color from your snippet
                uColor: { value: new THREE.Color(0.3, 0.05, 0.05) },
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

                void main() {
                    float width = 150.0;
                    float height = 90.0;
                    float halfW = width / 2.0;
                    float halfH = height / 2.0;
                    
                    float speed = 0.8; 
                    float currentT = mod(aProgress + (uTime * speed), 4.0);
                    float side = floor(currentT);
                    float t = fract(currentT);

                    vec3 borderPos = vec3(0.0);
                    
                    if (side == 0.0) { borderPos.x = halfW + aOffset; borderPos.y = mix(-halfH, halfH, t); } 
                    else if (side == 1.0) { borderPos.x = mix(halfW, -halfW, t); borderPos.y = halfH + aOffset; } 
                    else if (side == 2.0) { borderPos.x = -halfW + aOffset; borderPos.y = mix(halfH, -halfH, t); } 
                    else { borderPos.x = mix(-halfW, halfW, t); borderPos.y = -halfH + aOffset; }
                    borderPos.z = 0.0; 

                    // --- SQUARE WAVE (PWM) LOGIC ---
                    
                    // 1. PHASE (Beat Sync)
                    float phase = -(uTime * 5.0 + (uAudio * 10.0));
                    
                    // 2. CARRIER
                    float freq = 6.0;
                    float sineInput = sin(t * freq * 3.14159 + phase);
                    
                    // 3. SQUARE CONVERSION (Hard Digital Edges)
                    float squareWave = sign(sineInput);
                    
                    // 4. PULSE GATE
                    float gateRhythm = sin(t * 8.0 + uTime * 4.0);
                    float pulseGate = step(0.3, gateRhythm); 
                    float finalWave = squareWave * pulseGate;

                    // 5. RANDOM AMPLITUDE
                    // Variation logic
                    float rndAmp = hash(vec2(side, floor(uTime * 10.0))); 
                    float randomFactor = 0.8 + (rndAmp * 2.0); // Range 0.8 to 2.8

                    // Audio Amplitude (INCREASED)
                    // Was 4.0, now 6.0 for bigger jumps
                    float amp = (0.2 + uAudio * 6.0) * randomFactor;
                    
                    vec3 waveOffset = vec3(0.0);
                    if (side == 0.0) { waveOffset.x = finalWave * amp; }       
                    else if (side == 1.0) { waveOffset.y = finalWave * amp; }  
                    else if (side == 2.0) { waveOffset.x = -finalWave * amp; } 
                    else { waveOffset.y = -finalWave * amp; }                  

                    borderPos += waveOffset;
                    
                    if (side == 0.0 || side == 2.0) borderPos.x += aOffset;
                    else borderPos.y += aOffset;

                    // --- START STATE ---
                    vec3 startPos = aStartPos;
                    startPos.z += sin(aStartPos.x * 0.05 + uTime * 1.5) * 5.0;
                    startPos.y += cos(aStartPos.y * 0.05 + uTime * 1.0) * 3.0;

                    // --- MIX ---
                    float ease = uFormation * uFormation * (3.0 - 2.0 * uFormation);
                    vec3 finalPos = mix(startPos, borderPos, ease);

                    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                    gl_PointSize = 2.5 * (40.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    // --- ALPHA ---
                    float activeAlpha = 0.1 + (uAudio * 0.4) + (pulseGate * uAudio * 0.1);
                    vAlpha = mix(0.08, activeAlpha, ease);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;

                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    float strength = 1.0 - step(0.5, dist);
                    gl_FragColor = vec4(uColor, strength * vAlpha);
                }
            `
        });

        this.mesh = new THREE.Points(geometry, material);
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.position.set(0, 0, -50); 

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

        let rawBass = (audio.bass * 0.6) + (audio.lowMid * 0.4);

        // --- NEW: THRESHOLD GATE ---
        // If the sound is below 30%, ignore it completely.
        // This stops the border from vibrating on quiet sounds.
        if (rawBass < 0.3) {
            rawBass = 0.0;
        } else {
            // Remap the remaining range (0.3 to 1.0) back to (0.0 to 1.0)
            rawBass = (rawBass - 0.3) / 0.7;
        }

        // Apply Exponent for punchiness
        let target = Math.pow(rawBass, 2.5); 

        // Faster Decay to make beats distinct
        const attack = 0.8; 
        const decay = 0.4; // Was 0.2 (Slower), increased to 0.4 to clear the signal faster
        
        if (target > this.smoothValue) this.smoothValue += (target - this.smoothValue) * attack;
        else this.smoothValue += (target - this.smoothValue) * decay;

        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uAudio.value = this.smoothValue;
    }
}