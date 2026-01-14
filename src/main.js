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
// 1. IMPORT SMAA
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

let scene, camera, renderer, borderSystem, sound;
let bloomComposer1, bloomComposer2, bloomComposer3, bloomComposer4, finalComposer;
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

const FinalMixShader = {
    uniforms: {
        baseTexture: { value: null },
        bloomTexture1: { value: null },
        bloomTexture2: { value: null },
        bloomTexture3: { value: null },
        bloomTexture4: { value: null }
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
        uniform sampler2D bloomTexture1;
        uniform sampler2D bloomTexture2;
        uniform sampler2D bloomTexture3;
        uniform sampler2D bloomTexture4;
        varying vec2 vUv;
        void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec4 b1 = texture2D(bloomTexture1, vUv);
            vec4 b2 = texture2D(bloomTexture2, vUv);
            vec4 b3 = texture2D(bloomTexture3, vUv);
            vec4 b4 = texture2D(bloomTexture4, vUv);
            gl_FragColor = base + b1 + b2 + b3 + b4;
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

    renderer = new THREE.WebGLRenderer({ 
        antialias: false, // False because we use SMAA pass later
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // 2. CRITICAL FIX: Set Pixel Ratio for High-DPI screens
    // We limit it to 2 to save battery/perf on 4k mobile screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild(renderer.domElement);

    // --- SYSTEMS ---
    hud = new AnalysisHUD();
    audioGrid = new AudioGrid(scene);
    choirBorder = new ChoirBorder(scene);
    choirRed = new ChoirBorderRed(scene);
    choirCircle = new ChoirCircle(scene);

    if(audioGrid.mesh) audioGrid.mesh.layers.enable(1); 
    if(choirBorder.mesh) choirBorder.mesh.layers.enable(2); 
    if(choirRed.mesh) choirRed.mesh.layers.enable(3);       
    if(choirCircle.mesh) choirCircle.mesh.layers.enable(4); 

    createStartUI(sound, () => {
        if (choirBorder) choirBorder.ignite();
        if (choirRed) choirRed.ignite();
        if (choirCircle) choirCircle.ignite();
    });

    const renderScene = new RenderPass(scene, camera);

    // --- 1. BLOOM 1 (Soft) ---
    const pass1 = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    pass1.threshold = 0.0; pass1.strength = 0.05; pass1.radius = 0.0;
    bloomComposer1 = new EffectComposer(renderer);
    bloomComposer1.renderToScreen = false;
    bloomComposer1.addPass(renderScene);
    bloomComposer1.addPass(pass1);

    // --- 2. BLOOM 2 (Blue) ---
    const pass2 = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    pass2.threshold = 0.0; pass2.strength = 0.2; pass2.radius = 0.2;
    bloomComposer2 = new EffectComposer(renderer);
    bloomComposer2.renderToScreen = false;
    bloomComposer2.addPass(renderScene);
    bloomComposer2.addPass(pass2);

    // --- 3. BLOOM 3 (Red) ---
    const pass3 = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    pass3.threshold = 0.0; pass3.strength = 0.5; pass3.radius = 0.3;
    bloomComposer3 = new EffectComposer(renderer);
    bloomComposer3.renderToScreen = false;
    bloomComposer3.addPass(renderScene);
    bloomComposer3.addPass(pass3);

    // --- 4. BLOOM 4 (Circle) ---
    const pass4 = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    pass4.threshold = 0.0; pass4.strength = 0.2; pass4.radius = 0.3;
    bloomComposer4 = new EffectComposer(renderer);
    bloomComposer4.renderToScreen = false;
    bloomComposer4.addPass(renderScene);
    bloomComposer4.addPass(pass4);

    // --- FINAL COMPOSER ---
    const finalMixPass = new ShaderPass(
        new THREE.ShaderMaterial({
            uniforms: {
                baseTexture: { value: null },
                bloomTexture1: { value: bloomComposer1.renderTarget2.texture },
                bloomTexture2: { value: bloomComposer2.renderTarget2.texture },
                bloomTexture3: { value: bloomComposer3.renderTarget2.texture },
                bloomTexture4: { value: bloomComposer4.renderTarget2.texture }
            },
            vertexShader: FinalMixShader.vertexShader,
            fragmentShader: FinalMixShader.fragmentShader,
            defines: {}
        }), "baseTexture"
    );
    finalMixPass.needsSwap = true;

    streaksPass = new ShaderPass(StreaksShader);
    if (streaksPass.uniforms.uResolution) streaksPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    glitchPass = new ShaderPass(GlitchShader);
    invertPass = new ShaderPass(InvertShader);
    invertPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    // 3. SMAA PASS (Anti-Aliasing)
    // Needs screen resolution
    const smaaPass = new SMAAPass(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());

    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    finalComposer.addPass(finalMixPass);
    finalComposer.addPass(streaksPass); 
    finalComposer.addPass(glitchPass); 
    finalComposer.addPass(invertPass);
    
    // SMAA Must be the LAST pass to smooth out jagged edges
    finalComposer.addPass(smaaPass); 

    // Systems
    borderSystem = new BorderSystem(25, frustumSize * aspect, frustumSize);
    borderSystem.seeds.forEach(seed => {
        const tree = new Tree(seed, borderSystem, scene);
        if(tree.mesh) tree.mesh.layers.enable(3); 
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
    
    // Update Composers
    bloomComposer1.setSize(window.innerWidth, window.innerHeight);
    bloomComposer2.setSize(window.innerWidth, window.innerHeight);
    bloomComposer3.setSize(window.innerWidth, window.innerHeight);
    bloomComposer4.setSize(window.innerWidth, window.innerHeight);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    
    // Update FX
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

    camera.layers.set(1); bloomComposer1.render();
    camera.layers.set(2); bloomComposer2.render();
    camera.layers.set(3); bloomComposer3.render();
    camera.layers.set(4); bloomComposer4.render();

    camera.layers.set(0);
    camera.layers.enable(1);
    camera.layers.enable(2);
    camera.layers.enable(3);
    camera.layers.enable(4);
    
    finalComposer.render();
}

init();