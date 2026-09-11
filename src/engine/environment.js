import * as THREE from "three";

/**
 * AZAD WORLD
 * Environment System
 *
 * Handles:
 * - Sky
 * - Fog
 * - Sun
 * - Hemisphere lighting
 * - Ambient lighting
 * - Environment settings
 * - Day/night lighting foundation
 */

export class EnvironmentSystem {
    constructor(scene, options = {}) {
        this.scene = scene;

        this.quality =
            options.quality || "high";

        this.sky = null;
        this.sun = null;
        this.hemiLight = null;
        this.ambientLight = null;
        this.fog = null;

        this.timeOfDay =
            options.timeOfDay ?? 12;

        this.createEnvironment();
    }

    createEnvironment() {
        this.createSky();
        this.createFog();
        this.createLights();
    }

    createSky() {
        const geometry =
            new THREE.SphereGeometry(
                900,
                64,
                32
            );

        const material =
            new THREE.MeshBasicMaterial({
                color: 0x79a9d6,
                side: THREE.BackSide,
                depthWrite: false
            });

        this.sky =
            new THREE.Mesh(
                geometry,
                material
            );

        this.sky.name =
            "AZAD_WORLD_SKY";

        this.scene.add(this.sky);
    }

    createFog() {
        this.fog =
            new THREE.FogExp2(
                0x91b5d1,
                this.getFogDensity()
            );

        this.scene.fog =
            this.fog;
    }

    getFogDensity() {
        switch (this.quality) {
            case "low":
                return 0.0018;

            case "medium":
                return 0.0012;

            case "ultra":
                return 0.00055;

            case "high":
            default:
                return 0.0008;
        }
    }

    createLights() {
        this.createSun();
        this.createHemisphereLight();
        this.createAmbientLight();
    }

    createSun() {
        this.sun =
            new THREE.DirectionalLight(
                0xffffff,
                3.5
            );

        this.sun.name =
            "AZAD_WORLD_SUN";

        this.sun.position.set(
            120,
            180,
            80
        );

        this.sun.castShadow = true;

        this.sun.shadow.mapSize.width =
            this.getShadowMapSize();

        this.sun.shadow.mapSize.height =
            this.getShadowMapSize();

        this.sun.shadow.camera.near =
            0.5;

        this.sun.shadow.camera.far =
            600;

        this.sun.shadow.camera.left =
            -180;

        this.sun.shadow.camera.right =
            180;

        this.sun.shadow.camera.top =
            180;

        this.sun.shadow.camera.bottom =
            -180;

        this.sun.shadow.bias =
            -0.00015;

        this.sun.shadow.normalBias =
            0.025;

        this.scene.add(this.sun);

        this.scene.add(
            this.sun.target
        );
    }

    getShadowMapSize() {
        switch (this.quality) {
            case "low":
                return 512;

            case "medium":
                return 1024;

            case "ultra":
                return 4096;

            case "high":
            default:
                return 2048;
        }
    }

    createHemisphereLight() {
        this.hemiLight =
            new THREE.HemisphereLight(
                0xb8d8ff,
                0x4b463c,
                1.8
            );

        this.hemiLight.name =
            "AZAD_WORLD_HEMISPHERE";

        this.scene.add(
            this.hemiLight
        );
    }

    createAmbientLight() {
        this.ambientLight =
            new THREE.AmbientLight(
                0xffffff,
                0.25
            );

        this.ambientLight.name =
            "AZAD_WORLD_AMBIENT";

        this.scene.add(
            this.ambientLight
        );
    }

    /**
     * Update the environment
     * according to time of day.
     *
     * 0 - 24 hours
     */
    setTimeOfDay(hours) {
        this.timeOfDay =
            ((Number(hours) % 24) + 24) % 24;

        const angle =
            (this.timeOfDay / 24) *
            Math.PI * 2;

        const sunHeight =
            Math.sin(angle);

        const sunHorizontal =
            Math.cos(angle);

        this.sun.position.set(
            sunHorizontal * 180,
            Math.max(
                -20,
                sunHeight * 220
            ),
            80
        );

        this.updateLighting();
        this.updateSky();
    }

    updateLighting() {
        const hour =
            this.timeOfDay;

        let sunIntensity;
        let hemiIntensity;
        let ambientIntensity;

        if (
            hour >= 6 &&
            hour < 18
        ) {
            sunIntensity = 3.5;
            hemiIntensity = 1.8;
            ambientIntensity = 0.25;
        } else if (
            hour >= 18 &&
            hour < 20
        ) {
            sunIntensity = 1.8;
            hemiIntensity = 1.0;
            ambientIntensity = 0.18;
        } else if (
            hour >= 4 &&
            hour < 6
        ) {
            sunIntensity = 1.4;
            hemiIntensity = 0.9;
            ambientIntensity = 0.15;
        } else {
            sunIntensity = 0.35;
            hemiIntensity = 0.45;
            ambientIntensity = 0.12;
        }

        this.sun.intensity =
            sunIntensity;

        this.hemiLight.intensity =
            hemiIntensity;

        this.ambientLight.intensity =
            ambientIntensity;

        this.updateSunColor();
    }

    updateSunColor() {
        const hour =
            this.timeOfDay;

        if (
            hour >= 5 &&
            hour < 7
        ) {
            this.sun.color.setHex(
                0xffb36b
            );
        } else if (
            hour >= 17 &&
            hour < 20
        ) {
            this.sun.color.setHex(
                0xffa45c
            );
        } else if (
            hour >= 20 ||
            hour < 5
        ) {
            this.sun.color.setHex(
                0x9bb7ff
            );
        } else {
            this.sun.color.setHex(
                0xffffff
            );
        }
    }

    updateSky() {
        if (!this.sky) return;

        const hour =
            this.timeOfDay;

        if (
            hour >= 6 &&
            hour < 18
        ) {
            this.sky.material.color.setHex(
                0x79a9d6
            );
        } else if (
            hour >= 17 &&
            hour < 20
        ) {
            this.sky.material.color.setHex(
                0xd77c58
            );
        } else {
            this.sky.material.color.setHex(
                0x101b35
            );
        }

        this.sky.material.needsUpdate =
            true;

        this.updateFogColor();
    }

    updateFogColor() {
        if (!this.fog) return;

        const hour =
            this.timeOfDay;

        if (
            hour >= 6 &&
            hour < 17
        ) {
            this.fog.color.setHex(
                0x91b5d1
            );
        } else if (
            hour >= 17 &&
            hour < 20
        ) {
            this.fog.color.setHex(
                0xc17c69
            );
        } else {
            this.fog.color.setHex(
                0x18243e
            );
        }
    }

    setQuality(quality) {
        this.quality =
            quality || "high";

        if (this.fog) {
            this.fog.density =
                this.getFogDensity();
        }

        if (this.sun) {
            const size =
                this.getShadowMapSize();

            this.sun.shadow.mapSize.set(
                size,
                size
            );

            this.sun.shadow.map?.dispose();

            this.sun.shadow.map = null;
        }

        return this;
    }

    setSunPosition(
        x,
        y,
        z
    ) {
        if (!this.sun) return;

        this.sun.position.set(
            x,
            y,
            z
        );
    }

    setFog(
        color,
        density
    ) {
        if (!this.fog) return;

        if (color !== undefined) {
            this.fog.color.set(
                color
            );
        }

        if (
            density !== undefined
        ) {
            this.fog.density =
                Math.max(
                    0,
                    Number(density)
                );
        }
    }

    setSunIntensity(
        intensity
    ) {
        if (!this.sun) return;

        this.sun.intensity =
            Math.max(
                0,
                Number(intensity)
            );
    }

    getState() {
        return {
            quality:
                this.quality,

            timeOfDay:
                this.timeOfDay,

            sunIntensity:
                this.sun?.intensity ?? 0,

            hemisphereIntensity:
                this.hemiLight?.intensity ?? 0,

            ambientIntensity:
                this.ambientLight?.intensity ?? 0,

            fogDensity:
                this.fog?.density ?? 0
        };
    }

    dispose() {
        if (this.sky) {
            this.sky.geometry.dispose();
            this.sky.material.dispose();

            this.scene.remove(
                this.sky
            );
        }

        if (this.sun) {
            this.scene.remove(
                this.sun
            );

            this.scene.remove(
                this.sun.target
            );

            this.sun.dispose?.();
        }

        if (this.hemiLight) {
            this.scene.remove(
                this.hemiLight
            );
        }

        if (this.ambientLight) {
            this.scene.remove(
                this.ambientLight
            );
        }

        this.scene.fog = null;

        this.sky = null;
        this.sun = null;
        this.hemiLight = null;
        this.ambientLight = null;
        this.fog = null;
    }
}

export default EnvironmentSystem;
