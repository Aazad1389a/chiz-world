// ============================================================
// AZAD WORLD - GAME GOALS & FEATURE CONFIGURATION
// Central configuration for all major game systems.
//
// IMPORTANT:
// This file describes what the game supports.
// It does NOT implement the systems themselves.
//
// Other modules can read these settings so that future changes
// can be made here without redesigning the entire project.
// ============================================================

export const GAME_GOALS_VERSION = "1.0.0";

export const GAME_GOALS = {
  // ----------------------------------------------------------
  // GLOBAL GAME SETTINGS
  // ----------------------------------------------------------

  game: {
    id: "azad-world",
    name: "AZAD WORLD",
    version: "1.0.0",

    online: true,
    multiplayer: true,
    singlePlayer: true,

    openWorld: true,
    persistentWorld: true,

    pc: true,
    android: true,
    mobileBrowser: true,
    desktopBrowser: true
  },

  // ----------------------------------------------------------
  // 1. MAIN STORY
  // ----------------------------------------------------------

  story: {
    enabled: true,
    priority: 10,

    mainStory: true,
    chapters: true,
    missions: true,

    storyBranches: true,
    playerChoices: true,
    multipleEndings: true,

    cinematicEvents: true,
    dialogueSystem: true,
    characterRelationships: true,

    sideStories: true,
    hiddenStories: true,

    chapterProgression: true,
    storyRewards: true
  },

  // ----------------------------------------------------------
  // 2. EXPLORATION
  // ----------------------------------------------------------

  exploration: {
    enabled: true,
    priority: 9,

    openWorld: true,

    cities: true,
    villages: true,
    countryside: true,
    mountains: true,
    forests: true,
    deserts: true,
    beaches: true,
    undergroundAreas: true,

    hiddenLocations: true,
    secretAreas: true,
    landmarks: true,

    collectibles: true,
    worldSecrets: true,

    discoveryRewards: true,
    explorationXP: true,

    fastTravel: true
  },

  // ----------------------------------------------------------
  // 3. MISSIONS
  // ----------------------------------------------------------

  missions: {
    enabled: true,
    priority: 10,

    mainMissions: true,
    sideMissions: true,

    dailyMissions: true,
    weeklyMissions: true,

    dynamicMissions: true,
    randomMissions: true,

    escortMissions: true,
    deliveryMissions: true,
    investigationMissions: true,
    survivalMissions: true,
    explorationMissions: true,

    cooperativeMissions: true,
    multiplayerMissions: true,

    missionRewards: true,
    missionXP: true,
    missionDifficulty: true
  },

  // ----------------------------------------------------------
  // 4. COMBAT
  // ----------------------------------------------------------

  combat: {
    enabled: true,
    priority: 10,

    meleeCombat: true,
    rangedCombat: true,

    weapons: true,
    weaponUpgrades: true,

    abilities: true,
    skills: true,

    enemies: true,
    eliteEnemies: true,
    bosses: true,

    bossBattles: true,

    damageSystem: true,
    healthSystem: true,
    staminaSystem: true,

    criticalHits: true,
    statusEffects: true,

    combatRewards: true,
    combatXP: true
  },

  // ----------------------------------------------------------
  // 5. PLAYER PROGRESSION
  // ----------------------------------------------------------

  progression: {
    enabled: true,
    priority: 9,

    playerLevels: true,
    experience: true,

    skillTree: true,
    abilities: true,

    unlockableSkills: true,
    passiveSkills: true,
    activeSkills: true,

    progressionRewards: true,

    prestige: false,

    difficultyScaling: true
  },

  // ----------------------------------------------------------
  // 6. ECONOMY
  // ----------------------------------------------------------

  economy: {
    enabled: true,
    priority: 8,

    coins: true,
    currencies: true,

    shops: true,
    buying: true,
    selling: true,

    trading: true,
    playerTrading: true,

    rewards: true,
    missionRewards: true,
    eventRewards: true,

    economyProgression: true,

    dynamicPrices: true,

    marketplace: true
  },

  // ----------------------------------------------------------
  // 7. INVENTORY
  // ----------------------------------------------------------

  inventory: {
    enabled: true,
    priority: 9,

    inventory: true,
    itemStacks: true,

    equipment: true,
    weapons: true,
    armor: true,

    consumables: true,
    materials: true,
    questItems: true,

    itemRarity: true,

    itemStats: true,
    itemUpgrades: true,

    itemStorage: true,

    quickSlots: true
  },

  // ----------------------------------------------------------
  // 8. CRAFTING
  // ----------------------------------------------------------

  crafting: {
    enabled: true,
    priority: 7,

    crafting: true,

    weapons: true,
    armor: true,
    consumables: true,
    resources: true,

    craftingRecipes: true,
    recipeUnlocks: true,

    craftingUpgrades: true,

    rareMaterials: true
  },

  // ----------------------------------------------------------
  // 9. HOUSING / BASE
  // ----------------------------------------------------------

  housing: {
    enabled: true,
    priority: 7,

    playerHousing: true,
    apartments: true,
    houses: true,

    baseBuilding: true,

    furniture: true,
    decoration: true,
    customization: true,

    storage: true,

    upgrades: true,

    propertyProgression: true,

    multiplayerHousing: false,

    housingRewards: true
  },

  // ----------------------------------------------------------
  // 10. VEHICLES
  // ----------------------------------------------------------

  vehicles: {
    enabled: true,
    priority: 7,

    cars: true,
    motorcycles: true,

    boats: true,

    vehicleCustomization: true,
    vehicleUpgrades: true,

    vehicleStorage: true,

    vehicleOwnership: true,

    vehicleGarage: true,

    fastTravelVehicles: true
  },

  // ----------------------------------------------------------
  // 11. MULTIPLAYER
  // ----------------------------------------------------------

  multiplayer: {
    enabled: true,
    priority: 10,

    onlineWorld: true,

    multiplayerRooms: true,
    lobbies: true,

    matchmaking: true,

    cooperativePlay: true,

    playerPresence: true,
    playerStateSync: true,

    realtimeEvents: true,

    playerActions: true,

    sharedWorldEvents: true,

    multiplayerMissions: true,

    multiplayerRewards: true
  },

  // ----------------------------------------------------------
  // 12. FRIENDS / SOCIAL
  // ----------------------------------------------------------

  social: {
    enabled: true,
    priority: 8,

    friends: true,
    friendRequests: true,

    onlineStatus: true,

    partySystem: true,
    partyInvites: true,

    privateMessages: true,
    chat: true,

    voiceChat: false,

    playerProfiles: true,

    playerSearch: true,

    blockSystem: true,

    reportSystem: true
  },

  // ----------------------------------------------------------
  // 13. COMPETITIVE SYSTEM
  // ----------------------------------------------------------

  competition: {
    enabled: true,
    priority: 8,

    leaderboards: true,

    globalLeaderboard: true,
    seasonalLeaderboard: true,
    friendsLeaderboard: true,

    rankings: true,

    competitiveEvents: true,

    playerStatistics: true,

    winStatistics: true,
    missionStatistics: true,
    explorationStatistics: true,

    rankedMode: true
  },

  // ----------------------------------------------------------
  // 14. EVENTS
  // ----------------------------------------------------------

  events: {
    enabled: true,
    priority: 8,

    liveEvents: true,

    seasonalEvents: true,
    weeklyEvents: true,
    dailyEvents: true,

    worldEvents: true,

    multiplayerEvents: true,

    specialChallenges: true,

    limitedTimeRewards: true,

    eventLeaderboard: true
  },

  // ----------------------------------------------------------
  // 15. COLLECTION
  // ----------------------------------------------------------

  collection: {
    enabled: true,
    priority: 6,

    collectibles: true,

    vehicles: true,
    weapons: true,
    outfits: true,

    achievements: true,

    hiddenItems: true,
    rareItems: true,

    collectionProgress: true,

    collectionRewards: true
  },

  // ----------------------------------------------------------
  // 16. CHARACTER CUSTOMIZATION
  // ----------------------------------------------------------

  customization: {
    enabled: true,
    priority: 7,

    characterCustomization: true,

    appearance: true,
    outfits: true,
    accessories: true,

    hairstyles: true,

    cosmeticItems: true,

    weaponSkins: true,
    vehicleSkins: true,

    profileCustomization: true
  },

  // ----------------------------------------------------------
  // 17. NPC SYSTEM
  // ----------------------------------------------------------

  npc: {
    enabled: true,
    priority: 8,

    npcs: true,

    civilianNPCs: true,
    friendlyNPCs: true,
    enemyNPCs: true,

    merchants: true,
    questNPCs: true,

    npcSchedules: true,
    npcInteractions: true,

    npcDialogue: true,

    npcReputation: true,

    dynamicNPCBehavior: true
  },

  // ----------------------------------------------------------
  // 18. WORLD SIMULATION
  // ----------------------------------------------------------

  worldSimulation: {
    enabled: true,
    priority: 8,

    dayNightCycle: true,

    weather: true,

    rain: true,
    fog: true,

    dynamicLighting: true,

    worldEvents: true,

    timeBasedEvents: true,

    npcSchedules: true,

    persistentWorldState: true
  },

  // ----------------------------------------------------------
  // 19. ACHIEVEMENTS
  // ----------------------------------------------------------

  achievements: {
    enabled: true,
    priority: 6,

    achievements: true,

    hiddenAchievements: true,
    secretAchievements: true,

    progressionAchievements: true,
    explorationAchievements: true,
    combatAchievements: true,
    multiplayerAchievements: true,

    achievementRewards: true
  },

  // ----------------------------------------------------------
  // 20. CLOUD SAVE
  // ----------------------------------------------------------

  cloudSave: {
    enabled: true,
    priority: 9,

    localSave: true,
    cloudSave: true,

    automaticSave: true,

    manualSave: true,

    saveSlots: true,

    crossDeviceSave: true,

    backupSave: true
  },

  // ----------------------------------------------------------
  // 21. ACCOUNT SYSTEM
  // ----------------------------------------------------------

  account: {
    enabled: true,
    priority: 9,

    registration: true,
    login: true,
    logout: true,

    passwordReset: true,

    profile: true,

    avatar: true,

    accountStatistics: true,

    cloudProfile: true
  },

  // ----------------------------------------------------------
  // 22. SECURITY
  // ----------------------------------------------------------

  security: {
    enabled: true,
    priority: 10,

    serverValidation: true,

    databaseRLS: true,

    secureAPI: true,

    inputValidation: true,

    rateLimiting: true,

    abuseProtection: true,

    reportSystem: true,

    antiCheat: true
  },

  // ----------------------------------------------------------
  // 23. AUDIO
  // ----------------------------------------------------------

  audio: {
    enabled: true,
    priority: 6,

    music: true,
    soundEffects: true,

    ambientAudio: true,
    positionalAudio: true,

    environmentalAudio: true,

    voiceAudio: true,

    dynamicMusic: true,

    audioSettings: true
  },

  // ----------------------------------------------------------
  // 24. GRAPHICS
  // ----------------------------------------------------------

  graphics: {
    enabled: true,
    priority: 10,

    highQualityGraphics: true,

    webGL2: true,
    webGPUReady: true,

    PBRMaterials: true,

    HDR: true,
    HDRI: true,

    normalMaps: true,
    roughnessMaps: true,
    metalnessMaps: true,
    aoMaps: true,

    highResolutionTextures: true,

    compressedTextures: true,

    KTX2: true,
    Draco: true,
    Meshopt: true,

    LOD: true,

    dynamicResolution: true,

    shadows: true,
    highQualityShadows: true,

    toneMapping: true,

    colorManagement: true,

    postProcessing: true
  },

  // ----------------------------------------------------------
  // 25. PERFORMANCE
  // ----------------------------------------------------------

  performance: {
    enabled: true,
    priority: 10,

    adaptiveQuality: true,

    dynamicResolution: true,

    LOD: true,

    frustumCulling: true,

    instancing: true,

    assetStreaming: true,

    textureStreaming: true,

    memoryManagement: true,

    objectPooling: true,

    mobileOptimization: true,

    lowEndDeviceSupport: true
  },

  // ----------------------------------------------------------
  // 26. MOBILE CONTROLS
  // ----------------------------------------------------------

  mobile: {
    enabled: true,
    priority: 8,

    touchControls: true,

    virtualJoystick: true,

    touchButtons: true,

    mobileHUD: true,

    mobileSettings: true,

    vibration: true,

    adaptiveUI: true,

    landscapeMode: true,

    portraitMode: false
  },

  // ----------------------------------------------------------
  // 27. UI / UX
  // ----------------------------------------------------------

  ui: {
    enabled: true,
    priority: 8,

    mainMenu: true,
    pauseMenu: true,

    HUD: true,

    inventoryUI: true,
    missionUI: true,
    mapUI: true,

    settingsUI: true,

    profileUI: true,
    friendsUI: true,
    leaderboardUI: true,

    shopUI: true,

    responsiveUI: true,

    accessibility: true
  },

  // ----------------------------------------------------------
  // 28. MAP / WORLD MAP
  // ----------------------------------------------------------

  map: {
    enabled: true,
    priority: 7,

    worldMap: true,

    minimap: true,

    markers: true,

    missionMarkers: true,
    playerMarkers: true,

    discoveredLocations: true,

    fastTravelPoints: true,

    mapFilters: true
  },

  // ----------------------------------------------------------
  // 29. FAST TRAVEL
  // ----------------------------------------------------------

  fastTravel: {
    enabled: true,
    priority: 5,

    enabledByDiscovery: true,

    teleportPoints: true,
    vehicleTravel: true,

    travelCosts: true
  },

  // ----------------------------------------------------------
  // 30. FUTURE SYSTEMS
  // ----------------------------------------------------------

  future: {
    vr: false,

    dedicatedGameServer: true,

    advancedMatchmaking: true,

    dedicatedVoiceServer: false,

    advancedAntiCheat: true,

    nativeAndroidClient: true,

    nativePCClient: false,

    modSupport: false
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check whether a complete system is enabled.
 *
 * Example:
 * isGoalEnabled("multiplayer")
 */
export function isGoalEnabled(goalName) {
  return GAME_GOALS?.[goalName]?.enabled === true;
}

/**
 * Check whether a specific feature inside a system is enabled.
 *
 * Example:
 * isFeatureEnabled("multiplayer", "matchmaking")
 */
export function isFeatureEnabled(goalName, featureName) {
  return GAME_GOALS?.[goalName]?.[featureName] === true;
}

/**
 * Get all enabled major systems.
 */
export function getEnabledGoals() {
  return Object.entries(GAME_GOALS)
    .filter(([, config]) => config?.enabled === true)
    .map(([name]) => name);
}

/**
 * Get all disabled major systems.
 */
export function getDisabledGoals() {
  return Object.entries(GAME_GOALS)
    .filter(([, config]) => config?.enabled === false)
    .map(([name]) => name);
}

/**
 * Get the complete configuration for one system.
 */
export function getGoalConfig(goalName) {
  return GAME_GOALS?.[goalName] ?? null;
}

/**
 * Get all systems sorted by priority.
 */
export function getGoalsByPriority() {
  return Object.entries(GAME_GOALS)
    .filter(([, config]) => typeof config?.priority === "number")
    .sort((a, b) => b[1].priority - a[1].priority)
    .map(([name, config]) => ({
      name,
      priority: config.priority,
      enabled: config.enabled === true
    }));
}

/**
 * Create a safe read-only snapshot of the configuration.
 */
export function getGameGoalsSnapshot() {
  return JSON.parse(JSON.stringify(GAME_GOALS));
}

// Default export for modules that prefer a single import.
export default GAME_GOALS;
