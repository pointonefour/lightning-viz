// src/ui1.js

// 1. ADD "onStartCallback" HERE
export function createStartUI(soundSystem, onStartCallback) {
    
    // 1. Main Container
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);

    // 2. The Big Start Button
    const btnInit = document.createElement('button');
    btnInit.innerHTML = "IGNITE SYSTEM";
    btnInit.style.cssText = `
        position: fixed; 
        top: 50%; 
        left: 50%; 
        transform: translate(-50%, -50%); 
        z-index: 1000; 
        padding: 20px 50px; 
        font-family: monospace; 
        font-size: 1.5rem; 
        font-weight: bold; 
        color: white; 
        background: transparent; 
        border: 2px solid white; 
        letter-spacing: 5px; 
        cursor: pointer;
        transition: all 0.5s ease;
    `;
    
    btnInit.onmouseover = () => {
        btnInit.style.background = "white";
        btnInit.style.color = "black";
        btnInit.style.boxShadow = "0 0 30px rgba(255,255,255,0.5)";
    };
    btnInit.onmouseout = () => {
        btnInit.style.background = "transparent";
        btnInit.style.color = "white";
        btnInit.style.boxShadow = "none";
    };

    wrapper.appendChild(btnInit);

    // --- CLICK HANDLER ---
    btnInit.onclick = async () => {
        // 1. Initialize Audio Context (Required user gesture)
        soundSystem.setupContext();
        
        // 2. AUTO-START MICROPHONE
        await soundSystem.initMic();

        // 3. TRIGGER CALLBACK (Ignite the particles)
        // Now this variable exists because we added it to the function arguments
        if (onStartCallback) {
            onStartCallback();
        }
        
        // 4. Fade out big button
        btnInit.style.opacity = '0';
        btnInit.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => btnInit.remove(), 500);

        // 5. Show Toggle UI (With MIC active state)
        createToggleUI(soundSystem);
    };
}

function createToggleUI(soundSystem) {
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        z-index: 1000; 
        display: flex; 
        align-items: center;
        background: rgba(0, 0, 0, 0.6); 
        border: 1px solid rgba(255, 255, 255, 0.3); 
        border-radius: 30px; 
        padding: 4px; 
        backdrop-filter: blur(5px); 
        transition: all 0.4s;
        opacity: 0; 
        animation: fadeIn 1s forwards;
    `;

    // Add CSS Animation
    const style = document.createElement('style');
    style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 0.5; transform: translateY(0); } }`;
    document.head.appendChild(style);

    container.onmouseenter = () => {
        container.style.opacity = '1';
        container.style.border = '1px solid rgba(255, 255, 255, 0.8)';
        container.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.1)';
    };
    container.onmouseleave = () => {
        container.style.opacity = '0.5';
        container.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        container.style.boxShadow = 'none';
    };

    const btnStyle = `
        background: transparent; border: none; color: white;
        font-family: monospace; font-weight: bold; font-size: 12px;
        padding: 8px 16px; cursor: pointer; border-radius: 20px;
        transition: all 0.3s; outline: none;
    `;

    const btnMic = document.createElement('button');
    btnMic.innerHTML = "MIC";
    btnMic.style.cssText = btnStyle;

    const btnSys = document.createElement('button');
    btnSys.innerHTML = "SYS";
    btnSys.style.cssText = btnStyle;

    const sep = document.createElement('div');
    sep.style.cssText = "width: 1px; height: 15px; background: rgba(255,255,255,0.3); margin: 0 2px;";

    const setActive = (activeBtn, otherBtn) => {
        activeBtn.style.background = 'white';
        activeBtn.style.color = 'black';
        activeBtn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
        otherBtn.style.background = 'transparent';
        otherBtn.style.color = 'rgba(255,255,255,0.5)';
        otherBtn.style.boxShadow = 'none';
    };

    // --- DEFAULT STATE: MIC ACTIVE ---
    setActive(btnMic, btnSys);

    btnMic.onclick = async () => {
        setActive(btnMic, btnSys);
        await soundSystem.initMic();
    };

    btnSys.onclick = async () => {
        setActive(btnSys, btnMic);
        await soundSystem.initSystem();
    };

    container.appendChild(btnMic);
    container.appendChild(sep);
    container.appendChild(btnSys);
    document.body.appendChild(container);
}