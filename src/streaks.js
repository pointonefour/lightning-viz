import * as THREE from 'three';

export const StreaksShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "uResolution": { value: new THREE.Vector2(1, 1) },
        "uTreble":  { value: 0 },
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
        uniform vec2 uResolution;
        uniform float uTreble;
        uniform float uActive;
        varying vec2 vUv;

        void main() {
            vec4 original = texture2D(tDiffuse, vUv);
            
            if (uActive < 0.01) {
                gl_FragColor = original;
                return;
            }

            // --- HIGH INTENSITY CONFIG ---
            
            // Length: Was 0.02. Now 0.15 (Much longer streaks)
            // Treble can push it to 0.4 (Almost half screen)
            float streakLength = 0.15 + (uTreble * 0.25); 
            
            // Brightness: Was 1.0. Now 3.0 (3x brighter)
            // Treble boosts it to 13.0
            float brightness = 3.0 + (uTreble * 10.0);
            
            // Tint: Electric Cyan/Blue
            vec3 streakTint = vec3(0.4, 0.8, 1.0);

            vec3 acc = vec3(0.0);
            
            // More samples for smoother long streaks
            float samples = 30.0; 
            
            for (float i = -samples; i <= samples; i++) {
                if (i == 0.0) continue; 

                float percent = i / samples;
                
                // Horizontal offset
                vec2 offset = vec2(percent * streakLength, 0.0);

                // Sample
                vec3 neighbor = texture2D(tDiffuse, vUv + offset).rgb;

                // THRESHOLD FIX:
                // Check brightness. If > 0.01 (very dim), it streaks.
                // This ensures faint lightning still creates lines.
                float lum = dot(neighbor, vec3(0.3, 0.59, 0.11));
                
                if (lum > 0.01) {
                    // Falloff: Power of 2.0 (softer fade) instead of 4.0 (sharp cut)
                    float weight = 1.0 - abs(percent);
                    weight = pow(weight, 2.0); 

                    acc += neighbor * weight * streakTint;
                }
            }

            // Average & Boost
            acc = (acc / samples) * brightness * uActive;

            // Additive blending
            gl_FragColor = vec4(original.rgb + acc, 1.0);
        }
    `
};