import * as THREE from 'three';
import { BorderSystem } from './border.js';
import { Tree } from './tree.js';
import { VoiceTree } from './voice.js'; 
import { SoundAnalyser } from './sound.js';
import { BlueWaveShader } from './wave.js'; 

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

let scene, camera, renderer, composer, borderSystem, sound;
let trees = [];
let voiceTrees = [];
let wavePass;

let isRedActive = false;
let isBlueActive = false;
let blueFade = 0.0;

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

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        18.5, 0.6, 0.0
    );

    wavePass = new ShaderPass(BlueWaveShader);
    // Safety check to ensure uniform exists
    if (wavePass.uniforms.uResolution) {
        wavePass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(wavePass); 

    borderSystem = new BorderSystem(25, frustumSize * aspect, frustumSize);

    borderSystem.seeds.forEach(seed => {
        const tree = new Tree(seed, borderSystem, scene);
        trees.push(tree);

        const vTree = new VoiceTree(seed, borderSystem, scene);
        voiceTrees.push(vTree);
    });

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        if (key === 'r') {
            isRedActive = !isRedActive;
            voiceTrees.forEach(vt => vt.toggle(isRedActive));
        }

        if (key === 'b') {
            isBlueActive = !isBlueActive;
        }
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    const audioData = sound.getData(); 
    const time = Date.now() * 0.006; 
    
    if (borderSystem) borderSystem.update(time, audioData);
    
    trees.forEach(t => t.update(audioData, time));
    voiceTrees.forEach(vt => vt.update(audioData, time));

    if (wavePass) {
        wavePass.uniforms.uTime.value = time;
        wavePass.uniforms.uAudio.value = audioData.bass;

        const target = isBlueActive ? 1.0 : 0.0;
        blueFade += (target - blueFade) * 0.05; 
        wavePass.uniforms.uActive.value = blueFade;
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
    
    // Safety check for composer
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    
    // Safety check for wavePass
    if(wavePass && wavePass.uniforms.uResolution) {
        wavePass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }
});

init();