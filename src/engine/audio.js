import * as THREE from "three";

/**
 * AZAD WORLD
 * Advanced Audio System
 *
 * Handles:
 * - Music
 * - Sound effects
 * - 3D positional audio
 * - Volume controls
 * - Audio pools
 * - Fade in / fade out
 * - Mute
 * - Mobile/browser audio unlock
 */

export class AudioManager {
    constructor(camera, options = {}) {
        this.camera = camera;

        this.basePath =
            options.basePath || "./assets/audio/";

        this.musicVolume =
            options.musicVolume ?? 0.7;

        this.sfxVolume =
            options.sfxVolume ?? 1.0;

        this.masterVolume =
            options.masterVolume ?? 1.0;

        this.muted = false;

        this.listener =
            new THREE.AudioListener();

        if (this.camera) {
            this.camera.add(
                this.listener
            );
        }

        this.loader =
            new THREE.AudioLoader();

        this.sounds = new Map();
        this.music = new Map();
        this.positionalSounds = new Map();

        this.currentMusic = null;
        this.currentMusicName = null;

        this.unlocked = false;

        this.pendingUnlock = false;

        this.setupBrowserUnlock();
    }

    resolve(path) {
        if (!path) return "";

        if (
            path.startsWith("http://") ||
            path.startsWith("https://") ||
            path.startsWith("/")
        ) {
            return path;
        }

        return `${this.basePath}${path}`;
    }

    setupBrowserUnlock() {
        const unlock = () => {
            this.unlock();

            window.removeEventListener(
                "pointerdown",
                unlock
            );

            window.removeEventListener(
                "keydown",
                unlock
            );

            window.removeEventListener(
                "touchstart",
                unlock
            );
        };

        window.addEventListener(
            "pointerdown",
            unlock,
            { once: true }
        );

        window.addEventListener(
            "keydown",
            unlock,
            { once: true }
        );

        window.addEventListener(
            "touchstart",
            unlock,
            { once: true }
        );
    }

    unlock() {
        if (this.unlocked) return;

        try {
            const context =
                this.listener.context;

            if (
                context &&
                context.state === "suspended"
            ) {
                context.resume();
            }

            this.unlocked = true;
        } catch (error) {
            console.warn(
                "Audio unlock failed:",
                error
            );
        }
    }

    loadSound(name, path, options = {}) {
        if (this.sounds.has(name)) {
            return Promise.resolve(
                this.sounds.get(name)
            );
        }

        return new Promise(
            (resolve, reject) => {
                this.loader.load(
                    this.resolve(path),

                    (buffer) => {
                        const sound =
                            new THREE.Audio(
                                this.listener
                            );

                        sound.setBuffer(
                            buffer
                        );

                        sound.setLoop(
                            options.loop ?? false
                        );

                        sound.setVolume(
                            this.calculateVolume(
                                options.volume ??
                                1,
                                "sfx"
                            )
                        );

                        this.sounds.set(
                            name,
                            sound
                        );

                        resolve(sound);
                    },

                    undefined,

                    (error) => {
                        console.error(
                            `Failed to load sound: ${name}`,
                            error
                        );

                        reject(error);
                    }
                );
            }
        );
    }

    loadMusic(name, path, options = {}) {
        if (this.music.has(name)) {
            return Promise.resolve(
                this.music.get(name)
            );
        }

        return new Promise(
            (resolve, reject) => {
                this.loader.load(
                    this.resolve(path),

                    (buffer) => {
                        const music =
                            new THREE.Audio(
                                this.listener
                            );

                        music.setBuffer(
                            buffer
                        );

                        music.setLoop(
                            options.loop ?? true
                        );

                        music.setVolume(
                            this.calculateVolume(
                                options.volume ??
                                1,
                                "music"
                            )
                        );

                        this.music.set(
                            name,
                            music
                        );

                        resolve(music);
                    },

                    undefined,

                    (error) => {
                        console.error(
                            `Failed to load music: ${name}`,
                            error
                        );

                        reject(error);
                    }
                );
            }
        );
    }

    createPositionalSound(
        name,
        object,
        path,
        options = {}
    ) {
        if (!object) {
            throw new Error(
                "Positional sound requires a THREE.Object3D."
            );
        }

        const sound =
            new THREE.PositionalAudio(
                this.listener
            );

        const url =
            this.resolve(path);

        this.loader.load(
            url,

            (buffer) => {
                sound.setBuffer(
                    buffer
                );

                sound.setRefDistance(
                    options.refDistance ??
                    10
                );

                sound.setRolloffFactor(
                    options.rolloffFactor ??
                    1
                );

                sound.setDistanceModel(
                    options.distanceModel ??
                    "inverse"
                );

                sound.setLoop(
                    options.loop ?? false
                );

                sound.setVolume(
                    this.calculateVolume(
                        options.volume ??
                        1,
                        "sfx"
                    )
                );

                object.add(sound);

                this.positionalSounds.set(
                    name,
                    sound
                );
            },

            undefined,

            (error) => {
                console.error(
                    `Failed to load positional sound: ${name}`,
                    error
                );
            }
        );

        return sound;
    }

    playSound(
        name,
        options = {}
    ) {
        const sound =
            this.sounds.get(name);

        if (!sound) {
            console.warn(
                `Sound "${name}" is not loaded.`
            );

            return null;
        }

        this.unlock();

        if (sound.isPlaying) {
            sound.stop();
        }

        sound.setLoop(
            options.loop ??
            sound.getLoop()
        );

        sound.setVolume(
            this.calculateVolume(
                options.volume ?? 1,
                "sfx"
            )
        );

        sound.offset =
            options.offset ?? 0;

        sound.play();

        return sound;
    }

    stopSound(name) {
        const sound =
            this.sounds.get(name);

        if (!sound) return;

        if (sound.isPlaying) {
            sound.stop();
        }
    }

    pauseSound(name) {
        const sound =
            this.sounds.get(name);

        if (!sound) return;

        if (sound.isPlaying) {
            sound.pause();
        }
    }

    resumeSound(name) {
        const sound =
            this.sounds.get(name);

        if (!sound) return;

        this.unlock();

        if (!sound.isPlaying) {
            sound.play();
        }
    }

    async playMusic(
        name,
        options = {}
    ) {
        let music =
            this.music.get(name);

        if (!music) {
            console.warn(
                `Music "${name}" is not loaded.`
            );

            return null;
        }

        this.unlock();

        const fadeDuration =
            options.fadeDuration ??
            600;

        if (
            this.currentMusic &&
            this.currentMusic !== music
        ) {
            await this.fadeOut(
                this.currentMusic,
                fadeDuration
            );
        }

        if (music.isPlaying) {
            return music;
        }

        const volume =
            options.volume ??
            1;

        music.setVolume(0);

        music.play();

        this.currentMusic =
            music;

        this.currentMusicName =
            name;

        await this.fadeIn(
            music,
            volume,
            fadeDuration
        );

        return music;
    }

    stopMusic(
        fadeDuration = 500
    ) {
        if (!this.currentMusic) {
            return;
        }

        const music =
            this.currentMusic;

        this.fadeOut(
            music,
            fadeDuration
        ).then(() => {
            if (music.isPlaying) {
                music.stop();
            }

            if (
                this.currentMusic === music
            ) {
                this.currentMusic = null;
                this.currentMusicName = null;
            }
        });
    }

    pauseMusic() {
        if (
            this.currentMusic &&
            this.currentMusic.isPlaying
        ) {
            this.currentMusic.pause();
        }
    }

    resumeMusic() {
        if (!this.currentMusic) {
            return;
        }

        this.unlock();

        if (
            !this.currentMusic.isPlaying
        ) {
            this.currentMusic.play();
        }
    }

    async fadeIn(
        audio,
        targetVolume = 1,
        duration = 500
    ) {
        if (!audio) return;

        const start =
            performance.now();

        const startVolume =
            audio.getVolume();

        return new Promise(
            (resolve) => {
                const animate = (time) => {
                    const progress =
                        Math.min(
                            (time - start) /
                            duration,
                            1
                        );

                    const eased =
                        progress *
                        progress *
                        (3 -
                            2 *
                            progress);

                    const volume =
                        THREE.MathUtils.lerp(
                            startVolume,
                            this.calculateVolume(
                                targetVolume,
                                "music"
                            ),
                            eased
                        );

                    audio.setVolume(
                        volume
                    );

                    if (
                        progress < 1
                    ) {
                        requestAnimationFrame(
                            animate
                        );
                    } else {
                        resolve();
                    }
                };

                requestAnimationFrame(
                    animate
                );
            }
        );
    }

    async fadeOut(
        audio,
        duration = 500
    ) {
        if (!audio) return;

        const start =
            performance.now();

        const startVolume =
            audio.getVolume();

        return new Promise(
            (resolve) => {
                const animate = (time) => {
                    const progress =
                        Math.min(
                            (time - start) /
                            duration,
                            1
                        );

                    const volume =
                        THREE.MathUtils.lerp(
                            startVolume,
                            0,
                            progress
                        );

                    audio.setVolume(
                        volume
                    );

                    if (
                        progress < 1
                    ) {
                        requestAnimationFrame(
                            animate
                        );
                    } else {
                        resolve();
                    }
                };

                requestAnimationFrame(
                    animate
                );
            }
        );
    }

    calculateVolume(
        volume,
        type
    ) {
        if (this.muted) {
            return 0;
        }

        const safeVolume =
            THREE.MathUtils.clamp(
                Number(volume) || 0,
                0,
                1
            );

        const category =
            type === "music"
                ? this.musicVolume
                : this.sfxVolume;

        return (
            safeVolume *
            category *
            this.masterVolume
        );
    }

    setMasterVolume(volume) {
        this.masterVolume =
            THREE.MathUtils.clamp(
                Number(volume) || 0,
                0,
                1
            );

        this.refreshVolumes();
    }

    setMusicVolume(volume) {
        this.musicVolume =
            THREE.MathUtils.clamp(
                Number(volume) || 0,
                0,
                1
            );

        this.refreshVolumes();
    }

    setSFXVolume(volume) {
        this.sfxVolume =
            THREE.MathUtils.clamp(
                Number(volume) || 0,
                0,
                1
            );

        this.refreshVolumes();
    }

    refreshVolumes() {
        for (
            const sound of this.sounds.values()
        ) {
            if (!sound.isPlaying) continue;

            const current =
                sound.userData?.baseVolume ??
                1;

            sound.setVolume(
                this.calculateVolume(
                    current,
                    "sfx"
                )
            );
        }

        for (
            const music of this.music.values()
        ) {
            if (!music.isPlaying) continue;

            const current =
                music.userData?.baseVolume ??
                1;

            music.setVolume(
                this.calculateVolume(
                    current,
                    "music"
                )
            );
        }

        for (
            const sound of this.positionalSounds.values()
        ) {
            const current =
                sound.userData?.baseVolume ??
                1;

            sound.setVolume(
                this.calculateVolume(
                    current,
                    "sfx"
                )
            );
        }
    }

    setMuted(value) {
        this.muted = Boolean(value);

        this.refreshVolumes();

        if (this.muted) {
            if (
                this.currentMusic &&
                this.currentMusic.isPlaying
            ) {
                this.currentMusic.setVolume(
                    0
                );
            }
        }
    }

    toggleMute() {
        this.setMuted(
            !this.muted
        );

        return this.muted;
    }

    isMusicPlaying() {
        return Boolean(
            this.currentMusic &&
            this.currentMusic.isPlaying
        );
    }

    getCurrentMusic() {
        return {
            name:
                this.currentMusicName,

            playing:
                this.isMusicPlaying()
        };
    }

    removeSound(name) {
        const sound =
            this.sounds.get(name);

        if (!sound) return false;

        if (sound.isPlaying) {
            sound.stop();
        }

        if (sound.buffer) {
            sound.disconnect();
        }

        this.sounds.delete(name);

        return true;
    }

    removeMusic(name) {
        const music =
            this.music.get(name);

        if (!music) return false;

        if (music.isPlaying) {
            music.stop();
        }

        music.disconnect();

        this.music.delete(name);

        if (
            this.currentMusic === music
        ) {
            this.currentMusic = null;
            this.currentMusicName = null;
        }

        return true;
    }

    stopAll() {
        for (
            const sound of this.sounds.values()
        ) {
            if (sound.isPlaying) {
                sound.stop();
            }
        }

        for (
            const music of this.music.values()
        ) {
            if (music.isPlaying) {
                music.stop();
            }
        }

        for (
            const sound of this.positionalSounds.values()
        ) {
            if (sound.isPlaying) {
                sound.stop();
            }
        }

        this.currentMusic = null;
        this.currentMusicName = null;
    }

    dispose() {
        this.stopAll();

        for (
            const sound of this.sounds.values()
        ) {
            sound.disconnect();
        }

        for (
            const music of this.music.values()
        ) {
            music.disconnect();
        }

        for (
            const sound of this.positionalSounds.values()
        ) {
            sound.disconnect();
        }

        this.sounds.clear();
        this.music.clear();
        this.positionalSounds.clear();

        if (this.camera) {
            this.camera.remove(
                this.listener
            );
        }
    }
}

export default AudioManager;
