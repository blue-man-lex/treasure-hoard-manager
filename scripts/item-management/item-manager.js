/**
 * Treasure Hoard Manager - Item Manager
 * Управление предметами и их свойствами
 */

import { CONSTANTS } from '../core/constants.js';

export class ItemManager {
  
  constructor(mainManager) {
    this.mainManager = mainManager;
  }

  /**
   * Получение количества предмета через системный адаптер
   */
  getItemQuantity(item) {
    return this.mainManager.systemAdapter.getItemQuantity(item);
  }

  /**
   * Установка количества предмета через системный адаптер
   */
  async setItemQuantity(item, quantity) {
    return await this.mainManager.systemAdapter.setItemQuantity(item, quantity);
  }

  /**
   * Получение цены предмета через системный адаптер
   */
  getItemPrice(item) {
    return this.mainManager.systemAdapter.getItemPrice(item);
  }

  /**
   * Получение валюты актера через системный адаптер
   */
  getActorCurrency(actor) {
    return this.mainManager.systemAdapter.getActorCurrency(actor);
  }

  /**
   * Получение типа предмета через системный адаптер
   */
  getItemType(item) {
    return this.mainManager.systemAdapter.getItemTypeName(item);
  }

  /**
   * Получение редкости предмета через системный адаптер
   */
  getItemRarity(item) {
    return this.mainManager.systemAdapter.getItemRarity(item);
  }

  /**
   * Проверка может ли предмет быть в хранилище
   */
  canItemBeInHoard(item) {
    return this.mainManager.systemAdapter.canItemBeInHoard(item);
  }

  /**
   * Передача предметов между актерами
   */
  async transferItems(sourceActor, targetActor, items, userId) {
    // Нормализация: если передали TokenDocument, берем Actor
    sourceActor = sourceActor.actor || sourceActor;
    targetActor = targetActor.actor || targetActor;

    if (!game.user.isGM) {
      return await this.mainManager.socketManager.executeAsGM('executeTransferAsGM', {
        sourceUuid: sourceActor.uuid,
        targetUuid: targetActor.uuid,
        items: items, // Передаем массив объектов целиком
        currency: null,
        userId
      });
    }

    const transferResults = [];
    
    // Массивы для массовых операций
    const itemsToCreate = [];
    const itemsToUpdate = [];
    const itemsToDeleteIds = [];
    const sourceItemsToUpdate = [];
    
    // Настройки стакания
    const settings = targetActor.getFlag(CONSTANTS.MODULE_NAME, 'settings');
    const shouldStackGlobal = settings?.general?.stackItems ?? true;

    // Проходим по предметам без await в цикле
    for (const itemData of items) {
      try {
        let item = await fromUuid(itemData.uuid);
        if (!item && (itemData._id || itemData.id)) {
          item = sourceActor.items.get(itemData._id || itemData.id);
        }
        if (!item) continue;

        const availableQuantity = this.getItemQuantity(item);
        const transferQuantity = Math.min(itemData.quantity || 1, availableQuantity);

        // 1. ПРОВЕРКА СУЩЕСТВУЮЩЕГО ПРЕДМЕТА У ЦЕЛИ (СТАКАНЬЕ)
        // Оружие и броня НИКОГДА не стакаются, независимо от настроек
        const canTypeStack = !['weapon', 'equipment'].includes(item.type);
        const actuallyShouldStack = shouldStackGlobal && canTypeStack;

        const existingItem = actuallyShouldStack 
          ? targetActor.items.find(i => i.name === item.name && i.type === item.type) 
          : null;

        if (existingItem) {
          // Предмет стакается - добавляем в массив обновлений
          const newQuantity = this.getItemQuantity(existingItem) + transferQuantity;
          itemsToUpdate.push({
            _id: existingItem.id,
            [this.mainManager.systemAdapter.getQuantityPath()]: newQuantity
          });
        } else {
          // Предмет не стакается - добавляем в массив создания
          const newItemData = item.toObject();
          if (foundry.utils.hasProperty(newItemData, 'system.quantity')) {
            newItemData.system.quantity = transferQuantity; // Устанавливаем именно СКОЛЬКО ПЕРЕДАЛИ
          }
          // Очищаем устаревшие флаги
          if (newItemData.flags?.core?.sourceId) {
            delete newItemData.flags.core.sourceId;
          }
          itemsToCreate.push(newItemData);
        }

        // 2. ОБНОВЛЕНИЕ ИСТОЧНИКА
        if (availableQuantity <= transferQuantity) {
          // Предмет забирается целиком - добавляем в массив удаления
          if (item && item.parent && sourceActor.items.has(item.id)) {
            itemsToDeleteIds.push(item.id);
          }
        } else {
          // Предмет забирается частично - добавляем в массив обновлений источника
          const newQuantity = availableQuantity - transferQuantity;
          sourceItemsToUpdate.push({
            _id: item.id,
            [this.mainManager.systemAdapter.getQuantityPath()]: newQuantity
          });
        }

        transferResults.push({ name: item.name, quantity: transferQuantity, success: true });
      } catch (error) {
        console.error(`THM | Transfer Error:`, error);
      }
    }

    // Выполняем массовые операции с БД
    try {
      if (itemsToCreate.length) {
        await targetActor.createEmbeddedDocuments('Item', itemsToCreate);
      }
      
      if (itemsToUpdate.length) {
        await targetActor.updateEmbeddedDocuments('Item', itemsToUpdate);
      }
      
      if (sourceItemsToUpdate.length) {
        await sourceActor.updateEmbeddedDocuments('Item', sourceItemsToUpdate);
      }
      
      if (itemsToDeleteIds.length) {
        await sourceActor.deleteEmbeddedDocuments('Item', itemsToDeleteIds);
      }
    } catch (error) {
      console.error('THM | Bulk operations error:', error);
    }

    await this.mainManager.socketManager.broadcast('updateHoard', { actorUuid: sourceActor.uuid, action: "inventory_refreshed" });
    return transferResults;
  }

  /**
   * Передача валюты между актерами
   */
  async transferCurrency(sourceActor, targetActor, currencies, userId) {
    // Нормализация: если передали TokenDocument, берем Actor
    sourceActor = sourceActor.actor || sourceActor;
    targetActor = targetActor.actor || targetActor;

    // Проверка прав GM - если не GM, перенаправляем через сокет
    if (!game.user.isGM) {
      return await this.mainManager.socketManager.executeAsGM('executeTransferAsGM', {
        sourceUuid: sourceActor.uuid,
        targetUuid: targetActor.uuid,
        itemIds: null,
        currency: currencies,
        userId
      });
    }
    
    console.log(`THM Item Manager | Transferring currency from ${sourceActor.name} to ${targetActor.name}`);
    
    try {
      const sourceCurrency = this.getActorCurrency(sourceActor);
      const targetCurrency = this.getActorCurrency(targetActor);
      
      // Проверка доступных средств
      const adapter = this.mainManager.systemAdapter;
      const configKeys = Object.keys(adapter.getCurrencyConfig());
      
      for (const [currency, amount] of Object.entries(currencies)) {
        const availableAmount = sourceCurrency[currency] || 0;
        const transferAmount = amount || availableAmount;
        
        if (transferAmount <= 0 || transferAmount > availableAmount) {
          console.warn(`THM Item Manager | Invalid amount for currency ${currency}: ${transferAmount}`);
          continue;
        }
        
        sourceCurrency[currency] = availableAmount - transferAmount;
        targetCurrency[currency] = (targetCurrency[currency] || 0) + transferAmount;
      }
      
      // Гарантируем наличие всех ключей
      for (const key of configKeys) {
        if (sourceCurrency[key] === undefined) sourceCurrency[key] = 0;
        if (targetCurrency[key] === undefined) targetCurrency[key] = 0;
      }
      
      // Обновление источников
      await adapter.updateActorCurrency(sourceActor, sourceCurrency);
      await adapter.updateActorCurrency(targetActor, targetCurrency);
      
      // Отправка уведомления через сокеты
      await this.mainManager.socketManager.broadcast('updateHoard', {
        actorUuid: sourceActor.uuid,
        action: "inventory_refreshed"
      });
      
      ui.notifications.info(`Валюта передана от ${sourceActor.name} к ${targetActor.name}`);
      
      return {
        success: true,
        currencies: currencies
      };
      
    } catch (error) {
      console.error(`THM Item Manager | Error transferring currency:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Создание предмета с настройками THM
   */
  async createTHMItem(itemData) {
    console.log(`THM Item Manager | Creating THM item: ${itemData.name}`);
    
    const baseItem = {
      name: itemData.name,
      type: itemData.type || 'loot',
      img: itemData.img || 'icons/svg/chest.svg',
      system: itemData.system || {}
    };
    
    // Добавление THM специфичных флагов
    const thmFlags = {
      [CONSTANTS.FLAGS.ITEM]: {
        basePrice: itemData.basePrice || 0,
        modifiers: itemData.modifiers || {},
        pricing: itemData.pricing || {},
        customCategory: itemData.customCategory || ''
      }
    };
    
    const item = new Item.implementation(mergeObject(baseItem, thmFlags));
    
    return item;
  }

  /**
   * Получение базовой цены предмета
   */
  async getBaseItemPrice(item) {
    return this.mainManager.systemAdapter.getBaseItemPrice(item);
  }

  /**
   * Обновление цены предмета
   */
  async updateItemPrice(item, priceData) {
    const currentFlags = item.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.ITEM) || {};
    
    const updatedFlags = {
      ...currentFlags,
      [CONSTANTS.FLAGS.ITEM]: {
        ...currentFlags[CONSTANTS.FLAGS.ITEM],
        basePrice: priceData.basePrice || currentFlags.basePrice,
        modifiers: priceData.modifiers || currentFlags.modifiers,
        pricing: priceData.pricing || currentFlags.pricing
      }
    };
    
    await item.update({
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.ITEM}`]: updatedFlags
    });
    
    ui.notifications.info(`Цена предмета ${item.name} обновлена`);
  }

  /**
   * Фильтрация предметов
   */
  filterItems(items, filters = {}) {
    return items.filter(item => {
      // Базовая фильтрация через системный адаптер
      if (!this.mainManager.systemAdapter.canItemBeInHoard(item)) {
        return false;
      }
      
      // Дополнительные фильтры
      if (filters.type && item.type !== filters.type) {
        return false;
      }
      
      if (filters.rarity && item.system?.rarity !== filters.rarity) {
        return false;
      }
      
      if (filters.name && item.name !== filters.name) {
        return false;
      }
      
      if (filters.minPrice && this.getItemPrice(item) < filters.minPrice) {
        return false;
      }
      
      if (filters.maxPrice && this.getItemPrice(item) > filters.maxPrice) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Сортировка предметов
   */
  sortItems(items, sortBy = 'name', ascending = true) {
    return items.sort((a, b) => {
      const aValue = this.getItemPrice(a);
      const bValue = this.getItemPrice(b);
      
      if (ascending) {
        return aValue < bValue ? -1 : 1;
      } else {
        return aValue > bValue ? -1 : 1;
      }
    });
  }

  /**
   * Поиск предметов по имени
   */
  searchItems(items, searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return items.filter(item => 
      item.name.toLowerCase().includes(lowerSearchTerm) ||
      (item.system?.description && item.system.description.toLowerCase().includes(lowerSearchTerm))
    );
  }
}
