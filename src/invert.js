import * as THREE from 'three';

export const InvertShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "uResolution": { value: new THREE.Vector2(1, 1) },
        "uBoxes": { value: new Array(10).fill(new THREE.Vector3(-1, -1, 0)) }, 
        "uActive": { value: 0.0 }
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
        uniform vec3 uBoxes[10]; 
        uniform float uActive;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            if (uActive > 0.5) {
                // Aspect ratio correction factor (Width / Height)
                float aspect = uResolution.x / uResolution.y;

                for (int i = 0; i < 10; i++) {
                    vec3 box = uBoxes[i];
                    if (box.z <= 0.0) continue; 

                    // box.xy = center UV
                    // box.z  = half-height in UV space
                    
                    // Calculate distance from center
                    float distY = abs(vUv.y - box.y);
                    float distX = abs(vUv.x - box.x);

                    // Correct X width based on aspect ratio so it creates a square
                    // box.z is relative to height (1.0 = full screen height)
                    // We divide box.z by aspect to get the equivalent width in UV space
                    float limitX = box.z / aspect; 
                    float limitY = box.z;

                    // SQUARE CHECK
                    if (distX < limitX && distY < limitY) {
                        // Invert color inside the square
                        color.rgb = 1.0 - color.rgb;
                    }
                }
            }

            gl_FragColor = color;
        }
    `
};