import * as THREE from 'three';
import { BorderSystem } from './border.js';
import { Tree } from './tree.js';
import { VoiceTree } from './voice.js'; 
import { SoundAnalyser } from './sound.js';
import { StreaksShader } from './streaks.js'; 
import { GlitchShader } from './glitch.js'; 
import { AnalysisHUD } from './hud.js'; 
import { InvertShader } from './invert.js';
import { AudioGrid } from './grid.js';
import { createStartUI } from './ui1.js';
import { ChoirBorder } from './ChoirBorder.js';
import { ChoirBorderRed } from './ChoirBorderRed.js';
import { ChoirCircle } from './ChoirCircle.js'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

let scene, camera, renderer, borderSystem, sound;
let bloomComposer, finalComposer;
let trees = [];
let voiceTrees = [];
let streaksPass, glitchPass, invertPass;
let hud, audioGrid;
let choirBorder, choirRed, choirCircle;

// Toggle Flags
let isRedActive = false;
let isTreeActive = true;
let isStreakActive = false; 
let isGlitchActive = false;

// Fade Values
let streakFade = 0.0; 
let glitchFade = 0.0;

const frustumSize = 100;
const clock = new THREE.Clock();

// --- MIX SHADER (For combining Bloom + Normal) ---
const MixShader = {
    uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: null }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec4 bloom = texture2D(bloomTexture, vUv);
            // Additive mixing
            gl_FragColor = base + bloom;
        }
    `
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

    // 1. Init Helpers
    hud = new AnalysisHUD();
    audioGrid = new AudioGrid(scene);
    
    // --- CREATE VISUALS ---
    choirBorder = new ChoirBorder(scene);
    choirRed = new ChoirBorderRed(scene);
    choirCircle = new ChoirCircle(scene);

    // --- ENABLE LAYER 1 (BLOOM) ---
    // Only objects in Layer 1 will trigger the bloom effect
    if(audioGrid.mesh) audioGrid.mesh.layers.enable(1);
    if(choirBorder.mesh) choirBorder.mesh.layers.enable(1);
    if(choirRed.mesh) choirRed.mesh.layers.enable(1);
    if(choirCircle.mesh) choirCircle.mesh.layers.enable(1);

    // --- CREATE UI ---
    createStartUI(sound, () => {
        console.log("Ignition Sequence Started");
        if (choirBorder) choirBorder.ignite();
        if (choirRed) choirRed.ignite();
        if (choirCircle) choirCircle.ignite();
    });

    // 2. Setup Post-Processing (Selective Bloom)
    const renderScene = new RenderPass(scene, camera);

    // A. BLOOM COMPOSER
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.0;
    bloomPass.strength = 2.0; 
    bloomPass.radius = 0.5;

    bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false; // Important: Don't draw yet
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    // B. FX PASSES
    streaksPass = new ShaderPass(StreaksShader);
    if (streaksPass.uniforms.uResolution) streaksPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    
    glitchPass = new ShaderPass(GlitchShader);
    
    invertPass = new ShaderPass(InvertShader);
    invertPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    // C. FINAL COMPOSER (Mixes Bloom + FX)
    const finalPass = new ShaderPass(
        new THREE.ShaderMaterial({
            uniforms: {
                baseTexture: { value: null },
                bloomTexture: { value: bloomComposer.renderTarget2.texture }
            },
            vertexShader: MixShader.vertexShader,
            fragmentShader: MixShader.fragmentShader,
            defines: {}
        }), "baseTexture"
    );
    finalPass.needsSwap = true;

    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    finalComposer.addPass(finalPass); // 1. Mix the Bloom
    finalComposer.addPass(streaksPass); // 2. Add Streaks
    finalComposer.addPass(glitchPass); // 3. Add Glitch
    finalComposer.addPass(invertPass); // 4. Add Invert

    // 3. Setup Systems
    borderSystem = new BorderSystem(25, frustumSize * aspect, frustumSize);

    borderSystem.seeds.forEach(seed => {
        const tree = new Tree(seed, borderSystem, scene);
        trees.push(tree);
        const vTree = new VoiceTree(seed, borderSystem, scene);
        voiceTrees.push(vTree);
    });

    // 4. Controls
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        if (key === 'r') {
            isRedActive = !isRedActive;
            voiceTrees.forEach(vt => vt.toggle(isRedActive));
        }
        if (key === 't') {
            isTreeActive = !isTreeActive;
            trees.forEach(t => t.toggle(isTreeActive));
        }
        if (key === 's') isStreakActive = !isStreakActive;
        if (key === 'g') isGlitchActive = !isGlitchActive;
        if (key === 'p') audioGrid.toggle();
        if (key === 'h') hud.toggle();
    });

    // Handle Resize
    window.addEventListener('resize', onWindowResize);

    animate();
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    
    if(streaksPass) streaksPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    if(invertPass) invertPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    if(hud) hud.resize();
}

function animate() {
    requestAnimationFrame(animate);
    
    const audioData = sound.getData(); 
    const time = clock.getElapsedTime();

    const legacyAudio = {
        bass: audioData.bass,
        mid: (audioData.lowMid + audioData.highMid) / 2,
        treble: audioData.treble
    };

    // --- UPDATES ---
    if(audioGrid) audioGrid.update(audioData, time);
    if (borderSystem) borderSystem.update(time, legacyAudio);
    trees.forEach(t => t.update(legacyAudio, time));
    voiceTrees.forEach(vt => vt.update(legacyAudio, time));

    if (invertPass && hud) {
        invertPass.uniforms.uActive.value = hud.isActive ? 1.0 : 0.0;
        invertPass.uniforms.uBoxes.value = hud.shaderData;
    }
    
    if (choirBorder) choirBorder.update(audioData, time);
    if (choirRed) choirRed.update(audioData, time);
    if (choirCircle) choirCircle.update(audioData, time);
    
    if(hud) {
        const allTrees = [...trees, ...voiceTrees];
        hud.update(allTrees, camera, time);
    }

    if (streaksPass) {
        if(streaksPass.uniforms.uTreble) streaksPass.uniforms.uTreble.value = legacyAudio.treble;
        const targetStreak = isStreakActive ? 1.0 : 0.0;
        streakFade += (targetStreak - streakFade) * 0.05; 
        streaksPass.uniforms.uActive.value = streakFade;
    }

    if (glitchPass) {
        glitchPass.uniforms.uTime.value = time;
        glitchPass.uniforms.uAudio.value =  legacyAudio.bass;
        const targetGlitch = isGlitchActive ? 1.0 : 0.0;
        glitchFade += (targetGlitch - glitchFade) * 0.1; 
        glitchPass.uniforms.uActive.value = glitchFade;
    }

    // --- SELECTIVE BLOOM RENDER PIPELINE ---
    
    // 1. Render Layer 1 (Glowing Objects) to bloomComposer
    // We set camera to ONLY see Layer 1
    camera.layers.set(1); 
    bloomComposer.render();
    
    // 2. Render Everything to finalComposer
    // We set camera to see Layer 0 AND Layer 1
    camera.layers.set(0); 
    camera.layers.enable(1); 
    
    finalComposer.render();
}

init();