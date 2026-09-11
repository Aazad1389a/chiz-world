/* =========================================================
   AZAD WORLD
   MAIN GAME ENGINE
   Version 1.0
   Three.js
   PC + Android Web
========================================================= */

import * as THREE from "three";

import {
    OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
    DRACOLoader
} from "three/addons/loaders/DRACOLoader.js";

import {
    KTX2Loader
} from "three/addons/loaders/KTX2Loader.js";

import {
    RGBELoader
} from "three/addons/loaders/RGBELoader.js";


/* =========================================================
   GAME CONFIG
========================================================= */

const GAME_CONFIG = {

    name: "AZAD WORLD",

    version: "1.0.0",

    graphics: {

        defaultQuality: "high",

        maxPixelRatio: 2,

        shadowMapSize: 4096,

        exposure: 1.1

    },

    player: {

        height: 1.8,

        speed: 5,

        sprintSpeed: 9,

        jumpPower: 7,

        gravity: 20

    }

};


/* =========================================================
   GLOBAL GAME STATE
========================================================= */

const GAME_STATE = {

    started: false,

    paused: false,

    quality: GAME_CONFIG.graphics.defaultQuality,

    health: 100,

    stamina: 100,

    fps: 0,

    ping: 0,

    isMobile:
        /Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent
        )

};


/* =========================================================
   DOM
========================================================= */

const canvasContainer =
    document.getElementById(
        "game-canvas"
    );

const loadingScreen =
    document.getElementById(
        "loading-screen"
    );

const loadingProgress =
    document.getElementById(
        "loading-progress"
    );

const loadingText =
    document.getElementById(
        "loading-text"
    );

const mainMenu =
    document.getElementById(
        "main-menu"
    );

const hud =
    document.getElementById(
        "hud"
    );

const pauseMenu =
    document.getElementById(
        "pause-menu"
    );

const settingsPanel =
    document.getElementById(
        "settings-panel"
    );

const mobileControls =
    document.getElementById(
        "mobile-controls"
    );

const errorScreen =
    document.getElementById(
        "error-screen"
    );


/* =========================================================
   SCENE
========================================================= */

const scene =
    new THREE.Scene();

scene.background =
    new THREE.Color(
        0x87ceeb
    );

scene.fog =
    new THREE.FogExp2(
        0x87ceeb,
        0.006
    );


/* =========================================================
   CAMERA
========================================================= */

const camera =
    new THREE.PerspectiveCamera(

        70,

        window.innerWidth /
        window.innerHeight,

        0.05,

        3000

    );

camera.position.set(
    0,
    6,
    16
);


/* =========================================================
   RENDERER
========================================================= */

const renderer =
    new THREE.WebGLRenderer({

        antialias: true,

        powerPreference:
            "high-performance",

        logarithmicDepthBuffer:
            true

    });


renderer.setSize(

    window.innerWidth,

    window.innerHeight

);


renderer.setPixelRatio(

    Math.min(

        window.devicePixelRatio,

        GAME_CONFIG.graphics.maxPixelRatio

    )

);


renderer.outputColorSpace =
    THREE.SRGBColorSpace;


renderer.toneMapping =
    THREE.ACESFilmicToneMapping;


renderer.toneMappingExposure =
    GAME_CONFIG.graphics.exposure;


renderer.shadowMap.enabled =
    true;


renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;


canvasContainer.appendChild(
    renderer.domElement
);


/* =========================================================
   LIGHTING
========================================================= */


/* Sun */

const sun =
    new THREE.DirectionalLight(

        0xffffff,

        4

    );


sun.position.set(
    100,
    180,
    80
);


sun.castShadow =
    true;


sun.shadow.mapSize.width =
    GAME_CONFIG.graphics.shadowMapSize;


sun.shadow.mapSize.height =
    GAME_CONFIG.graphics.shadowMapSize;


sun.shadow.camera.near =
    1;


sun.shadow.camera.far =
    600;


sun.shadow.camera.left =
    -250;


sun.shadow.camera.right =
    250;


sun.shadow.camera.top =
    250;


sun.shadow.camera.bottom =
    -250;


sun.shadow.bias =
    -0.0001;


scene.add(
    sun
);


/* Hemisphere */

const hemisphere =
    new THREE.HemisphereLight(

        0xbfe8ff,

        0x3b3025,

        2.4

    );


scene.add(
    hemisphere
);


/* Ambient */

const ambient =
    new THREE.AmbientLight(

        0xffffff,

        0.25

    );


scene.add(
    ambient
);


/* =========================================================
   WORLD
========================================================= */

const world =
    new THREE.Group();

world.name =
    "World";

scene.add(
    world
);


/* =========================================================
   GROUND
========================================================= */

const groundGeometry =
    new THREE.PlaneGeometry(

        1000,

        1000,

        100,

        100

    );


const groundMaterial =
    new THREE.MeshStandardMaterial({

        color:
            0x536b3c,

        roughness:
            0.92,

        metalness:
            0.0

    });


const ground =
    new THREE.Mesh(

        groundGeometry,

        groundMaterial

    );


ground.rotation.x =
    -Math.PI / 2;


ground.receiveShadow =
    true;


ground.name =
    "WorldGround";


world.add(
    ground
);


/* =========================================================
   ROAD
========================================================= */

function createRoad(
    width,
    length,
    x,
    z
) {

    const geometry =
        new THREE.PlaneGeometry(

            width,

            length

        );


    const material =
        new THREE.MeshStandardMaterial({

            color:
                0x24272a,

            roughness:
                0.92,

            metalness:
                0.02

        });


    const road =
        new THREE.Mesh(

            geometry,

            material

        );


    road.rotation.x =
        -Math.PI / 2;


    road.position.set(

        x,

        0.015,

        z

    );


    road.receiveShadow =
        true;


    world.add(
        road
    );

}


createRoad(
    18,
    900,
    0,
    0
);


createRoad(
    900,
    18,
    0,
    0
);


/* =========================================================
   BUILDINGS
========================================================= */

function createBuilding({

    x,
    z,
    width,
    height,
    depth,
    color = 0x777777

}) {

    const geometry =
        new THREE.BoxGeometry(

            width,
            height,
            depth

        );


    const material =
        new THREE.MeshStandardMaterial({

            color,

            roughness:
                0.75,

            metalness:
                0.05

        });


    const building =
        new THREE.Mesh(

            geometry,

            material

        );


    building.position.set(

        x,

        height / 2,

        z

    );


    building.castShadow =
        true;


    building.receiveShadow =
        true;


    world.add(
        building
    );


    return building;

}


/* City */

createBuilding({

    x: -45,
    z: -40,
    width: 30,
    height: 35,
    depth: 30,
    color: 0x666a70

});


createBuilding({

    x: 45,
    z: -45,
    width: 28,
    height: 55,
    depth: 30,
    color: 0x77736c

});


createBuilding({

    x: -50,
    z: 45,
    width: 25,
    height: 25,
    depth: 28,
    color: 0x59636d

});


createBuilding({

    x: 50,
    z: 45,
    width: 32,
    height: 42,
    depth: 32,
    color: 0x777777

});


/* =========================================================
   TREES
========================================================= */

function createTree(
    x,
    z,
    scale = 1
) {

    const tree =
        new THREE.Group();


    const trunkGeometry =
        new THREE.CylinderGeometry(

            0.35 * scale,
            0.55 * scale,
            4 * scale,
            16

        );


    const trunkMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x5a351f,

            roughness:
                1

        });


    const trunk =
        new THREE.Mesh(

            trunkGeometry,

            trunkMaterial

        );


    trunk.position.y =
        2 * scale;


    trunk.castShadow =
        true;


    tree.add(
        trunk
    );


    const leavesGeometry =
        new THREE.SphereGeometry(

            2.8 * scale,

            24,

            24

        );


    const leavesMaterial =
        new THREE.MeshStandardMaterial({

            color:
                0x245c2a,

            roughness:
                0.9

        });


    const leaves =
        new THREE.Mesh(

            leavesGeometry,

            leavesMaterial

        );


    leaves.position.y =
        5 * scale;


    leaves.castShadow =
        true;


    tree.add(
        leaves
    );


    tree.position.set(
        x,
        0,
        z
    );


    world.add(
        tree
    );

}


/* Forest */

const treePositions = [

    [-15, -20],
    [15, -20],
    [-25, 25],
    [25, 25],
    [-70, -10],
    [70, -10],
    [-70, 70],
    [70, 70],
    [-80, 30],
    [80, 30]

];


for (
    const [x, z]
    of treePositions
) {

    createTree(
        x,
        z,
        0.8 +
        Math.random() *
        0.5
    );

}


/* =========================================================
   PLAYER
========================================================= */

const player =
    new THREE.Group();

player.name =
    "Player";


player.position.set(
    0,
    0,
    10
);


scene.add(
    player
);


/* Temporary player body */

const playerGeometry =
    new THREE.CapsuleGeometry(

        0.45,

        1.0,

        8,

        16

    );


const playerMaterial =
    new THREE.MeshStandardMaterial({

        color:
            0x2e6fff,

        roughness:
            0.65

    });


const playerBody =
    new THREE.Mesh(

        playerGeometry,

        playerMaterial

    );


playerBody.position.y =
    1.35;


playerBody.castShadow =
    true;


player.add(
    playerBody
);


/* =========================================================
   CAMERA CONTROL
========================================================= */

const controls =
    new OrbitControls(

        camera,

        renderer.domElement

    );


controls.enableDamping =
    true;


controls.dampingFactor =
    0.06;


controls.enablePan =
    false;


controls.minDistance =
    4;


controls.maxDistance =
    40;


controls.maxPolarAngle =
    Math.PI / 2.05;


controls.target.set(
    0,
    1.5,
    10
);


/* =========================================================
   GLTF LOADER
========================================================= */

const gltfLoader =
    new GLTFLoader();


const dracoLoader =
    new DRACOLoader();


dracoLoader.setDecoderPath(

    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"

);


gltfLoader.setDRACOLoader(
    dracoLoader
);


/* =========================================================
   KTX2 LOADER
========================================================= */

const ktx2Loader =
    new KTX2Loader();


ktx2Loader.setTranscoderPath(

    "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/basis/"

);


ktx2Loader.detectSupport(
    renderer
);


gltfLoader.setKTX2Loader(
    ktx2Loader
);


/* =========================================================
   HDR LOADER
========================================================= */

const hdrLoader =
    new RGBELoader();


/* =========================================================
   ASSET LOADER
========================================================= */

async function loadModel(
    url
) {

    try {

        const result =
            await gltfLoader.loadAsync(
                url
            );


        const model =
            result.scene;


        model.traverse(
            object => {

                if (
                    object.isMesh
                ) {

                    object.castShadow =
                        true;

                    object.receiveShadow =
                        true;


                    if (
                        object.material
                    ) {

                        object.material.envMapIntensity =
                            1.0;

                    }

                }

            }
        );


        return {

            model,

            animations:
                result.animations

        };

    }

    catch (error) {

        console.error(
            "Model loading failed:",
            error
        );

        return null;

    }

}


/* =========================================================
   QUALITY SYSTEM
========================================================= */

const QUALITY_PROFILES = {

    low: {

        pixelRatio:
            1,

        shadows:
            false,

        exposure:
            1.0

    },


    medium: {

        pixelRatio:
            1.25,

        shadows:
            true,

        exposure:
            1.05

    },


    high: {

        pixelRatio:
            1.75,

        shadows:
            true,

        exposure:
            1.1

    },


    ultra: {

        pixelRatio:
            2,

        shadows:
            true,

        exposure:
            1.15

    }

};


function setGraphicsQuality(
    quality
) {

    const profile =
        QUALITY_PROFILES[
            quality
        ] ||
        QUALITY_PROFILES.high;


    GAME_STATE.quality =
        quality;


    renderer.setPixelRatio(

        Math.min(

            window.devicePixelRatio *
            profile.pixelRatio,

            2.5

        )

    );


    renderer.shadowMap.enabled =
        profile.shadows;


    renderer.toneMappingExposure =
        profile.exposure;


    console.log(
        "Graphics:",
        quality
    );

}


/* =========================================================
   INPUT SYSTEM
========================================================= */

const keys = {};


window.addEventListener(
    "keydown",
    event => {

        keys[
            event.code
        ] = true;


        if (
            event.code ===
            "Escape"
        ) {

            togglePause();

        }

    }
);


window.addEventListener(
    "keyup",
    event => {

        keys[
            event.code
        ] = false;

    }
);


/* =========================================================
   PLAYER MOVEMENT
========================================================= */

let velocityY =
    0;

let grounded =
    true;


function updatePlayer(
    delta
) {

    if (
        !GAME_STATE.started ||
        GAME_STATE.paused
    ) {

        return;

    }


    const direction =
        new THREE.Vector3();


    if (
        keys["KeyW"]
    ) {

        direction.z -= 1;

    }


    if (
        keys["KeyS"]
    ) {

        direction.z += 1;

    }


    if (
        keys["KeyA"]
    ) {

        direction.x -= 1;

    }


    if (
        keys["KeyD"]
    ) {

        direction.x += 1;

    }


    if (
        direction.lengthSq() > 0
    ) {

        direction.normalize();


        const running =
            keys["ShiftLeft"] ||
            keys["ShiftRight"];


        const speed =
            running
                ? GAME_CONFIG.player.sprintSpeed
                : GAME_CONFIG.player.speed;


        player.position.x +=
            direction.x *
            speed *
            delta;


        player.position.z +=
            direction.z *
            speed *
            delta;

    }


    /* Jump */

    if (
        keys["Space"] &&
        grounded
    ) {

        velocityY =
            GAME_CONFIG.player.jumpPower;

        grounded =
            false;

    }


    velocityY -=
        GAME_CONFIG.player.gravity *
        delta;


    player.position.y +=
        velocityY *
        delta;


    if (
        player.position.y <= 0
    ) {

        player.position.y =
            0;

        velocityY =
            0;

        grounded =
            true;

    }


    /* Camera */

    controls.target.set(

        player.position.x,

        player.position.y + 1.5,

        player.position.z

    );

}


/* =========================================================
   UI HELPERS
========================================================= */

function show(
    element
) {

    if (!element) {
        return;
    }

    element.classList.remove(
        "hidden"
    );

    element.classList.add(
        "active"
    );

}


function hide(
    element
) {

    if (!element) {
        return;
    }

    element.classList.remove(
        "active"
    );

    element.classList.add(
        "hidden"
    );

}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

    GAME_STATE.started =
        true;

    GAME_STATE.paused =
        false;


    hide(
        loadingScreen
    );

    hide(
        mainMenu
    );

    hide(
        pauseMenu
    );

    hide(
        settingsPanel
    );


    show(
        hud
    );


    if (
        GAME_STATE.isMobile
    ) {

        show(
            mobileControls
        );

    }


    controls.enabled =
        true;

}


/* =========================================================
   PAUSE
========================================================= */

function togglePause() {

    if (
        !GAME_STATE.started
    ) {

        return;

    }


    GAME_STATE.paused =
        !GAME_STATE.paused;


    if (
        GAME_STATE.paused
    ) {

        show(
            pauseMenu
        );

    }

    else {

        hide(
            pauseMenu
        );

    }

}


/* =========================================================
   SETTINGS
========================================================= */

function openSettings() {

    hide(
        mainMenu
    );

    hide(
        pauseMenu
    );

    show(
        settingsPanel
    );

}


function closeSettings() {

    hide(
        settingsPanel
    );


    if (
        GAME_STATE.started
    ) {

        if (
            GAME_STATE.paused
        ) {

            show(
                pauseMenu
            );

        }

        else {

            show(
                hud
            );

        }

    }

    else {

        show(
            mainMenu
        );

    }

}


/* =========================================================
   MAIN MENU BUTTONS
========================================================= */

document
    .getElementById(
        "play-button"
    )
    ?.addEventListener(
        "click",
        startGame
    );


document
    .getElementById(
        "settings-button"
    )
    ?.addEventListener(
        "click",
        openSettings
    );


document
    .getElementById(
        "pause-settings-button"
    )
    ?.addEventListener(
        "click",
        openSettings
    );


document
    .getElementById(
        "close-settings-button"
    )
    ?.addEventListener(
        "click",
        closeSettings
    );


document
    .getElementById(
        "resume-button"
    )
    ?.addEventListener(
        "click",
        togglePause
    );


document
    .getElementById(
        "quit-button"
    )
    ?.addEventListener(
        "click",
        () => {

            GAME_STATE.started =
                false;

            GAME_STATE.paused =
                false;

            hide(
                hud
            );

            hide(
                pauseMenu
            );

            show(
                mainMenu
            );

        }
    );


document
    .getElementById(
        "reload-button"
    )
    ?.addEventListener(
        "click",
        () => {

            location.reload();

        }
    );


/* =========================================================
   GRAPHICS SETTINGS
========================================================= */

document
    .getElementById(
        "graphics-quality"
    )
    ?.addEventListener(
        "change",
        event => {

            setGraphicsQuality(
                event.target.value
            );

        }
    );


document
    .getElementById(
        "fullscreen"
    )
    ?.addEventListener(
        "change",
        event => {

            if (
                event.target.checked
            ) {

                document.documentElement
                    .requestFullscreen?.();

            }

            else if (
                document.fullscreenElement
            ) {

                document.exitFullscreen?.();

            }

        }
    );


/* =========================================================
   FPS COUNTER
========================================================= */

let frameCounter =
    0;

let fpsTimer =
    0;


function updateFPS(
    delta
) {

    frameCounter++;

    fpsTimer +=
        delta;


    if (
        fpsTimer >= 1
    ) {

        GAME_STATE.fps =
            frameCounter;

        frameCounter =
            0;

        fpsTimer =
            0;


        const fpsElement =
            document.getElementById(
                "fps-counter"
            );


        if (
            fpsElement
        ) {

            fpsElement.textContent =
                `FPS: ${GAME_STATE.fps}`;

        }

    }

}


/* =========================================================
   HUD
========================================================= */

function updateHUD() {

    const health =
        document.getElementById(
            "health-bar"
        );


    const stamina =
        document.getElementById(
            "stamina-bar"
        );


    if (
        health
    ) {

        health.style.width =
            `${GAME_STATE.health}%`;

    }


    if (
        stamina
    ) {

        stamina.style.width =
            `${GAME_STATE.stamina}%`;

    }

}


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;


        camera.updateProjectionMatrix();


        renderer.setSize(

            window.innerWidth,

            window.innerHeight

        );

    }
);


/* =========================================================
   LOADING
========================================================= */

function updateLoading(
    progress,
    text
) {

    if (
        loadingProgress
    ) {

        loadingProgress.style.width =
            `${progress}%`;

    }


    if (
        loadingText
    ) {

        loadingText.textContent =
            text;

    }

}


async function initializeGame() {

    try {

        updateLoading(
            10,
            "Initializing renderer..."
        );


        /* WebGL test */

        const gl =
            renderer.getContext();


        if (!gl) {

            throw new Error(
                "WebGL is not available."
            );

        }


        updateLoading(
            30,
            "Building world..."
        );


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    200
                )
        );


        updateLoading(
            55,
            "Preparing lighting..."
        );


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    200
                )
        );


        updateLoading(
            75,
            "Preparing graphics..."
        );


        setGraphicsQuality(
            GAME_STATE.quality
        );


        updateLoading(
            100,
            "Ready."
        );


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
        );


        hide(
            loadingScreen
        );


        show(
            mainMenu
        );


    }

    catch (error) {

        console.error(
            error
        );


        hide(
            loadingScreen
        );


        show(
            errorScreen
        );


        const message =
            document.getElementById(
                "error-message"
            );


        if (
            message
        ) {

            message.textContent =
                error.message;

        }

    }

}


/* =========================================================
   GAME LOOP
========================================================= */

const clock =
    new THREE.Clock();


function gameLoop() {

    requestAnimationFrame(
        gameLoop
    );


    const delta =
        Math.min(
            clock.getDelta(),
            0.05
        );


    updatePlayer(
        delta
    );


    updateFPS(
        delta
    );


    updateHUD();


    controls.update();


    renderer.render(
        scene,
        camera
    );

}


/* =========================================================
   GLOBAL API
========================================================= */

window.AZAD_WORLD = {

    scene,

    camera,

    renderer,

    player,

    startGame,

    togglePause,

    setGraphicsQuality,

    loadModel,

    state:
        GAME_STATE,

    config:
        GAME_CONFIG

};


/* =========================================================
   START
========================================================= */

initializeGame();

gameLoop();
