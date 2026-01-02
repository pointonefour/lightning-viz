import * as THREE from 'three';

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform float uBass;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // Smooth HSV to RGB conversion
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        // Normalize coordinates centered at 0
        vec2 st = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

        // --- MOVING BLOBS ---
        // We create 3 points that orbit based on time
        // The uBass adds a "kick" to the movement phase
        float t = uTime * 0.5 + (uBass * 0.5);

        vec2 p1 = vec2(sin(t * 0.7), cos(t * 0.3));
        vec2 p2 = vec2(cos(t * 0.9 + 2.0), sin(t * 1.1 + 1.0));
        vec2 p3 = vec2(sin(t * 0.5 - 1.0), cos(t * 0.8 + 2.0));

        // Calculate distances to these points
        float d1 = length(st - p1);
        float d2 = length(st - p2);
        float d3 = length(st - p3);

        // METABALL EFFECT:
        // Sum the inverse distances to create gooey blending
        float meta = (1.0 / d1) + (1.0 / d2) + (1.0 / d3);
        
        // Smooth out the value
        meta = pow(meta, 0.7) * 0.15;

        // --- COLORING ---
        // Map the meta-value to a hue spectrum (Blue -> Purple -> Pink)
        // Offset hue by bass for color shifting on beat
        float hue = 0.6 + (meta * 0.2) + (uBass * 0.1);
        vec3 col = hsv2rgb(vec3(hue, 0.8, meta));

        // Add deep void darkness
        col *= smoothstep(0.2, 0.8, meta);

        gl_FragColor = vec4(col, 1.0);
    }
`;

export class BlobBackground {
    constructor(scene, width, height) {
        this.scene = scene;
        this.isVisible = false; // Starts hidden

        const geometry = new THREE.PlaneGeometry(width * 2, height * 2);
        
        this.uniforms = {
            uTime: { value: 0 },
            uBass: { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        this.material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: this.uniforms,
            depthWrite: false,
            transparent: true,
            opacity: 0.0
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.z = -50; // Far background
        this.mesh.visible = false;  // Hidden by default
        
        this.scene.add(this.mesh);
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.mesh.visible = this.isVisible;
        console.log("Blob Background:", this.isVisible ? "ON" : "OFF");
    }

    update(audio, time) {
        if (!this.isVisible) return;

        this.uniforms.uTime.value = time;
        // Smooth bass for less jittery color shifts
        this.uniforms.uBass.value += (audio.bass - this.uniforms.uBass.value) * 0.1;
    }

    resize(width, height) {
        this.uniforms.uResolution.value.set(width, height);
    }
}