import * as THREE from 'three';

export const BlueWaveShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "uTime":    { value: 0 },
        "uAudio":   { value: 0 }, // Bass intensity
        "uActive":  { value: 0.0 } // 0 = Off, 1 = On (Fades in)
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
        uniform float uTime;
        uniform float uAudio;
        uniform float uActive;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;

            // --- SINE WAVE DISTORTION ---
            // Frequency increases with time
            float frequency = 10.0 + (uAudio * 20.0);
            float amplitude = 0.05 * uActive; // Only distort if active
            
            // Offset X based on Y sine wave
            float xOffset = sin(uv.y * frequency + uTime * 5.0) * amplitude;
            
            // Offset Y based on X sine wave (Interference pattern)
            float yOffset = cos(uv.x * frequency + uTime * 4.0) * amplitude;

            vec2 distortedUV = uv + vec2(xOffset, yOffset);

            // Sample texture
            vec4 color = texture2D(tDiffuse, distortedUV);

            // --- BLUE TINT ---
            // Mix original color with Electric Blue based on 'uActive'
            vec3 blueColor = vec3(0.1, 0.3, 1.0);
            
            // Add blue glow to the distorted areas
            color.rgb = mix(color.rgb, color.rgb + blueColor, uActive * 0.4);

            // Scanlines effect (Optional tech feel)
            float scanline = sin(uv.y * 800.0) * 0.1 * uActive;
            color.rgb -= scanline;

            gl_FragColor = color;
        }
    `
};