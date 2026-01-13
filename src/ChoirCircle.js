import * as THREE from 'three';

// ENSURE 'export' IS HERE
export class ChoirCircle {
    constructor(scene) {
        // --- CONFIGURATION ---
        const particleCount = 160000; 
        
        // We use 'angle' instead of 'progress' for a circle
        const angles = new Float32Array(particleCount); 
        const offsets = new Float32Array(particleCount);  
        const randoms = new Float32Array(particleCount);  
        const startPositions = new Float32Array(particleCount * 3);

        const dummyObj = new THREE.Object3D();
        // Positioned BELOW the Red Border (-15) -> -25
        dummyObj.position.set(0, -25, -90); 
        dummyObj.rotation.x = -Math.PI / 2.5;
        dummyObj.rotation.z = Math.PI / 4;
        dummyObj.updateMatrixWorld();
        
        const inverseMatrix = dummyObj.matrixWorld.clone().invert();
        const tempVec = new THREE.Vector3();

        for (let i = 0; i < particleCount; i++) {
            // Random angle 0 to 2PI
            angles[i] = Math.random() * Math.PI * 2;
            
            // Radius variance (Thickness of the ring)
            offsets[i] = (Math.random() - 0.5) * 2.0; 
            randoms[i] = Math.random();

            // --- STATE 1: VIOLET WALL ---
            const screenX = (Math.random() - 0.5) * 350; 
            const screenY = (Math.random() - 0.5) * 200;
            const screenZ = 0; 

            tempVec.set(screenX, screenY, screenZ);
            tempVec.applyMatrix4(inverseMatrix);

            startPositions[i * 3] = tempVec.x;
            startPositions[i * 3 + 1] = tempVec.y;
            startPositions[i * 3 + 2] = tempVec.z;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
        
        geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
        geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
        geometry.setAttribute('aStartPos', new THREE.BufferAttribute(startPositions, 3));

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime: { value: 0 },
                uAudioHigh: { value: 0 }, // For Top Half
                uAudioLow: { value: 0 },  // For Bottom Half
                // VIOLET / MYSTIC COLOR
                uColor: { value: new THREE.Color(0.0, 0.1, 0.5) },
                uFormation: { value: 0.0 } 
            },
            vertexShader: `
                uniform float uTime;
                uniform float uAudioHigh; 
                uniform float uAudioLow; 
                uniform float uFormation;
                
                attribute float aAngle;
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
                    // --- TARGET: CIRCLE ---
                    float radius = 50.0 + aOffset; // Base Radius
                    float speed = 0.3; 
                    
                    // Continuous flow around circle
                    float currentAngle = mod(aAngle + (uTime * speed), 6.28318);

                    // Calculate X/Y on circle
                    vec3 circlePos = vec3(0.0);
                    circlePos.x = cos(currentAngle) * radius;
                    circlePos.y = sin(currentAngle) * radius;
                    circlePos.z = 0.0;

                    // --- SPLIT AUDIO LOGIC ---
                    // We use sin(angle) to determine top vs bottom.
                    // sin is + (0 to 1) in Top Half (0 to PI)
                    // sin is - (-1 to 0) in Bottom Half (PI to 2PI)
                    
                    float splitMix = smoothstep(-0.2, 0.2, sin(currentAngle));
                    // If splitMix is 1.0 -> High Audio. If 0.0 -> Low Audio.
                    float activeAudio = mix(uAudioLow, uAudioHigh, splitMix);


                    // --- VORTAL DISPLACEMENT (+Z Only) ---
                    float noiseScale = -0.1;
                    // Scroll noise upwards
                    float nVal = noise(vec2(circlePos.x * noiseScale, circlePos.y * noiseScale + uTime));
                    
                    // Create Eruption Zones
                    float eruptionMask = smoothstep(0.66, 0.8, nVal);
                    
                    // Spiral twist math to make the Z-rise look like a vortex
                    float twist = sin(uTime * 5.0 + aRandom * 10.0 + currentAngle * 4.0);
                    
                    // FORCE: Shoot UP in Z
                    // Base drift + Audio Explosion
                    float zForce = (activeAudio * 15.0 * eruptionMask) + (twist * activeAudio * 2.0);
                    
                    // Apply strictly to Z (plus a tiny bit of xy wobble for realism)
                    // abs() ensures it stays positive Z (Upwards) if twist goes negative
                    circlePos.z += abs(zForce); 
                    
                    circlePos.x += twist * activeAudio * 0.5;
                    circlePos.y += twist * activeAudio * 0.5;


                    //  STATE WALL ---
                    vec3 startPos = aStartPos;
                    // Gentle, mysterious undulation
                    startPos.z += sin(aStartPos.y * 0.05 + uTime) * 3.0;
                    startPos.x += cos(aStartPos.x * 0.05 + uTime * 0.5) * 2.0;

                    // --- MIX ---
                    float ease = uFormation * uFormation * (3.0 - 2.0 * uFormation);
                    vec3 finalPos = mix(startPos, circlePos, ease);

                    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                    
                    // Slightly larger/softer particles for "Hum" feel
                    gl_PointSize = (3.0 + (aRandom * 2.0)) * (40.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    // --- ALPHA ---
                    // State 1: 0.15
                    // State 2: 0.1 + Audio
                    float activeAlpha = 0.1 + (activeAudio * 0.6) + (eruptionMask * activeAudio * 0.4);
                    vAlpha = mix(0.15, activeAlpha, ease);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;

                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    // Soft glowy particle
                    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
                    strength = pow(strength, 2.0); // Soft falloff
                    gl_FragColor = vec4(uColor, strength * vAlpha);
                }
            `
        });

        this.mesh = new THREE.Points(geometry, material);
        // MATCHING TRANSFORM
        this.mesh.rotation.x = -Math.PI / 2.5; 
        this.mesh.rotation.z = Math.PI / 4;
        this.mesh.position.set(0, -5, -90); 
        //this.mesh.layers.enable(3);//layer

        scene.add(this.mesh);

        this.smoothHigh = 0;
        this.smoothLow = 0;
        this.isIgnited = false;
        this.formationLevel = 0.0;
    }

    ignite() { this.isIgnited = true; }

    update(audio, time) {
        if (this.isIgnited && this.formationLevel < 1.0) {
            this.formationLevel += 0.01; 
            if(this.formationLevel > 1.0) this.formationLevel = 1.0;
            this.mesh.material.uniforms.uFormation.value = this.formationLevel;
        }

        // --- AUDIO SPLIT LOGIC ---
        
        // 1. High Hums (Treble + HighMid)
        let targetHigh = (audio.highMid * 0.4) + (audio.treble * 0.6);
        
        // 2. Low Hums (Bass + LowMid)
        let targetLow = (audio.bass * 0.4) + (audio.lowMid * 0.6);

        // Smooth Physics
        const attack = 0.05; // Slow attack (Hums swell slowly)
        const decay = 0.02;  // Slow decay (Hums fade slowly)
        
        // Update High
        if (targetHigh > this.smoothHigh) this.smoothHigh += (targetHigh - this.smoothHigh) * attack;
        else this.smoothHigh += (targetHigh - this.smoothHigh) * decay;

        // Update Low
        if (targetLow > this.smoothLow) this.smoothLow += (targetLow - this.smoothLow) * attack;
        else this.smoothLow += (targetLow - this.smoothLow) * decay;

        // Update Uniforms
        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uAudioHigh.value = this.smoothHigh;
        this.mesh.material.uniforms.uAudioLow.value = this.smoothLow;
    }
}