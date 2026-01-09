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
//import { FlowField } from './FlowField.js'; 
import { ChoirBorder } from './ChoirBorder.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

let scene, camera, renderer, composer, borderSystem, sound;
let trees = [];
let voiceTrees = [];
let streaksPass, glitchPass, invertPass;
let hud, audioGrid;
//let flowField;
let choirBorder;

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


/*const btn = document.createElement('button');
btn.innerHTML = "IGNITE";
btn.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:99; padding:15px 30px; cursor:pointer; background:white; border:2px solid white; font-weight:bold; letter-spacing:4px; font-family: monospace; font-size: 1.2rem;";
document.body.appendChild(btn);*/

/*btn.onclick = async () => {
    await sound.init();
    btn.style.opacity = '0';
    setTimeout(() => btn.remove(), 1000);
};*/

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
    
    //flowField = new FlowField(scene);
    choirBorder = new ChoirBorder(scene);
    createStartUI(sound);

    // 2. Setup Post-Processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 5.5, 0.6, 0.0);
    
    // --- DELETE THE LINE THAT WAS HERE ---
    // const flowField = new FlowField(scene);  <-- THIS WAS THE PROBLEM

    streaksPass = new ShaderPass(StreaksShader);
    if (streaksPass.uniforms.uResolution) streaksPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    
    glitchPass = new ShaderPass(GlitchShader);
    
    invertPass = new ShaderPass(InvertShader);
    invertPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(streaksPass); 
    composer.addPass(bloomPass);   
    composer.addPass(glitchPass); 
    composer.addPass(invertPass);

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
            // Loop through all standard trees and toggle them
            trees.forEach(t => t.toggle(isTreeActive));
            console.log("Trees Toggled:", isTreeActive);
        }
        if (key === 's') isStreakActive = !isStreakActive;
        if (key === 'g') isGlitchActive = !isGlitchActive;
        
        // 'P' toggles Grid
        if (key === 'p') audioGrid.toggle();
        // 'H' toggles HUD
        if (key === 'h') hud.toggle();


    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    const audioData = sound.getData(); 
    //const time = Date.now() * 0.006; 
    const time = clock.getElapsedTime();

    const legacyAudio = {
        bass: audioData.bass,
        mid: (audioData.lowMid + audioData.highMid) / 2, // Average the mids
        treble: audioData.treble
    };

    if(audioGrid) audioGrid.update(audioData, time);
    
    if (borderSystem) borderSystem.update(time, legacyAudio);
    trees.forEach(t => t.update(legacyAudio, time));
    voiceTrees.forEach(vt => vt.update(legacyAudio, time));

    // Update Grid
    if(audioGrid) audioGrid.update(audioData, time);

    // Update Invert & HUD
    if (invertPass && hud) {
        invertPass.uniforms.uActive.value = hud.isActive ? 1.0 : 0.0;
        invertPass.uniforms.uBoxes.value = hud.shaderData;
    }
     if (choirBorder) {
        choirBorder.update(audioData, time);
    }

    /*if(flowField) {
    
    flowField.update(audioData, time);
}*/
    
    if(hud) {
        const allTrees = [...trees, ...voiceTrees];
        hud.update(allTrees, camera, time);
    }

    // Update Streaks
    if (streaksPass) {
        if(streaksPass.uniforms.uTreble) streaksPass.uniforms.uTreble.value = legacyAudio.treble;
        const targetStreak = isStreakActive ? 1.0 : 0.0;
        streakFade += (targetStreak - streakFade) * 0.05; 
        streaksPass.uniforms.uActive.value = streakFade;
    }

    // Update Glitch
    if (glitchPass) {
        glitchPass.uniforms.uTime.value = time;
        glitchPass.uniforms.uAudio.value =  legacyAudio.bass;
        const targetGlitch = isGlitchActive ? 1.0 : 0.0;
        glitchFade += (targetGlitch - glitchFade) * 0.1; 
        glitchPass.uniforms.uActive.value = glitchFade;
    }

    if (composer) composer.render();
}

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    
    if(streaksPass && streaksPass.uniforms.uResolution) streaksPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    if(invertPass) invertPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    
    if(hud) hud.resize();
});

init();