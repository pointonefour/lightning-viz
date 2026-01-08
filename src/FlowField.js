import * as THREE from 'three';

// Make sure this says "export class", not just "class"
export class FlowField {
    constructor(scene) {
        const count = 4000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const randoms = new Float32Array(count);
        const sizes = new Float32Array(count);

        for(let i = 0; i < count; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 200;     
            positions[i3 + 1] = (Math.random() - 0.5) * 10;  
            positions[i3 + 2] = (Math.random() - 0.5) * 100; 

            randoms[i] = Math.random(); 
            sizes[i] = Math.random();   
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending, 
            uniforms: {
                uTime: { value: 0 },
                uFlowSpeed: { value: 0 },   
                uTurbulence: { value: 0 },  
                uColor: { value: new THREE.Color(0.2, 0.4, 1.0) } 
            },
            vertexShader: `
                uniform float uTime;
                uniform float uFlowSpeed;
                uniform float uTurbulence;
                attribute float aRandom;
                attribute float aSize;
                varying float vAlpha;

                void main() {
                    vec3 pos = position;
                    float speed = 5.0 + (uFlowSpeed * 10.0) + (aRandom * 5.0);
                    float xOffset = uTime * speed;
                    pos.x = mod(pos.x + xOffset + 100.0, 200.0) - 100.0;

                    float waveY = sin(pos.x * 0.05 + uTime * 2.0); 
                    float waveZ = cos(pos.x * 0.03 + uTime * 1.5); 
                    
                    pos.y += waveY * uTurbulence * 10.0; 
                    pos.z += waveZ * uTurbulence * 5.0;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = (4.0 * aSize + (uTurbulence * 5.0)) * (10.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    float edgeFade = 1.0 - smoothstep(80.0, 100.0, abs(pos.x));
                    vAlpha = edgeFade * (0.3 + uTurbulence); 
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;

                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    float strength = 1.0 - step(0.5, dist);
                    strength = pow(1.0 - dist * 2.0, 2.0);
                    gl_FragColor = vec4(uColor, strength * vAlpha);
                }
            `
        });

        this.mesh = new THREE.Points(geometry, material);
        this.mesh.position.y = -20; 
        this.mesh.position.z = -60;
        this.mesh.rotation.x = 0.1; 

        scene.add(this.mesh);
        this.smoothAudio = 0;
    }

    update(audio, time) {
        let target = (audio.highMid * 0.6) + (audio.treble * 0.4);
        this.smoothAudio += (target - this.smoothAudio) * 0.05;

        this.mesh.material.uniforms.uTime.value = time;
        this.mesh.material.uniforms.uFlowSpeed.value = this.smoothAudio;
        this.mesh.material.uniforms.uTurbulence.value = this.smoothAudio;
    }
}