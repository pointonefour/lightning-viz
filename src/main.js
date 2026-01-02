import * as THREE from 'three';
import { BorderSystem } from './border.js';
import { Tree } from './tree.js';
import { SoundAnalyser } from './sound.js';
import { FrostedGlassShader } from './glass.js'; // Import Glass

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'; // Need this

let scene, camera, renderer, composer, borderSystem, sound;
let trees = [];
let glassPass; // Reference to update glass uniforms
const frustumSize = 100;

const btn = document.createElement('button');
btn.innerHTML = "IGNITE";
btn.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:99; padding:15px 30px; cursor:pointer; background:white; border:2px solid white; font-weight:bold; letter-spacing:4px; font-family: monospace; font-size: 1.2rem;";
document.body.appendChild(btn);

btn.onclick = async () => {
    await sound.init();
    btn.style.opacity = '0';
    setTimeout(() => btn.remove(), 1000);
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 

    sound = new SoundAnalyser(); 

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(frustumSize*aspect/-2, frustumSize*aspect/2, frustumSize/2, frustumSize/-2, 0.1, 1000);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild(renderer.domElement);

    // --- COMPOSER STACK ---
    const renderScene = new RenderPass(scene, camera);
    
    // 1. Bloom (Make it glow first)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        19.5, .8, 0.0
    );

    // 2. Glass (Distort the glowing image)
    glassPass = new ShaderPass(FrostedGlassShader);
    // Config: 
    // Scale 10.0 = Fine frost. Scale 2.0 = Wavy glass.
    glassPass.uniforms.uScale.value = 1.0; 
    // Amount 0.005 = Subtle. Amount 0.02 = Strong smudge.
    glassPass.uniforms.uAmount.value = 0.008; 

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(glassPass); // Glass goes LAST to smudge everything

    borderSystem = new BorderSystem(25, frustumSize * aspect, frustumSize);

    borderSystem.seeds.forEach(seed => {
        const tree = new Tree(seed, borderSystem, scene);
        trees.push(tree);
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    const audioData = sound.getData(); 
    const time = Date.now() * 0.006; 
    
    borderSystem.update(time, audioData);
    trees.forEach(t => t.update(audioData, time));

    // Update Glass Shader
    if (glassPass) {
        glassPass.uniforms.uTime.value = time;
        // Optional: Shake the glass when bass hits
        // glassPass.uniforms.uAmount.value = 0.008 + (audioData.bass * 0.02);
    }

    composer.render();
}

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

init();