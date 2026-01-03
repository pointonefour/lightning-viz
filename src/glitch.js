import * as THREE from 'three';

export const GlitchShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "uAudio":   { value: 0.0 }, 
        "uTime":    { value: 0.0 },
        // ADD THIS:
        "uActive":  { value: 0.0 } 
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uAudio;
        uniform float uTime;
        uniform float uActive; // Use this to toggle
        varying vec2 vUv;

        void main() {
            // Only calculate shake if effect is active AND bass is high
            // Multiply shake by uActive (0 to 1)
            float shake = smoothstep(0.3, 0.9, uAudio) * 0.03 * uActive;

            vec2 offsetRed   = vec2(shake, 0.0);
            vec2 offsetGreen = vec2(-shake, 0.0);
            vec2 offsetBlue  = vec2(0.0, shake);

            float r = texture2D(tDiffuse, vUv + offsetRed).r;
            float g = texture2D(tDiffuse, vUv + offsetGreen).g;
            float b = texture2D(tDiffuse, vUv + offsetBlue).b;

            float scanline = sin(vUv.y * 800.0 + uTime * 20.0) * shake;

            // If uActive is 0, shake is 0, scanline is 0 -> No Effect
            gl_FragColor = vec4(r - scanline, g - scanline, b - scanline, 1.0);
        }
    `
};