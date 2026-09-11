// ============================================================
// AZAD WORLD
// Weather System
// src/world/weather.js
// ============================================================

import * as THREE from "three";

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { worldSystem } from "./world.js";


// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_WEATHER_CONFIG = {

    enabled: true,

    defaultWeather: "clear",

    transitionDuration: 8,

    rainParticles: 7000,

    snowParticles: 5000,

    fogEnabled: true,

    lightningEnabled: true,

    windEnabled: true,

    dynamicSky: true,

    dynamicLighting: true,

    precipitationArea: 220,

    precipitationHeight: 80,

    windStrength: 1.0,

    updateRate: 30
};


// ============================================================
// WEATHER PRESETS
// ============================================================

const WEATHER_PRESETS = {

    clear: {

        name: "clear",

        cloudiness: 0.05,

        rain: 0,

        snow: 0,

        fog: 0.02,

        wind: 0.15,

        visibility: 1,

        brightness: 1,

        skyColor: 0x87ceeb,

        fogColor: 0x9bc7dc,

        lightning: false
    },

    cloudy: {

        name: "cloudy",

        cloudiness: 0.65,

        rain: 0,

        snow: 0,

        fog: 0.08,

        wind: 0.35,

        visibility: 0.82,

        brightness: 0.82,

        skyColor: 0x6f7884,

        fogColor: 0x7f8994,

        lightning: false
    },

    rain: {

        name: "rain",

        cloudiness: 0.9,

        rain: 1,

        snow: 0,

        fog: 0.14,

        wind: 0.7,

        visibility: 0.68,

        brightness: 0.65,

        skyColor: 0x4e5967,

        fogColor: 0x65717d,

        lightning: true
    },

    storm: {

        name: "storm",

        cloudiness: 1,

        rain: 1.4,

        snow: 0,

        fog: 0.22,

        wind: 1.35,

        visibility: 0.52,

        brightness: 0.48,

        skyColor: 0x29313d,

        fogColor: 0x424b57,

        lightning: true
    },

    fog: {

        name: "fog",

        cloudiness: 0.45,

        rain: 0,

        snow: 0,

        fog: 0.72,

        wind: 0.08,

        visibility: 0.3,

        brightness: 0.72,

        skyColor: 0x9ca6ae,

        fogColor: 0xa5adb4,

        lightning: false
    },

    snow: {

        name: "snow",

        cloudiness: 0.9,

        rain: 0,

        snow: 1,

        fog: 0.2,

        wind: 0.45,

        visibility: 0.62,

        brightness: 0.82,

        skyColor: 0xb9c3cc,

        fogColor: 0xd1d8dc,

        lightning: false
    },

    sandstorm: {

        name: "sandstorm",

        cloudiness: 0.8,

        rain: 0,

        snow: 0,

        fog: 0.55,

        wind: 1.5,

        visibility: 0.28,

        brightness: 0.55,

        skyColor: 0xb4875c,

        fogColor: 0xc29b70,

        lightning: false
    }
};


// ============================================================
// HELPERS
// ============================================================

function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


function lerp(
    a,
    b,
    alpha
) {

    return a +
        (b - a) *
        alpha;
}


function lerpColor(
    from,
    to,
    alpha
) {

    const a =
        new THREE.Color(from);

    const b =
        new THREE.Color(to);

    return a.lerp(
        b,
        clamp(alpha, 0, 1)
    );
}


function randomRange(
    min,
    max
) {

    return min +
        Math.random() *
        (max - min);
}


// ============================================================
// WEATHER SYSTEM
// ============================================================

export class WeatherSystem {

    constructor(options = {}) {

        this.config = {
            ...DEFAULT_WEATHER_CONFIG,
            ...options
        };

        this.initialized = false;

        this.disposed = false;

        this.elapsedTime = 0;

        this.updateAccumulator = 0;

        // --------------------------------------------------------
        // Current weather
        // --------------------------------------------------------

        this.currentWeather =
            this.config.defaultWeather;

        this.targetWeather =
            this.currentWeather;

        this.transitionProgress = 1;

        this.transitionDuration =
            this.config.transitionDuration;

        // --------------------------------------------------------
        // Runtime values
        // --------------------------------------------------------

        this.state = {

            cloudiness: 0,

            rain: 0,

            snow: 0,

            fog: 0,

            wind: 0,

            visibility: 1,

            brightness: 1,

            lightning: false
        };

        // --------------------------------------------------------
        // Scene objects
        // --------------------------------------------------------

        this.root =
            new THREE.Group();

        this.root.name =
            "WEATHER_ROOT";

        this.cloudGroup =
            new THREE.Group();

        this.cloudGroup.name =
            "WEATHER_CLOUDS";

        this.precipitationGroup =
            new THREE.Group();

        this.precipitationGroup.name =
            "WEATHER_PRECIPITATION";

        this.lightningGroup =
            new THREE.Group();

        this.lightningGroup.name =
            "WEATHER_LIGHTNING";

        this.root.add(
            this.cloudGroup
        );

        this.root.add(
            this.precipitationGroup
        );

        this.root.add(
            this.lightningGroup
        );

        // --------------------------------------------------------
        // Particle systems
        // --------------------------------------------------------

        this.rainSystem = null;

        this.snowSystem = null;

        this.clouds = [];

        // --------------------------------------------------------
        // Wind
        // --------------------------------------------------------

        this.windDirection =
            new THREE.Vector3(
                1,
                0,
                0.25
            ).normalize();

        this.windOffset =
            new THREE.Vector3();

        // --------------------------------------------------------
        // Lightning
        // --------------------------------------------------------

        this.lightningTimer = 0;

        this.lightningDuration = 0;

        this.lightningIntensity = 0;

        this.lightningLight = null;

        // --------------------------------------------------------
        // Events
        // --------------------------------------------------------

        this.listeners = new Map();
    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    initialize(
        scene = null
    ) {

        if (this.initialized) {

            return this;
        }

        if (this.disposed) {

            throw new Error(
                "WeatherSystem has already been disposed."
            );
        }

        if (
            !worldSystem.initialized
        ) {

            worldSystem.initialize();
        }

        // --------------------------------------------------------
        // Attach to world
        // --------------------------------------------------------

        if (scene) {

            scene.add(
                this.root
            );

        } else {

            worldSystem.environmentGroup.add(
                this.root
            );
        }

        // --------------------------------------------------------
        // Create systems
        // --------------------------------------------------------

        this.createRainSystem();

        this.createSnowSystem();

        this.createClouds();

        this.createLightning();

        // --------------------------------------------------------
        // Apply default
        // --------------------------------------------------------

        const preset =
            this.getPreset(
                this.currentWeather
            );

        this.applyPresetImmediately(
            preset
        );

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        gameState.set(
            "world.weather.type",
            this.currentWeather
        );

        gameState.set(
            "world.weather.active",
            true
        );

        this.initialized = true;

        this.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }


    // ============================================================
    // PRESET
    // ============================================================

    getPreset(
        weather
    ) {

        return (
            WEATHER_PRESETS[weather] ||
            WEATHER_PRESETS.clear
        );
    }


    // ============================================================
    // SET WEATHER
    // ============================================================

    setWeather(
        weather,
        duration = this.config.transitionDuration
    ) {

        if (
            !WEATHER_PRESETS[weather]
        ) {

            console.warn(
                `[AZAD WORLD] Unknown weather: ${weather}`
            );

            return false;
        }

        if (
            weather ===
            this.currentWeather
        ) {

            this.targetWeather =
                weather;

            this.transitionProgress =
                1;

            return true;
        }

        this.targetWeather =
            weather;

        this.transitionDuration =
            Math.max(
                0,
                numberOrDefault(
                    duration,
                    this.config.transitionDuration
                )
            );

        this.transitionProgress =
            0;

        this.emit(
            "weatherChanging",
            {
                from:
                    this.currentWeather,

                to:
                    weather,

                duration:
                    this.transitionDuration
            }
        );

        return true;
    }


    // ============================================================
    // IMMEDIATE WEATHER
    // ============================================================

    setWeatherImmediately(
        weather
    ) {

        if (
            !WEATHER_PRESETS[weather]
        ) {

            return false;
        }

        this.currentWeather =
            weather;

        this.targetWeather =
            weather;

        this.transitionProgress =
            1;

        this.applyPresetImmediately(
            this.getPreset(weather)
        );

        this.updateGameState();

        this.emit(
            "weatherChanged",
            {
                weather
            }
        );

        return true;
    }


    // ============================================================
    // APPLY PRESET
    // ============================================================

    applyPresetImmediately(
        preset
    ) {

        this.state.cloudiness =
            preset.cloudiness;

        this.state.rain =
            preset.rain;

        this.state.snow =
            preset.snow;

        this.state.fog =
            preset.fog;

        this.state.wind =
            preset.wind;

        this.state.visibility =
            preset.visibility;

        this.state.brightness =
            preset.brightness;

        this.state.lightning =
            preset.lightning;

        this.updateVisualSystems();
    }


    // ============================================================
    // UPDATE TRANSITION
    // ============================================================

    updateTransition(
        deltaTime
    ) {

        if (
            this.transitionProgress >=
            1
        ) {

            return;
        }

        if (
            this.transitionDuration <=
            0
        ) {

            this.transitionProgress =
                1;

        } else {

            this.transitionProgress +=
                deltaTime /
                this.transitionDuration;

            this.transitionProgress =
                clamp(
                    this.transitionProgress,
                    0,
                    1
                );
        }

        const from =
            this.getPreset(
                this.currentWeather
            );

        const to =
            this.getPreset(
                this.targetWeather
            );

        const t =
            this.smoothStep(
                this.transitionProgress
            );

        this.state.cloudiness =
            lerp(
                from.cloudiness,
                to.cloudiness,
                t
            );

        this.state.rain =
            lerp(
                from.rain,
                to.rain,
                t
            );

        this.state.snow =
            lerp(
                from.snow,
                to.snow,
                t
            );

        this.state.fog =
            lerp(
                from.fog,
                to.fog,
                t
            );

        this.state.wind =
            lerp(
                from.wind,
                to.wind,
                t
            );

        this.state.visibility =
            lerp(
                from.visibility,
                to.visibility,
                t
            );

        this.state.brightness =
            lerp(
                from.brightness,
                to.brightness,
                t
            );

        if (
            this.transitionProgress >=
            1
        ) {

            this.currentWeather =
                this.targetWeather;

            this.state.lightning =
                to.lightning;

            this.emit(
                "weatherChanged",
                {
                    weather:
                        this.currentWeather
                }
            );
        }

        this.updateVisualSystems();

        this.updateGameState();
    }


    // ============================================================
    // SMOOTH STEP
    // ============================================================

    smoothStep(
        value
    ) {

        const t =
            clamp(
                value,
                0,
                1
            );

        return (
            t *
            t *
            (3 - 2 * t)
        );
    }


    // ============================================================
    // RAIN
    // ============================================================

    createRainSystem() {

        const count =
            this.config.rainParticles;

        const positions =
            new Float32Array(
                count * 3
            );

        const velocities =
            new Float32Array(
                count
            );

        const area =
            this.config.precipitationArea;

        const height =
            this.config.precipitationHeight;

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const index =
                i * 3;

            positions[index] =
                randomRange(
                    -area / 2,
                    area / 2
                );

            positions[index + 1] =
                randomRange(
                    0,
                    height
                );

            positions[index + 2] =
                randomRange(
                    -area / 2,
                    area / 2
                );

            velocities[i] =
                randomRange(
                    22,
                    38
                );
        }

        const geometry =
            new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                positions,
                3
            )
        );

        geometry.setAttribute(
            "velocity",
            new THREE.BufferAttribute(
                velocities,
                1
            )
        );

        const material =
            new THREE.PointsMaterial({

                color:
                    0xb8d7ff,

                size:
                    0.16,

                transparent:
                    true,

                opacity:
                    0,

                depthWrite:
                    false,

                blending:
                    THREE.AdditiveBlending
            });

        this.rainSystem =
            new THREE.Points(
                geometry,
                material
            );

        this.rainSystem.name =
            "RAIN_PARTICLES";

        this.precipitationGroup.add(
            this.rainSystem
        );
    }


    // ============================================================
    // SNOW
    // ============================================================

    createSnowSystem() {

        const count =
            this.config.snowParticles;

        const positions =
            new Float32Array(
                count * 3
            );

        const velocities =
            new Float32Array(
                count
            );

        const phases =
            new Float32Array(
                count
            );

        const area =
            this.config.precipitationArea;

        const height =
            this.config.precipitationHeight;

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const index =
                i * 3;

            positions[index] =
                randomRange(
                    -area / 2,
                    area / 2
                );

            positions[index + 1] =
                randomRange(
                    0,
                    height
                );

            positions[index + 2] =
                randomRange(
                    -area / 2,
                    area / 2
                );

            velocities[i] =
                randomRange(
                    1.2,
                    3.5
                );

            phases[i] =
                Math.random() *
                Math.PI *
                2;
        }

        const geometry =
            new THREE.BufferGeometry();

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(
                positions,
                3
            )
        );

        geometry.setAttribute(
            "velocity",
            new THREE.BufferAttribute(
                velocities,
                1
            )
        );

        geometry.setAttribute(
            "phase",
            new THREE.BufferAttribute(
                phases,
                1
            )
        );

        const material =
            new THREE.PointsMaterial({

                color:
                    0xffffff,

                size:
                    0.42,

                transparent:
                    true,

                opacity:
                    0,

                depthWrite:
                    false
            });

        this.snowSystem =
            new THREE.Points(
                geometry,
                material
            );

        this.snowSystem.name =
            "SNOW_PARTICLES";

        this.precipitationGroup.add(
            this.snowSystem
        );
    }


    // ============================================================
    // CLOUDS
    // ============================================================

    createClouds() {

        const cloudMaterial =
            new THREE.MeshStandardMaterial({

                color:
                    0xffffff,

                roughness:
                    1,

                transparent:
                    true,

                opacity:
                    0.15,

                depthWrite:
                    false
            });

        const cloudCount = 18;

        for (
            let i = 0;
            i < cloudCount;
            i++
        ) {

            const group =
                new THREE.Group();

            group.name =
                `CLOUD_${i}`;

            const parts =
                3 +
                Math.floor(
                    Math.random() * 4
                );

            for (
                let j = 0;
                j < parts;
                j++
            ) {

                const mesh =
                    new THREE.Mesh(
                        new THREE.SphereGeometry(
                            randomRange(
                                7,
                                16
                            ),
                            12,
                            8
                        ),
                        cloudMaterial.clone()
                    );

                mesh.position.set(
                    randomRange(
                        -12,
                        12
                    ),
                    randomRange(
                        -2,
                        2
                    ),
                    randomRange(
                        -7,
                        7
                    )
                );

                mesh.scale.y =
                    randomRange(
                        0.35,
                        0.65
                    );

                group.add(
                    mesh
                );
            }

            group.position.set(
                randomRange(
                    -300,
                    300
                ),
                randomRange(
                    90,
                    130
                ),
                randomRange(
                    -300,
                    300
                )
            );

            group.scale.setScalar(
                randomRange(
                    0.7,
                    1.5
                )
            );

            this.cloudGroup.add(
                group
            );

            this.clouds.push(
                group
            );
        }
    }


    // ============================================================
    // LIGHTNING
    // ============================================================

    createLightning() {

        this.lightningLight =
            new THREE.PointLight(
                0xffffff,
                0,
                500
            );

        this.lightningLight.position.set(
            0,
            80,
            0
        );

        this.lightningGroup.add(
            this.lightningLight
        );
    }


    triggerLightning() {

        if (
            !this.config.lightningEnabled
        ) {

            return false;
        }

        if (
            !this.state.lightning
        ) {

            return false;
        }

        this.lightningTimer =
            randomRange(
                2,
                8
            );

        this.lightningDuration =
            randomRange(
                0.08,
                0.22
            );

        this.lightningIntensity =
            randomRange(
                2,
                5
            );

        this.lightningLight.intensity =
            this.lightningIntensity;

        this.emit(
            "lightning",
            {
                intensity:
                    this.lightningIntensity
            }
        );

        return true;
    }


    updateLightning(
        deltaTime
    ) {

        if (
            !this.lightningLight
        ) {

            return;
        }

        if (
            this.lightningDuration > 0
        ) {

            this.lightningDuration -=
                deltaTime;

            if (
                Math.random() <
                0.18
            ) {

                this.lightningLight.intensity =
                    this.lightningIntensity *
                    Math.random();
            }

            if (
                this.lightningDuration <=
                0
            ) {

                this.lightningLight.intensity =
                    0;
            }

            return;
        }

        if (
            !this.state.lightning ||
            this.state.rain <= 0
        ) {

            this.lightningTimer = 0;

            this.lightningLight.intensity =
                0;

            return;
        }

        this.lightningTimer -=
            deltaTime;

        if (
            this.lightningTimer <= 0
        ) {

            this.triggerLightning();
        }
    }


    // ============================================================
    // VISUAL SYSTEMS
    // ============================================================

    updateVisualSystems() {

        // --------------------------------------------------------
        // Rain
        // --------------------------------------------------------

        if (
            this.rainSystem
        ) {

            this.rainSystem.material.opacity =
                clamp(
                    this.state.rain *
                    0.42,
                    0,
                    0.75
                );

            this.rainSystem.visible =
                this.state.rain > 0.01;
        }

        // --------------------------------------------------------
        // Snow
        // --------------------------------------------------------

        if (
            this.snowSystem
        ) {

            this.snowSystem.material.opacity =
                clamp(
                    this.state.snow *
                    0.75,
                    0,
                    0.9
                );

            this.snowSystem.visible =
                this.state.snow > 0.01;
        }

        // --------------------------------------------------------
        // Clouds
        // --------------------------------------------------------

        for (
            const cloud
            of this.clouds
        ) {

            cloud.visible =
                this.state.cloudiness >
                0.02;

            cloud.traverse(
                child => {

                    if (
                        child.material
                    ) {

                        child.material.opacity =
                            clamp(
                                this.state.cloudiness *
                                0.55,
                                0.05,
                                0.75
                            );
                    }
                }
            );
        }

        // --------------------------------------------------------
        // Wind
        // --------------------------------------------------------

        if (
            this.config.windEnabled
        ) {

            this.windOffset.copy(
                this.windDirection
            ).multiplyScalar(
                this.state.wind *
                this.config.windStrength
            );
        }
    }


    // ============================================================
    // UPDATE RAIN
    // ============================================================

    updateRain(
        deltaTime,
        playerPosition
    ) {

        if (
            !this.rainSystem
        ) {

            return;
        }

        const position =
            this.rainSystem.geometry
                .getAttribute(
                    "position"
                );

        const velocity =
            this.rainSystem.geometry
                .getAttribute(
                    "velocity"
                );

        const area =
            this.config.precipitationArea;

        const height =
            this.config.precipitationHeight;

        const windX =
            this.windDirection.x *
            this.state.wind *
            5;

        const windZ =
            this.windDirection.z *
            this.state.wind *
            5;

        for (
            let i = 0;
            i < position.count;
            i++
        ) {

            const index =
                i * 3;

            position.array[index] +=
                windX *
                deltaTime;

            position.array[index + 2] +=
                windZ *
                deltaTime;

            position.array[index + 1] -=
                velocity.array[i] *
                deltaTime;

            if (
                position.array[index + 1] <
                0
            ) {

                position.array[index + 1] =
                    height;

                position.array[index] =
                    randomRange(
                        -area / 2,
                        area / 2
                    );

                position.array[index + 2] =
                    randomRange(
                        -area / 2,
                        area / 2
                    );
            }
        }

        position.needsUpdate =
            true;

        if (playerPosition) {

            this.rainSystem.position.x =
                playerPosition.x;

            this.rainSystem.position.z =
                playerPosition.z;
        }
    }


    // ============================================================
    // UPDATE SNOW
    // ============================================================

    updateSnow(
        deltaTime,
        playerPosition
    ) {

        if (
            !this.snowSystem
        ) {

            return;
        }

        const position =
            this.snowSystem.geometry
                .getAttribute(
                    "position"
                );

        const velocity =
            this.snowSystem.geometry
                .getAttribute(
                    "velocity"
                );

        const phase =
            this.snowSystem.geometry
                .getAttribute(
                    "phase"
                );

        const area =
            this.config.precipitationArea;

        const height =
            this.config.precipitationHeight;

        for (
            let i = 0;
            i < position.count;
            i++
        ) {

            const index =
                i * 3;

            position.array[index] +=
                Math.sin(
                    this.elapsedTime +
                    phase.array[i]
                ) *
                deltaTime *
                0.7;

            position.array[index + 2] +=
                Math.cos(
                    this.elapsedTime *
                    0.7 +
                    phase.array[i]
                ) *
                deltaTime *
                0.7;

            position.array[index] -=
                this.windDirection.x *
                this.state.wind *
                deltaTime *
                2;

            position.array[index + 2] -=
                this.windDirection.z *
                this.state.wind *
                deltaTime *
                2;

            position.array[index + 1] -=
                velocity.array[i] *
                deltaTime;

            if (
                position.array[index + 1] <
                0
            ) {

                position.array[index + 1] =
                    height;

                position.array[index] =
                    randomRange(
                        -area / 2,
                        area / 2
                    );

                position.array[index + 2] =
                    randomRange(
                        -area / 2,
                        area / 2
                    );
            }
        }

        position.needsUpdate =
            true;

        if (playerPosition) {

            this.snowSystem.position.x =
                playerPosition.x;

            this.snowSystem.position.z =
                playerPosition.z;
        }
    }


    // ============================================================
    // UPDATE CLOUDS
    // ============================================================

    updateClouds(
        deltaTime,
        playerPosition
    ) {

        if (
            !this.config.windEnabled
        ) {

            return;
        }

        const speed =
            this.state.wind *
            4;

        for (
            const cloud
            of this.clouds
        ) {

            cloud.position.x +=
                speed *
                deltaTime;

            cloud.position.z +=
                speed *
                0.15 *
                deltaTime;

            if (
                cloud.position.x >
                350
            ) {

                cloud.position.x =
                    -350;
            }
        }

        if (playerPosition) {

            const targetX =
                playerPosition.x;

            const targetZ =
                playerPosition.z;

            for (
                const cloud
                of this.clouds
            ) {

                if (
                    Math.abs(
                        cloud.position.x -
                        targetX
                    ) > 450
                ) {

                    cloud.position.x =
                        targetX +
                        randomRange(
                            -300,
                            300
                        );
                }

                if (
                    Math.abs(
                        cloud.position.z -
                        targetZ
                    ) > 450
                ) {

                    cloud.position.z =
                        targetZ +
                        randomRange(
                            -300,
                            300
                        );
                }
            }
        }
    }


    // ============================================================
    // WEATHER PHYSICS / WIND
    // ============================================================

    getWindVector() {

        return this.windDirection
            .clone()
            .multiplyScalar(
                this.state.wind *
                this.config.windStrength
            );
    }


    setWindDirection(
        x,
        z
    ) {

        const vector =
            new THREE.Vector3(
                numberOrDefault(x, 1),
                0,
                numberOrDefault(z, 0)
            );

        if (
            vector.lengthSq() <
            0.0001
        ) {

            return false;
        }

        this.windDirection
            .copy(vector)
            .normalize();

        return true;
    }


    // ============================================================
    // GET WEATHER
    // ============================================================

    getWeather() {

        return this.currentWeather;
    }


    getTargetWeather() {

        return this.targetWeather;
    }


    getWeatherState() {

        return {
            ...this.state
        };
    }


    getPresetNames() {

        return Object.keys(
            WEATHER_PRESETS
        );
    }


    // ============================================================
    // GAME STATE
    // ============================================================

    updateGameState() {

        gameState.set(
            "world.weather.type",
            this.currentWeather
        );

        gameState.set(
            "world.weather.target",
            this.targetWeather
        );

        gameState.set(
            "world.weather.rain",
            this.state.rain
        );

        gameState.set(
            "world.weather.snow",
            this.state.snow
        );

        gameState.set(
            "world.weather.wind",
            this.state.wind
        );

        gameState.set(
            "world.weather.fog",
            this.state.fog
        );

        gameState.set(
            "world.weather.visibility",
            this.state.visibility
        );
    }


    // ============================================================
    // MAIN UPDATE
    // ============================================================

    update(
        deltaTime = 0,
        playerPosition = null
    ) {

        if (
            !this.initialized ||
            this.disposed
        ) {

            return;
        }

        const delta =
            clamp(
                numberOrDefault(
                    deltaTime,
                    0
                ),
                0,
                0.1
            );

        this.elapsedTime +=
            delta;

        this.updateAccumulator +=
            delta;

        // --------------------------------------------------------
        // Transition
        // --------------------------------------------------------

        this.updateTransition(
            delta
        );

        // --------------------------------------------------------
        // Rain
        // --------------------------------------------------------

        this.updateRain(
            delta,
            playerPosition
        );

        // --------------------------------------------------------
        // Snow
        // --------------------------------------------------------

        this.updateSnow(
            delta,
            playerPosition
        );

        // --------------------------------------------------------
        // Clouds
        // --------------------------------------------------------

        this.updateClouds(
            delta,
            playerPosition
        );

        // --------------------------------------------------------
        // Lightning
        // --------------------------------------------------------

        this.updateLightning(
            delta
        );

        // --------------------------------------------------------
        // Update state at controlled rate
        // --------------------------------------------------------

        const interval =
            1 /
            Math.max(
                1,
                this.config.updateRate
            );

        if (
            this.updateAccumulator >=
            interval
        ) {

            this.updateAccumulator = 0;

            this.emit(
                "updated",
                this.getWeatherState()
            );
        }
    }


    // ============================================================
    // EVENTS
    // ============================================================

    on(
        event,
        callback
    ) {

        if (
            typeof callback !==
            "function"
        ) {

            return () => {};
        }

        if (
            !this.listeners.has(event)
        ) {

            this.listeners.set(
                event,
                new Set()
            );
        }

        const listeners =
            this.listeners.get(
                event
            );

        listeners.add(
            callback
        );

        return () => {

            listeners.delete(
                callback
            );
        };
    }


    off(
        event,
        callback
    ) {

        const listeners =
            this.listeners.get(
                event
            );

        if (!listeners) {

            return false;
        }

        return listeners.delete(
            callback
        );
    }


    emit(
        event,
        data
    ) {

        const listeners =
            this.listeners.get(
                event
            );

        if (!listeners) {

            return;
        }

        for (
            const callback
            of listeners
        ) {

            try {

                callback(data);

            } catch (error) {

                console.warn(
                    `[AZAD WORLD] Weather event "${event}" error:`,
                    error
                );
            }
        }
    }


    // ============================================================
    // SNAPSHOT
    // ============================================================

    getSnapshot() {

        return {

            initialized:
                this.initialized,

            current:
                this.currentWeather,

            target:
                this.targetWeather,

            transition:
                this.transitionProgress,

            state:
                {
                    ...this.state
                },

            windDirection:
                {
                    x:
                        this.windDirection.x,

                    y:
                        this.windDirection.y,

                    z:
                        this.windDirection.z
                },

            clouds:
                this.clouds.length
        };
    }


    // ============================================================
    // DEBUG
    // ============================================================

    debug() {

        return {

            snapshot:
                this.getSnapshot(),

            presets:
                WEATHER_PRESETS,

            root:
                this.root,

            rain:
                this.rainSystem,

            snow:
                this.snowSystem,

            clouds:
                this.clouds,

            lightning:
                this.lightningLight
        };
    }


    // ============================================================
    // DISPOSAL
    // ============================================================

    disposeObject(
        object
    ) {

        if (!object) {

            return;
        }

        object.traverse(
            child => {

                if (
                    child.geometry &&
                    typeof child.geometry.dispose ===
                    "function"
                ) {

                    child.geometry.dispose();
                }

                if (
                    child.material
                ) {

                    const materials =
                        Array.isArray(
                            child.material
                        )
                            ? child.material
                            : [child.material];

                    for (
                        const material
                        of materials
                    ) {

                        if (
                            material.map
                        ) {

                            material.map.dispose();
                        }

                        material.dispose();
                    }
                }
            }
        );
    }


    destroy() {

        if (
            this.disposed
        ) {

            return;
        }

        this.disposeObject(
            this.root
        );

        if (
            this.root.parent
        ) {

            this.root.parent.remove(
                this.root
            );
        }

        this.root.clear();

        this.clouds.length = 0;

        this.rainSystem = null;

        this.snowSystem = null;

        this.lightningLight = null;

        this.listeners.clear();

        gameState.set(
            "world.weather.active",
            false
        );

        this.initialized = false;

        this.disposed = true;
    }
}


// ============================================================
// NUMBER HELPER
// ============================================================

function numberOrDefault(
    value,
    fallback
) {

    const result =
        Number(value);

    return Number.isFinite(result)
        ? result
        : fallback;
}


// ============================================================
// SINGLETON
// ============================================================

export const weatherSystem =
    new WeatherSystem();


// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function initializeWeather(
    scene
) {

    return weatherSystem.initialize(
        scene
    );
}


export function setWeather(
    weather,
    duration
) {

    return weatherSystem.setWeather(
        weather,
        duration
    );
}


export function setWeatherImmediately(
    weather
) {

    return weatherSystem.setWeatherImmediately(
        weather
    );
}


export function getWeather() {

    return weatherSystem.getWeather();
}


export function getWeatherState() {

    return weatherSystem.getWeatherState();
}


export function updateWeather(
    deltaTime,
    playerPosition
) {

    return weatherSystem.update(
        deltaTime,
        playerPosition
    );
}


export function triggerLightning() {

    return weatherSystem.triggerLightning();
}


export function getWindVector() {

    return weatherSystem.getWindVector();
}


export function getWeatherSnapshot() {

    return weatherSystem.getSnapshot();
}


export default weatherSystem;
