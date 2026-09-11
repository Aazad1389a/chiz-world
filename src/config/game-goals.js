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
    accessories: true
