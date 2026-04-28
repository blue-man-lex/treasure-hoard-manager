 /**
 * Treasure Hoard Manager - Shop Manager
 * Управление магазинами с поддержкой категорий и адаптивности
 */

import { CONSTANTS } from '../core/constants.js';
import { AppearanceManager } from './appearance-manager.js';

export class ShopManager {

  constructor(mainManager) {
    this.mainManager = mainManager;
    this.appearanceManager = new AppearanceManager(); // ✅ Добавлен менеджер внешнего вида
    this.shopCategories = mainManager.systemAdapter.getShopConfiguration().shopTypes;
  }

  /**
   * Создание магазина из актера с учетом новых настроек
   */
  async createShop(actor, options = {}) {
    console.log(`THM Shop Manager | Creating shop from ${actor.name}`);

    const settings = actor.getFlag(CONSTANTS.MODULE_NAME, 'settings');
    const shopType = this.detectShopType(settings?.specific);
    const category = this.shopCategories[shopType] || this.shopCategories.general || Object.values(this.shopCategories)[0] || { defaultRarity: { common: 50, uncommon: 30, rare: 15, veryrare: 5, legendary: 0 } };

    // ОПРЕДЕЛЯЕМ ИМЯ (Оставляем текущее ИЛИ генерируем новое, если стоит галочка)
    let finalShopName = actor.name;
    if (settings?.specific?.overwriteName) {
      const { generateShopkeeperName } = await import('./name-generators.js');
      finalShopName = generateShopkeeperName(settings.specific.shopGender);
      console.log(`THM Shop Manager | Generated new name: ${finalShopName}`);
    }

    const defaultSettings = {
      shopName: finalShopName,
      shopType: shopType,
      shopCategory: category,
      isOpen: true,
      currentInventory: [],
      transactionHistory: [],
      adaptiveRarity: settings?.specific?.smartAdaptive || false,
      levelMultiplier: settings?.specific?.levelMultiplier || 2,
      raritySettings: this.calculateRaritySettings(settings?.specific, category.defaultRarity)
    };

    const finalSettings = mergeObject(defaultSettings, options);

    const updates = {
      name: finalShopName,
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`]: {
        type: CONSTANTS.PILE_TYPES.SHOP,
        enabled: true,
        version: CONSTANTS.VERSION,
        shopName: finalShopName, // <--- Используем сгенерированное имя
        shopType: finalSettings.shopType,
        shopCategory: finalSettings.shopCategory,
        isOpen: finalSettings.isOpen,
        currentInventory: finalSettings.currentInventory,
        transactionHistory: finalSettings.transactionHistory,
        raritySettings: finalSettings.raritySettings
      },
      [`flags.${CONSTANTS.MODULE_NAME}.settings`]: {
        general: {
          interactionDistance: settings?.general?.interactionDistance || CONSTANTS.DEFAULTS.INTERACTION_DISTANCE,
          showItemCards: settings?.general?.showItemCards || CONSTANTS.DEFAULTS.SHOW_ITEM_CARDS,
          deleteWhenEmpty: settings?.general?.deleteWhenEmpty || CONSTANTS.DEFAULTS.DELETE_WHEN_EMPTY,
          stackItems: settings?.general?.stackItems || CONSTANTS.DEFAULTS.STACK_ITEMS
        },
        specific: {
          inventorySources: settings?.specific?.inventorySources || '',
          shopType: settings?.specific?.shopType || 'general',
          priceMarkup: settings?.specific?.priceMarkup || 100,
          priceBuyback: settings?.specific?.priceBuyback || 50,
          priceMethod: settings?.specific?.priceMethod || 'dmg', // DMG или XGE метод
          alwaysOpen: settings?.specific?.alwaysOpen || false,
          useReputation: settings?.specific?.useReputation || false,
          categoryWeapons: settings?.specific?.categoryWeapons || false,
          categoryArmor: settings?.specific?.categoryArmor || false,
          categoryPotions: settings?.specific?.categoryPotions || false,
          categoryScrolls: settings?.specific?.categoryScrolls || false,
          categoryFood: settings?.specific?.categoryFood || false,
          categoryGems: settings?.specific?.categoryGems || false,
          categoryMaterials: settings?.specific?.categoryMaterials || false,
          smartAdaptive: settings?.specific?.smartAdaptive || false,
          levelMultiplier: settings?.specific?.levelMultiplier || 2,
          baseCommon: settings?.specific?.baseCommon || 70,
          baseUncommon: settings?.specific?.baseUncommon || 30,
          baseRare: settings?.specific?.baseRare || 10,
          baseVeryRare: settings?.specific?.baseVeryRare || 2,
          baseLegendary: settings?.specific?.baseLegendary || 1,
          maxItemTypes: settings?.specific?.maxItemTypes || 20,
          maxItemQuantity: settings?.specific?.maxItemQuantity || 10,
          minItemQuantity: settings?.specific?.minItemQuantity || 1
        }
      }
    };

    // Сначала устанавливаем флаги на токен (если есть), потом на актера
    const tokenToUpdate = actor.token;
    if (tokenToUpdate) {
      const tokenFlags = {
        name: finalShopName, // <--- НОВОЕ: Меняем имя токена на сцене
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.TYPE}`]: CONSTANTS.PILE_TYPES.SHOP,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.ENABLED}`]: true,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.VERSION}`]: CONSTANTS.VERSION,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`]: updates[`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`],
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.SETTINGS}`]: updates[`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.SETTINGS}`]
      };

      if (tokenToUpdate.document) {
        // Это Token (на сцене) - обновляем через документ
        await tokenToUpdate.document.update(tokenFlags);
      } else {
        // Это TokenDocument - обновляем напрямую
        await tokenToUpdate.update(tokenFlags);
      }
    }

    // ❌ НЕ обновляем глобальный актер (прототип) - он должен остаться болванкой!
    // await actor.update(updates);
    console.log(`THM Shop Manager | Skipping global actor update to preserve prototype`);

    // Обновление внешнего вида - передаем токен если есть
    const targetForAppearance = actor.token || actor;
    await this.updateShopAppearance(targetForAppearance, category, finalShopName);

    // Генерация начального инвентаря
    if (finalSettings.shopType !== 'general') {
      await this.generateInitialInventory(actor, {
        specific: settings?.specific || {},
        raritySettings: finalSettings.raritySettings
      });
    }

    ui.notifications.info(`Магазин "${actor.name}" (${category.name}) создан успешно`);

    return {
      success: true,
      shop: actor,
      settings: finalSettings
    };
  }

  /**
   * Определение типа магазина по выбранным категориям или явному указанию
   */
  detectShopType(specific) {
    if (specific?.shopType) {
      return specific.shopType;
    }

    if (!specific) return 'general';

    const categories = {
      weapons: specific.categoryWeapons,
      armor: specific.categoryArmor,
      potions: specific.categoryPotions,
      scrolls: specific.categoryScrolls,
      food: specific.categoryFood,
      gems: specific.categoryGems,
      materials: specific.categoryMaterials
    };

    if (categories.weapons && categories.materials && !categories.potions && !categories.armor) return 'weaponsmith';
    if (categories.armor && categories.materials && !categories.weapons && !categories.potions) return 'armorer';
    if (categories.potions && !categories.weapons && !categories.armor) return 'alchemist';
    if (categories.scrolls && !categories.weapons && !categories.armor && !categories.potions) return 'scribe';
    if (categories.food && !categories.weapons && !categories.armor && !categories.potions) return 'cook';
    if (categories.gems && !categories.weapons && !categories.armor && !categories.potions) return 'merchant';

    return 'general';
  }

  calculateRaritySettings(specific, baseRarity) {
    let level = 0;

    // Режим 1: Умная адаптивность (следуем за игроками)
    if (specific?.smartAdaptive) {
      level = this.getAveragePlayerLevel() || 1;
      console.log(`THM | Smart Adaptive mode: using player level ${level}`);
    } 
    // Режим 2: Ручной уровень торговца (принудительная математика уровня)
    else if (specific?.merchantLevel > 1) {
      level = specific.merchantLevel;
      console.log(`THM | Fixed Level mode: using merchant level ${level}`);
    }

    // Если уровень определен (через игроков или ручной ввод > 1), применяем математику уровней
    if (level > 0) {
      const multiplier = specific.levelMultiplier || 2;
      return {
        common: Math.max(5, (baseRarity.common || 70) - (level * multiplier)),
        uncommon: Math.min(60, (baseRarity.uncommon || 30) + (level * multiplier * 0.4)),
        rare: Math.min(50, (baseRarity.rare || 10) + (level * multiplier * 0.7)),
        veryrare: level >= 5 ? Math.min(40, (baseRarity.veryrare || 0) + ((level - 4) * multiplier * 1.1)) : 0,
        legendary: level >= 11 ? Math.min(30, (baseRarity.legendary || 0) + ((level - 10) * multiplier * 1.5)) : 0
      };
    }

    // Режим 3: Адаптивность выкл И уровень 1 — используем ручные настройки из слайдеров
    console.log(`THM | Manual mode: using slider settings`, baseRarity);
    return baseRarity;
  }

  /**
   * Получение среднего уровня игроков
   */
  getAveragePlayerLevel() {
    const players = game.users.filter(u => u.active && u.character && !u.isGM);
    if (players.length === 0) return 1;

    const totalLevel = players.reduce((sum, user) => {
      return sum + this.mainManager.systemAdapter.getActorLevel(user.character);
    }, 0);

    return Math.round(totalLevel / players.length);
  }

  /**
   * Обновление внешнего вида магазина (только имя и базовые настройки)
   */
  async updateShopAppearance(target, category, finalShopName) {
    console.log(`THM Shop Manager | Updating shop appearance for ${target.name} with category ${category.name}`);
    console.log(`THM Shop Manager | Target type: ${target.constructor.name}, has document: ${!!target.document}`);

    // Дополнительно обновляем имя токена если это токен на сцене
    if (target.document && target.name !== finalShopName) {
      console.log(`THM Shop Manager | Updating token name to: ${finalShopName}`);
      await target.document.update({ name: finalShopName });
    }

    // ✅ БОЛЬШЕ НЕ ПРИМЕНЯЕМ ПОРТРЕТЫ ЗДЕСЬ - они применяются при сохранении настроек
    console.log(`THM Shop Manager | Appearance updated (name only). Portraits are handled by config-app.js`);
  }

  /**
   * Генерация начального инвентаря магазина (Создает реальные предметы)
   */
  async generateInitialInventory(actor, settings) {
    console.log(`THM Shop Manager | Generating initial inventory for ${actor.name}`);

    // НОВОЕ: Если нет источников компендиумов, используем текущий инвентарь НПС
    if (!settings?.specific?.inventorySources || settings?.specific?.inventorySources.trim() === '') {
      console.log(`THM Shop Manager | No compendium sources specified, using existing inventory for ${actor.name}`);

      // Просто отмечаем, что это магазин
      await actor.setFlag(CONSTANTS.MODULE_NAME, `${CONSTANTS.FLAGS.DATA}.inventoryGenerated`, true);

      // Генерируем цены для уже существующих предметов, если они равны 0
      const priceMethod = settings?.specific?.priceMethod || 'dmg';
      const itemUpdates = [];
      
      for (const item of actor.items) {
        if ((item.system?.price?.value || 0) === 0) {
          const generatedPrice = await this.mainManager.systemAdapter.generateItemPrice(item, priceMethod);
          itemUpdates.push({
            _id: item.id,
            "system.price.value": generatedPrice
          });
        }
      }
      
      if (itemUpdates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", itemUpdates);
        console.log(`THM Shop Manager | Updated prices for ${itemUpdates.length} existing items`);
      }

      const currentItemCount = actor.items.size;
      console.log(`THM Shop Manager | Shop created with ${currentItemCount} existing items for ${actor.name}`);
      ui.notifications.info(`Магазин "${actor.name}" создан с ${currentItemCount} предметами из инвентаря!`);
      return;
    }

    // Оригинальная логика для компендиумов
    const category = this.shopCategories[settings?.specific?.shopType] || this.shopCategories.general || Object.values(this.shopCategories)[0] || { defaultRarity: { common: 50, uncommon: 30, rare: 15, veryrare: 5, legendary: 0 } };
    const raritySettings = settings?.raritySettings || this.calculateRaritySettings(settings?.specific, category.defaultRarity);

    const inventory = await this.loadItemsFromCompendiums(settings?.specific?.inventorySources);
    if (!inventory || inventory.length === 0) {
      console.warn(`THM Shop Manager | No items found in compendiums for ${actor.name}`);
      ui.notifications.warn(`Не найдено предметов в указанных библиотеках для ${actor.name}`);
      return;
    }

    const filteredInventory = this.filterItemsByCategories(inventory, settings.specific);
    if (filteredInventory.length === 0) {
      console.warn(`THM Shop Manager | Items found, but filtered out by categories`);
      ui.notifications.warn(`Все предметы были отфильтрованы. Проверьте категории!`);
      return;
    }

    // Передаем гарантированно существующий объект raritySettings
    const balancedInventory = this.balanceItemsByRarity(filteredInventory, raritySettings);
    let limitedInventory = this.applyInventoryLimits(balancedInventory, settings.specific);

    // Очищаем существующий инвентарь магазина (только те предметы, которые могут быть лутом)
    const adapter = this.mainManager.systemAdapter;
    const itemsToRemove = actor.items.filter(i => adapter.canItemBeInHoard(i)).map(i => i.id);
    if (itemsToRemove.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", itemsToRemove);
    }
    
    // Генерируем деньги торговцу через адаптер (для всех магазинов)
    if (typeof adapter.generateMerchantWealth === 'function') {
      await adapter.generateMerchantWealth(actor);
    }

    // Подготавливаем предметы для Foundry (удаляем системные поля и устанавливаем цены)
    limitedInventory = await Promise.all(limitedInventory.map(async (item) => {
      // Полностью клонируем предмет и очищаем от системных полей
      const newItem = foundry.utils.deepClone(item);

      // Удаляем все системные поля Foundry которые могут вызвать конфликты
      delete newItem._id;
      delete newItem.id;
      delete newItem.folder;
      delete newItem.sort;
      delete newItem.ownership;
      delete newItem.actors;
      delete newItem.effects;
      delete newItem.flags?.core;
      delete newItem._source;
      delete newItem._stats;

      // Убедимся что система цен существует
      if (!newItem.system) newItem.system = {};
      if (!newItem.system.price) newItem.system.price = {};

      // Используем новую систему генерации цен через адаптер
      const priceMethod = settings?.specific?.priceMethod || 'dmg'; // DMG по умолчанию
      const finalPrice = await this.mainManager.systemAdapter.generateItemPrice(newItem, priceMethod);

      // Записываем цену в карточку предмета (используя путь из адаптера)
      const pricePath = (typeof adapter.getPricePath === 'function') ? adapter.getPricePath() : "system.price.value";
      foundry.utils.setProperty(newItem, pricePath, finalPrice);

      return newItem;
    }));

    // Временно закрываем окна персонажа, чтобы обойти баг систем (handleMookDraggedItem / recursiveGetAllInstalledItems)
    const appsToClose = Object.values(actor.apps || {}).filter(app => app.constructor.name.includes('ActorSheet'));
    if (appsToClose.length > 0) {
      console.log(`THM Shop Manager | Closing actor sheets to prevent system hook crash`);
      for (const app of appsToClose) {
        try {
          if (app.rendered) await app.close();
        } catch (err) {
          console.warn("THM | Failed to close app safely:", err);
        }
      }
    }

    // Создаем реальные предметы в инвентаре НПС
    await actor.createEmbeddedDocuments("Item", limitedInventory);

    // Отмечаем, что инвентарь сгенерирован
    await actor.setFlag(CONSTANTS.MODULE_NAME, `${CONSTANTS.FLAGS.DATA}.inventoryGenerated`, true);

    // НОВОЕ: Генерируем деньги торговцу через адаптер
    await this.mainManager.systemAdapter.generateMerchantWealth(actor);

    console.log(`THM Shop Manager | Successfully created ${limitedInventory.length} real items for ${actor.name}`);
    ui.notifications.info(`Создано ${limitedInventory.length} товаров для "${actor.name}"!`);
  }

  /**
   * Загрузка предметов из компендиумов с поддержкой папок
   */
  async loadItemsFromCompendiums(sourcesString) {
    if (!sourcesString) return [];

    const sources = sourcesString.split(',').map(s => s.trim()).filter(s => s);
    let allItems = [];

    console.log(`THM Shop Manager | Loading from compendiums: ${sources.join(', ')}`);

    for (const source of sources) {
      let packId = source;
      let folderId = null;
      let isFolder = false;

      // Проверяем, есть ли двоеточие (формат папки)
      if (source.includes(':')) {
        [packId, folderId] = source.split(':');
        isFolder = true;
      }

      const pack = game.packs.get(packId);

      if (pack) {
        await pack.getIndex();

        if (isFolder && folderId) {
          // Загружаем предметы из конкретной папки
          try {
            const adapter = this.mainManager.systemAdapter;
            const items = await pack.getDocuments();
            const folderItems = items.filter(item => item.folder?.id === folderId && adapter.canItemBeInHoard(item));
            console.log(`THM Shop Manager | Found ${folderItems.length} items in folder ${folderId} of ${packId}`);
            allItems = [...allItems, ...folderItems.map(item => item.toObject())];
          } catch (error) {
            console.warn(`THM Shop Manager | Error loading folder ${folderId} from ${packId}:`, error);
          }
        } else {
          // Загружаем весь компендиум
          const adapter = this.mainManager.systemAdapter;
          const items = await pack.getDocuments();
          const validItems = items.filter(item => adapter.canItemBeInHoard(item));
          console.log(`THM Shop Manager | Found ${validItems.length} valid items in ${packId}`);
          allItems = [...allItems, ...validItems.map(item => item.toObject())];
        }
      } else {
        console.warn(`THM Shop Manager | Не удалось загрузить компендиум с ID: ${packId}`);
      }
    }

    console.log(`THM Shop Manager | Total items loaded: ${allItems.length}`);
    return allItems;
  }

  /**
   * Фильтрация предметов по категориям (Исправленная версия)
   */
  filterItemsByCategories(items, specific) {
    // Если ни одна категория не выбрана, возвращаем все предметы
    const hasAnyCategory = specific.categoryWeapons ||
      specific.categoryArmor ||
      specific.categoryPotions ||
      specific.categoryScrolls ||
      specific.categoryFood ||
      specific.categoryGems ||
      specific.categoryMaterials;

    if (!hasAnyCategory) {
      console.log('THM Shop Manager | No categories selected, returning all items');
      return items;
    }

    return items.filter(item => {
      const adapter = this.mainManager.systemAdapter;
      if (specific.categoryWeapons && adapter.isWeapon(item)) return true;
      if (specific.categoryArmor && adapter.isArmor(item)) return true;
      if (specific.categoryPotions && adapter.isPotion(item)) return true;
      if (specific.categoryScrolls && adapter.isScroll(item)) return true;
      if (specific.categoryFood && adapter.isFood(item)) return true;
      if (specific.categoryGems && adapter.isGem(item)) return true;
      if (specific.categoryMaterials && adapter.isMaterial(item)) return true;
      return false;
    });
  }

  /**
   * Балансировка предметов по редкости
   */
  balanceItemsByRarity(items, raritySettings) {
    // Защита от пустых настроек
    const settings = raritySettings || { common: 70, uncommon: 20, rare: 10, veryrare: 0, legendary: 0 };
    const total = Object.values(settings).reduce((a, b) => a + b, 0) || 100;
    const normalizedRarity = {};
    Object.keys(settings).forEach(key => {
      normalizedRarity[key] = (settings[key] / total) * 100;
    });

    const balanced = [];
    const itemsByRarity = this.groupItemsByRarity(items);

    Object.keys(normalizedRarity).forEach(rarity => {
      const count = Math.ceil((items.length * normalizedRarity[rarity]) / 100);
      const rarityItems = itemsByRarity[rarity] || [];
      const selected = this.randomSelect(rarityItems, Math.min(count, rarityItems.length));
      balanced.push(...selected);
    });

    return balanced;
  }

  /**
   * Применение ограничений инвентаря
   */
  applyInventoryLimits(items, specific) {
    const maxTypes = specific.maxItemTypes || 20;
    const maxQuantity = specific.maxItemQuantity || 10;
    const minQuantity = specific.minItemQuantity || 1;

    const limitedTypes = this.randomSelect(items, maxTypes);

    return limitedTypes.map(item => {
      // ОПРЕДЕЛЯЕМ: Можно ли стакать этот тип?
      const isStackable = this.mainManager.systemAdapter.isStackable(item);
      const adapter = this.mainManager.systemAdapter;
      
      const qtyPath = (adapter && typeof adapter.getQuantityPath === 'function') 
        ? adapter.getQuantityPath() 
        : "system.quantity";

      // Создаем копию предмета и устанавливаем количество по правильному пути
      const newItem = foundry.utils.deepClone(item);
      const quantity = isStackable
        ? (Math.floor(Math.random() * (maxQuantity - minQuantity + 1)) + minQuantity)
        : 1;

      foundry.utils.setProperty(newItem, qtyPath, quantity);

      return newItem;
    });
  }

  /**
   * Группировка предметов по редкости
   */
  groupItemsByRarity(items) {
    const grouped = {
      common: [],
      uncommon: [],
      rare: [],
      veryrare: [],
      legendary: []
    };

    items.forEach(item => {
      const adapter = this.mainManager.systemAdapter;
      const rarity = adapter.getItemRarity(item);
      if (grouped[rarity]) {
        grouped[rarity].push(item);
      } else {
        grouped.common.push(item); // Фолбек на обычные
      }
    });

    return grouped;
  }

  /**
   * Случайный выбор элементов
   */
  randomSelect(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Удалены dnd5e специфичные методы (теперь они в адаптерах)
   */

  /**
   * Обновление инвентаря магазина (Создает реальные предметы)
   */
  async refreshInventory(actor) {
    console.log(`THM Shop Manager | Refreshing inventory for ${actor.name}`);

    // ✅ ПРАВИЛЬНО: Читаем настройки с токена, а не с актера
    const settings = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings') ||
      actor.getFlag(CONSTANTS.MODULE_NAME, 'settings');
    const data = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'data') ||
      actor.getFlag(CONSTANTS.MODULE_NAME, 'data');

    let currentRaritySettings = data.raritySettings;

    if (settings?.specific?.smartAdaptive) {
      currentRaritySettings = this.calculateRaritySettings(settings.specific, data.raritySettings);
      await actor.setFlag(CONSTANTS.MODULE_NAME, `${CONSTANTS.FLAGS.DATA}.raritySettings`, currentRaritySettings);
    }

    // ✅ ПРОВЕРКА: Используем источники из настроек токена
    if (!settings?.specific?.inventorySources || settings?.specific?.inventorySources.trim() === '') {
      console.warn(`THM Shop Manager | No compendium sources specified for refresh`);
      ui.notifications.warn('Не указаны источники компендиумов для обновления! Проверьте настройки магазина.');
      return;
    }

    // ✅ ПРОВЕРКА: Убедимся что настройки редкости существуют
    if (!currentRaritySettings) {
      console.warn(`THM Shop Manager | No rarity settings found, using defaults`);
      currentRaritySettings = {
        common: 50,
        uncommon: 25,
        rare: 15,
        veryrare: 7,
        legendary: 3
      };
    }

    // ✅ СТАНДАРТНАЯ ГЕНЕРАЦИЯ ИЗ КОМПЕНДИУМОВ
    const inventory = await this.loadItemsFromCompendiums(settings.specific.inventorySources);
    if (!inventory || inventory.length === 0) {
      console.warn(`THM Shop Manager | No items found in compendiums for ${actor.name}`);
      ui.notifications.warn(`Не найдено предметов в указанных библиотеках для ${actor.name}`);
      return;
    }

    const filteredInventory = this.filterItemsByCategories(inventory, settings.specific);
    if (filteredInventory.length === 0) {
      console.warn(`THM Shop Manager | Items found, but filtered out by categories`);
      ui.notifications.warn(`Все предметы были отфильтрованы. Проверьте категории!`);
      return;
    }

    const balancedInventory = this.balanceItemsByRarity(filteredInventory, currentRaritySettings);
    let limitedInventory = this.applyInventoryLimits(balancedInventory, settings.specific);

    // Очищаем старый инвентарь (только те предметы, которые могут быть лутом)
    const adapter = this.mainManager.systemAdapter;
    const itemsToRemove = actor.items.filter(i => adapter.canItemBeInHoard(i)).map(i => i.id);
    if (itemsToRemove.length > 0) {
      await actor.deleteEmbeddedDocuments("Item", itemsToRemove);
    }

    // Подготавливаем и создаем новые предметы с улучшенной системой цен
    limitedInventory = await Promise.all(limitedInventory.map(async (item) => {
      // Полностью клонируем предмет и очищаем от системных полей
      const newItem = foundry.utils.deepClone(item);

      // Удаляем все системные поля Foundry которые могут вызвать конфликты
      delete newItem._id;
      delete newItem.id;
      delete newItem.folder;
      delete newItem.sort;
      delete newItem.ownership;
      delete newItem.actors;
      delete newItem.effects;
      delete newItem.flags?.core;
      delete newItem._source;
      delete newItem._stats;

      // Убедимся что система цен существует
      if (!newItem.system) newItem.system = {};
      if (!newItem.system.price) newItem.system.price = {};

      // Используем новую систему генерации цен
      const priceMethod = settings?.specific?.priceMethod || 'dmg'; // DMG по умолчанию
      const finalPrice = await this.mainManager.systemAdapter.generateItemPrice(newItem, priceMethod);

      // Записываем цену в карточку предмета (используя путь из адаптера)
      const pricePath = (typeof adapter.getPricePath === 'function') ? adapter.getPricePath() : "system.price.value";
      foundry.utils.setProperty(newItem, pricePath, finalPrice);

      return newItem;
    }));

    // Временно закрываем окна персонажа, чтобы обойти баг системы CPR v13 (handleMookDraggedItem / recursiveGetAllInstalledItems)
    const appsToClose = Object.values(actor.apps || {}).filter(app => app.constructor.name.includes('ActorSheet'));
    if (appsToClose.length > 0) {
      console.log(`THM Shop Manager | Closing actor sheets to prevent system hook crash`);
      for (const app of appsToClose) {
        await app.close();
      }
    }

    await actor.createEmbeddedDocuments("Item", limitedInventory);

    // Уведомление через сокеты (исправлено на socketlib)
    if (this.mainManager?.socketManager) {
      try {
        await this.mainManager.socketManager.broadcast('updateHoard', {
          actorUuid: actor.uuid,
          action: "inventory_refreshed"
        });
      } catch (error) {
        console.warn('THM Shop Manager | Socket notification failed:', error);
      }
    }

    // НОВОЕ: Обновляем деньги торговца при смене ассортимента через адаптер
    await this.mainManager.systemAdapter.generateMerchantWealth(actor);

    ui.notifications.info(`Ассортимент магазина "${actor.name}" обновлен!`);
  }

  /**
   * Получение информации о магазине
   */
  getShopInfo(actor) {
    if (!actor) return null;

    // ✅ ПРАВИЛЬНО: Читаем настройки с токена, а не с актера
    const data = actor.token?.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA) ||
      actor.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA) || {};
    const settings = actor.token?.getFlag(CONSTANTS.MODULE_NAME, 'settings') ||
      actor.getFlag(CONSTANTS.MODULE_NAME, 'settings') || {};

    return {
      id: actor.id,      // <-- ОБЯЗАТЕЛЬНО
      uuid: actor.uuid,  // <-- ОБЯЗАТЕЛЬНО
      type: data.type || CONSTANTS.PILE_TYPES.SHOP,
      name: data.shopName || actor.name,
      img: actor.img || actor.token?.img || "icons/svg/mystery-man.svg", // <-- ДОБАВЛЕНО ПОРТРЕТ
      category: data.shopCategory || { name: 'Магазин', icon: 'icons/svg/item-bag.svg' },
      enabled: data.enabled !== false,
      isOpen: data.isOpen !== false,
      inventory: actor.items?.contents?.map(item => item.toObject()) || [],
      transactionHistory: data.transactionHistory || [],
      raritySettings: data.raritySettings || {},
      settings: settings,
      currency: this.mainManager.systemAdapter.getActorCurrency(actor)
    };
  }

}