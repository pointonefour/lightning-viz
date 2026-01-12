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
import { ChoirCircle } from './ChoirCircle.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

let scene, camera, renderer, borderSystem, sound;
// We now have TWO bloom composers
let bloomComposerSoft, bloomComposerStrong, finalComposer;
let trees = [];
let voiceTrees = [];
let streaksPass, glitchPass, invertPass;
let hud, audioGrid;
let choirBorder, choirRed, choirCircle;

let isRedActive = false;
let isTreeActive = true;
let isStreakActive = false; 
let isGlitchActive = false;
let streakFade = 0.0; 
let glitchFade = 0.0;

const frustumSize = 100;
const clock = new THREE.Clock();

// --- MULTI-LAYER MIX SHADER ---
const FinalMixShader = {
    uniforms: {
        baseTexture: { value: null },
        bloomTextureSoft: { value: null },   // Layer 1 Result
        bloomTextureStrong: { value: null }  // Layer 2 Result
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
        uniform sampler2D bloomTextureSoft;
        uniform sampler2D bloomTextureStrong;
        varying vec2 vUv;
        void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec4 soft = texture2D(bloomTextureSoft, vUv);
            vec4 strong = texture2D(bloomTextureStrong, vUv);
            
            // Additive Mixing: Base + Soft Bloom + Strong Bloom
            gl_FragColor = base + soft + strong;
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

    // --- SYSTEMS ---
    hud = new AnalysisHUD();
    audioGrid = new AudioGrid(scene);
    choirBorder = new ChoirBorder(scene);
    choirRed = new ChoirBorderRed(scene);
    choirCircle = new ChoirCircle(scene);

    // --- ASSIGN LAYERS ---
    // Layer 1 = SOFT BLOOM (Trees, Grid)
    // Layer 2 = STRONG BLOOM (Choir Elements)
    
    if(audioGrid.mesh) audioGrid.mesh.layers.enable(1); 
    if(choirBorder.mesh) choirBorder.mesh.layers.enable(2); // Layer 2
    if(choirRed.mesh) choirRed.mesh.layers.enable(2);       // Layer 2
    if(choirCircle.mesh) choirCircle.mesh.layers.enable(1); // Layer 2

    createStartUI(sound, () => {
        console.log("Ignition Sequence Started");
        if (choirBorder) choirBorder.ignite();
        if (choirRed) choirRed.ignite();
        if (choirCircle) choirCircle.ignite();
    });

    // --- COMPOSER SETUP ---
    const renderScene = new RenderPass(scene, camera);

    // 1. SOFT BLOOM COMPOSER (For Layer 1)
    const bloomPassSoft = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPassSoft.threshold = 0.0;
    bloomPassSoft.strength = 2.0; 
    bloomPassSoft.radius = 0.6;   // Tight glow

    bloomComposerSoft = new EffectComposer(renderer);
    bloomComposerSoft.renderToScreen = false;
    bloomComposerSoft.addPass(renderScene);
    bloomComposerSoft.addPass(bloomPassSoft);

    // 2. STRONG BLOOM COMPOSER (For Layer 2)
    const bloomPassStrong = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPassStrong.threshold = 0.0;
    bloomPassStrong.strength = 3.0; // High strength for Choir
    bloomPassStrong.radius = 0.6;   // Wide glow

    bloomComposerStrong = new EffectComposer(renderer);
    bloomComposerStrong.renderToScreen = false;
    bloomComposerStrong.addPass(renderScene);
    bloomComposerStrong.addPass(bloomPassStrong);

    // 3. FINAL COMPOSER
    const finalMixPass = new ShaderPass(
        new THREE.ShaderMaterial({
            uniforms: {
                baseTexture: { value: null },
                bloomTextureSoft: { value: bloomComposerSoft.renderTarget2.texture },
                bloomTextureStrong: { value: bloomComposerStrong.renderTarget2.texture }
            },
            vertexShader: FinalMixShader.vertexShader,
            fragmentShader: FinalMixShader.fragmentShader,
            defines: {}
        }), "baseTexture"
    );
    finalMixPass.needsSwap = true;

    // FX
    streaksPass = new ShaderPass(StreaksShader);
    if (streaksPass.uniforms.uResolution) streaksPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    glitchPass = new ShaderPass(GlitchShader);
    invertPass = new ShaderPass(InvertShader);
    invertPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    finalComposer.addPass(finalMixPass); // Mix everything here
    finalComposer.addPass(streaksPass); 
    finalComposer.addPass(glitchPass); 
    finalComposer.addPass(invertPass);

    // Systems
    borderSystem = new BorderSystem(25, frustumSize * aspect, frustumSize);
    borderSystem.seeds.forEach(seed => {
        const tree = new Tree(seed, borderSystem, scene);
        // Important: Trees go to Layer 1 (Soft Bloom)
        if(tree.mesh) tree.mesh.layers.enable(1); 
        trees.push(tree);
        
        const vTree = new VoiceTree(seed, borderSystem, scene);
        voiceTrees.push(vTree);
    });

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key === 'r') { isRedActive = !isRedActive; voiceTrees.forEach(vt => vt.toggle(isRedActive)); }
        if (key === 't') { isTreeActive = !isTreeActive; trees.forEach(t => t.toggle(isTreeActive)); }
        if (key === 's') isStreakActive = !isStreakActive;
        if (key === 'g') isGlitchActive = !isGlitchActive;
        if (key === 'p') audioGrid.toggle();
        if (key === 'h') hud.toggle();
    });

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
    
    bloomComposerSoft.setSize(window.innerWidth, window.innerHeight);
    bloomComposerStrong.setSize(window.innerWidth, window.innerHeight);
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

    if(audioGrid) audioGrid.update(audioData, time);
    if (borderSystem) borderSystem.update(time, legacyAudio);
    trees.forEach(t => t.update(legacyAudio, time));
    voiceTrees.forEach(vt => vt.update(legacyAudio, time));

    if (choirBorder) choirBorder.update(audioData, time);
    if (choirRed) choirRed.update(audioData, time);
    if (choirCircle) choirCircle.update(audioData, time);
    
    if(hud) {
        const allTrees = [...trees, ...voiceTrees];
        hud.update(allTrees, camera, time);
        if (invertPass) {
            invertPass.uniforms.uActive.value = hud.isActive ? 1.0 : 0.0;
            invertPass.uniforms.uBoxes.value = hud.shaderData;
        }
    }

    if (streaksPass) {
        streaksPass.uniforms.uTreble.value = legacyAudio.treble;
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

    // --- MULTI-PASS RENDER LOOP ---
    
    // 1. Render Soft Bloom (Layer 1)
    camera.layers.set(1);
    bloomComposerSoft.render();
    
    // 2. Render Strong Bloom (Layer 2)
    camera.layers.set(2);
    bloomComposerStrong.render();
    
    // 3. Render Final Scene (Layer 0 + 1 + 2)
    camera.layers.set(0);
    camera.layers.enable(1);
    camera.layers.enable(2);
    finalComposer.render();
}

init();