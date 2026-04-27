/**
 * Treasure Hoard Manager - Constants
 * Константы и конфигурация модуля
 */

export const CONSTANTS = {
  MODULE_NAME: "treasure-hoard-manager",
  VERSION: "1.0.0",
  
  // Названия флагов
  FLAGS: {
    TYPE: "type",        // Тип хранилища (hoard, container, shop, etc.)
    ENABLED: "enabled",  // Включено ли хранилище
    VERSION: "version",   // Версия флагов
    DATA: "data",        // Основной флаг для всех настроек
    SETTINGS: "settings" // Настройки хранилища
  },
  
  // Типы хранилищ
  PILE_TYPES: {
    CONTAINER: "container", 
    SHOP: "shop",
    BLACKMARKET: "blackmarket", // <-- Чёрный рынок
    VAULT: "vault"
  },
  
  // Статусы трейда
  TRADE_STATUS: {
    PENDING: "pending",      // Ожидание ответа
    ACTIVE: "active",        // Активный трейд
    CONFIRMED: "confirmed",  // Подтвержден одной стороной
    COMPLETED: "completed",  // Завершен
    CANCELLED: "cancelled"   // Отменен
  },
  
  // Типы актеров для систем
  ACTOR_TYPES: {
    CHARACTER: "character",
    NPC: "npc",
    LOOT: "loot"
  },
  
  // Типы предметов
  ITEM_TYPES: {
    WEAPON: "weapon",
    EQUIPMENT: "equipment",
    CONSUMABLE: "consumable",
    TOOL: "tool",
    LOOT: "loot"
  },
  
  // Хуки сокетов
  SOCKET_HOOKS: {
    TRANSFER_ITEMS: "transferItems",
    LOOT_ALL: "lootAll",
    LOOT_ITEM: "lootItem", 
    LOOT_CURRENCY: "lootCurrency",
    UPDATE_HOARD: "updateHoard",
    TRADE_REQUEST: "tradeRequest",
    TRADE_RESPONSE: "tradeResponse",
    TRADE_UPDATE: "tradeUpdate",
    TRADE_CONFIRM: "tradeConfirm",
    TRADE_RESET: "tradeReset",
    TRADE_COMPLETE: "tradeComplete",
    REPUTATION_CHANGE: "reputationChange",
    // Интерфейсы
    RENDER_INTERFACE: "renderInterface",
    UNRENDER_INTERFACE: "unrenderInterface",
    USER_OPENED_INTERFACE: "userOpenedInterface",
    USER_CLOSED_INTERFACE: "userClosedInterface",
    // Drop to scene functionality
    CREATE_LOOT_PILE: "createLootPile",
    // Container locking
    TOGGLE_LOCK: "toggleLock",
    // Black market
    BLACKMARKET_SERVICE: "purchaseBlackMarketService"
  },
  
  // Настройки по умолчанию
  DEFAULTS: {
    INTERACTION_DISTANCE: 5,
    DELETE_WHEN_EMPTY: false,
    STACK_ITEMS: true,
    SHOW_ITEM_CARDS: true,
    REPUTATION_MODULE: false,
    TIME_MODULE: false,
    BUILTIN_REPUTATION: false
  },

  // CSS классы
  CSS: {
    HUD_BUTTON: "thm-hud-button",
    CONFIG_WINDOW: "thm-config-window",
    TRADE_WINDOW: "thm-trade-window"
  },
  
  // Иконки
  ICONS: {
    CONTAINER: "fas fa-box",
    SHOP: "fas fa-store",
    BLACKMARKET: "fas fa-user-secret", // Иконка для Чёрного рынка
    VAULT: "fas fa-lock",
    SETTINGS: "fas fa-cog",
    TRADE: "fas fa-handshake",
    REPUTATION: "fas fa-star",
    DEFAULT_ACTOR: "icons/svg/item-bag.svg"
  }
};
