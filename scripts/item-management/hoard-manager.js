/**
 * Treasure Hoard Manager - Hoard Manager
 * Управление кучами добычи
 */

import { CONSTANTS } from '../core/constants.js';

export class HoardManager {
  
  constructor(mainManager) {
    this.mainManager = mainManager;
  }

  /**
   * Создание кучи добычи из актера
   */
  async createHoard(actor, options = {}, token = null) {
    const defaultSettings = {
      enabled: true,
      interactionDistance: CONSTANTS.DEFAULTS.INTERACTION_DISTANCE,
      showItemCards: CONSTANTS.DEFAULTS.SHOW_ITEM_CARDS,
      deleteWhenEmpty: CONSTANTS.DEFAULTS.DELETE_WHEN_EMPTY,
      stackItems: CONSTANTS.DEFAULTS.STACK_ITEMS,
      autoLoot: true,
      visibilitySettings: {
        gmOnly: false,
        requiresProximity: true,
        revealOnSearch: true
      },
      itemFilters: {
        allowedTypes: ["weapon", "equipment", "consumable"],
        maxRarity: "rare",
        excludeIdentified: false
      },
      splitOptions: {
        equalSplit: true,
        randomSplit: false,
        prioritizeValue: true
      }
    };

    // Объединение с пользовательскими настройками
    const finalSettings = foundry.utils.mergeObject(defaultSettings, options);
    
    // Разделяем логику для unlinked token и linked actor
    const tokenToUpdate = token || actor.token;
    
    if (tokenToUpdate) {
      // Это unlinked token - работаем только с токеном и его синтетическим актером
      console.log(`THM Hoard Manager | Creating hoard for unlinked token: ${tokenToUpdate.name}`);
      
      // Устанавливаем флаги на токен
      const tokenFlags = {
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.TYPE}`]: CONSTANTS.PILE_TYPES.HOARD,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.ENABLED}`]: finalSettings.enabled,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.VERSION}`]: CONSTANTS.VERSION
      };
      
      if (tokenToUpdate.document) {
        await tokenToUpdate.document.update(tokenFlags);
      } else {
        await tokenToUpdate.update(tokenFlags);
      }
      
      // Устанавливаем флаги на синтетический актер токена
      if (tokenToUpdate.actor) {
        const syntheticActorUpdates = {
          [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.TYPE}`]: CONSTANTS.PILE_TYPES.HOARD,
          [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.ENABLED}`]: finalSettings.enabled,
          [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.VERSION}`]: CONSTANTS.VERSION,
          [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`]: {
            hoardName: tokenToUpdate.actor.name,
            isVisibleToPlayers: finalSettings.visibilitySettings.gmOnly,
            autoLoot: finalSettings.autoLoot,
            lootHistory: [],
            currentValue: 0,
            enabled: true
          },
          [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.SETTINGS}`]: {
            general: {
              interactionDistance: finalSettings.interactionDistance,
              showItemCards: finalSettings.showItemCards,
              deleteWhenEmpty: finalSettings.deleteWhenEmpty,
              stackItems: finalSettings.stackItems,
              reputationModule: finalSettings.reputationModule || CONSTANTS.DEFAULTS.REPUTATION_MODULE,
              timeModule: finalSettings.timeModule || CONSTANTS.DEFAULTS.TIME_MODULE,
              builtinReputation: finalSettings.builtinReputation || CONSTANTS.DEFAULTS.BUILTIN_REPUTATION
            },
            specific: {
              autoCollect: finalSettings.autoLoot,
              visibilitySettings: finalSettings.visibilitySettings,
              itemFilters: finalSettings.itemFilters,
              splitOptions: finalSettings.splitOptions
            }
          }
        };
        
        await tokenToUpdate.actor.update(syntheticActorUpdates);
      }
      
      // Обновляем внешний вид токена
      await this.updateTokenAppearance(tokenToUpdate, CONSTANTS.PILE_TYPES.HOARD);
      
    } else {
      // Это linked actor - работаем напрямую с актером
      console.log(`THM Hoard Manager | Creating hoard for linked actor: ${actor.name}`);
      
      const updates = {
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.TYPE}`]: CONSTANTS.PILE_TYPES.HOARD,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.ENABLED}`]: finalSettings.enabled,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.VERSION}`]: CONSTANTS.VERSION,
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`]: {
          hoardName: actor.name,
          isVisibleToPlayers: finalSettings.visibilitySettings.gmOnly,
          autoLoot: finalSettings.autoLoot,
          lootHistory: [],
          currentValue: 0,
          enabled: true
        },
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.SETTINGS}`]: {
          general: {
            interactionDistance: finalSettings.interactionDistance,
            showItemCards: finalSettings.showItemCards,
            deleteWhenEmpty: finalSettings.deleteWhenEmpty,
            stackItems: finalSettings.stackItems,
            reputationModule: finalSettings.reputationModule || CONSTANTS.DEFAULTS.REPUTATION_MODULE,
            timeModule: finalSettings.timeModule || CONSTANTS.DEFAULTS.TIME_MODULE,
            builtinReputation: finalSettings.builtinReputation || CONSTANTS.DEFAULTS.BUILTIN_REPUTATION
          },
          specific: {
            autoCollect: finalSettings.autoLoot,
            visibilitySettings: finalSettings.visibilitySettings,
            itemFilters: finalSettings.itemFilters,
            splitOptions: finalSettings.splitOptions
          }
        }
      };

      await actor.update(updates);
    }
    
    ui.notifications.info(`Куча добычи "${actor.name}" создана успешно`);
    
    return {
      success: true,
      hoard: actor,
      settings: finalSettings
    };
  }

  /**
   * Обновление внешнего вида токена
   */
  async updateTokenAppearance(token, hoardType) {
    // Используем оригинальное изображение токена, не меняем его
    const iconPath = token.document ? token.document.texture.src : token.texture.src;
    
    // Проверяем тип токена и используем правильный метод обновления
    if (token.document) {
      // Это Token (объект на сцене) - обновляем через документ
      await token.document.update({
        scale: 1.0,
        mirrorX: false,
        mirrorY: false
      });
    } else if (token.update) {
      // Это TokenDocument - обновляем напрямую
      await token.update({
        scale: 1.0,
        mirrorX: false,
        mirrorY: false
      });
    }
  }

  /**
   * Вычисляет расстояние между токенами с учетом их размеров (по принципу Item Piles)
   * @param {Token} tokenA - Первый токен
   * @param {Token} tokenB - Второй токен
   * @returns {number} Расстояние в клетках
   */
  _getTokenDistance(tokenA, tokenB) {
    // Получаем прямоугольные области токенов с поддержкой разных типов
    const rectA = {
      x: tokenA.x,
      y: tokenA.y,
      w: (tokenA.document?.width || tokenA.width) * canvas.grid.size,
      h: (tokenA.document?.height || tokenA.height) * canvas.grid.size
    };
    
    const rectB = {
      x: tokenB.x,
      y: tokenB.y,
      w: (tokenB.document?.width || tokenB.width) * canvas.grid.size,
      h: (tokenB.document?.height || tokenB.height) * canvas.grid.size
    };
    
    console.log(`THM | Token A rect:`, rectA);
    console.log(`THM | Token B rect:`, rectB);
    
    // Вычисляем минимальное расстояние между прямоугольниками
    const distance = this._distanceBetweenRects(rectA, rectB);
    
    // Конвертируем в клетки и добавляем 1 (как в Item Piles)
    return Math.floor(distance / canvas.grid.size) + 1;
  }

  /**
   * Вычисляет минимальное расстояние между двумя прямоугольниками
   * @param {Object} rect1 - Первый прямоугольник {x, y, w, h}
   * @param {Object} rect2 - Второй прямоугольник {x, y, w, h}
   * @returns {number} Минимальное расстояние
   */
  _distanceBetweenRects(rect1, rect2) {
    const x1 = rect1.x;
    const y1 = rect1.y;
    const x1b = rect1.x + rect1.w;
    const y1b = rect1.y + rect1.h;
    const x2 = rect2.x;
    const y2 = rect2.y;
    const x2b = rect2.x + rect2.w;
    const y2b = rect2.y + rect2.h;
    
    const left = x2b < x1;
    const right = x1b < x2;
    const bottom = y2b < y1;
    const top = y1b < y2;
    
    if (top && left) {
      return this._distanceBetweenPoints({ x: x1, y: y1b }, { x: x2b, y: y2 });
    } else if (left && bottom) {
      return this._distanceBetweenPoints({ x: x1, y: y1 }, { x: x2b, y: y2b });
    } else if (bottom && right) {
      return this._distanceBetweenPoints({ x: x1b, y: y1 }, { x: x2, y: y2b });
    } else if (right && top) {
      return this._distanceBetweenPoints({ x: x1b, y: y1b }, { x: x2, y: y2 });
    } else if (left) {
      return x1 - x2b;
    } else if (right) {
      return x2 - x1b;
    } else if (bottom) {
      return y1 - y2b;
    } else if (top) {
      return y2 - y1b;
    }
    
    return 0; // Пересекаются
  }

  /**
   * Вычисляет расстояние между двумя точками
   * @param {Object} pointA - Первая точка {x, y}
   * @param {Object} pointB - Вторая точка {x, y}
   * @returns {number} Расстояние
   */
  _distanceBetweenPoints(pointA, pointB) {
    return new Ray(pointA, pointB).distance;
  }

  /**
   * Проверка может ли пользователь взаимодействовать с кучей
   */
  canInteract(actor, user) {
    if (!this.mainManager.isValidHoard(actor)) {
      return { allowed: false, reason: 'Не является кучей добычи THM' };
    }
    
    // Получаем настройки - сначала из токена, потом из актера
    let settings = null;
    
    // Если это TokenDocument, получаем флаги напрямую из него
    if (actor instanceof TokenDocument) {
      settings = actor.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);
      console.log(`THM | Settings from TokenDocument:`, settings);
    } 
    // Если это Actor, пробуем получить из токена на сцене
    else if (actor instanceof Actor && actor.token) {
      settings = actor.token.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);
      console.log(`THM | Settings from actor.token:`, settings);
    }
    
    // Fallback на актера
    if (!settings) {
      settings = actor.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);
      console.log(`THM | Settings from actor fallback:`, settings);
    }
    
    const generalSettings = settings?.general || {};
    console.log(`THM | General settings:`, generalSettings);
    console.log(`THM | Interaction distance from settings:`, generalSettings.interactionDistance);
    
    // Проверка расстояния (по принципу Item Piles с учетом размеров токенов)
    if (generalSettings.interactionDistance && generalSettings.interactionDistance > 0) {
      // Получаем реальный токен игрока на сцене
      let userToken = null;
      if (user.character) {
        userToken = canvas.tokens.placeables.find(token => token.actor === user.character);
      }
      
      // Если нет выбранного персонажа, пробуем взять контролируемый токен
      if (!userToken && canvas.tokens.controlled.length > 0) {
        userToken = canvas.tokens.controlled[0];
      }
      
      // Получаем токен кучи - если это TokenDocument, ищем по UUID
      let hoardToken = null;
      if (actor instanceof TokenDocument) {
        hoardToken = canvas.tokens.placeables.find(token => token.document === actor);
      } else {
        hoardToken = actor.token || canvas.tokens.placeables.find(token => token.actor === actor);
      }
      
      if (!userToken || !hoardToken) {
        return { allowed: false, reason: 'Нет токена у пользователя или у кучи' };
      }
      
      console.log(`THM | Distance check: User token at (${userToken.x}, ${userToken.y}), Hoard token at (${hoardToken.x}, ${hoardToken.y})`);
      console.log(`THM | Actor type: ${actor.constructor.name}, Hoard token type: ${hoardToken.constructor.name}`);
      
      // Используем продвинутый метод как в Item Piles
      const distance = this._getTokenDistance(userToken, hoardToken);
      
      console.log(`THM | Calculated distance: ${distance} cells, required: ${generalSettings.interactionDistance} cells`);
      
      if (distance > generalSettings.interactionDistance) {
        return { 
          allowed: false, 
          reason: `Слишком далеко. Требуемое расстояние: ${generalSettings.interactionDistance} клеток` 
        };
      }
    }
    
    // Проверка видимости
    const visibilitySettings = settings?.specific?.visibilitySettings;
    if (visibilitySettings?.gmOnly && !user.isGM) {
      return { allowed: false, reason: 'Только GM может видеть эту кучу' };
    }
    
    return { allowed: true };
  }

  /**
   * Автоматический сбор добычи
   */
  async autoLoot(actor, user) {
    console.log(`THM Hoard Manager | Auto looting ${actor.name} by ${user.name}`);
    
    const interactionCheck = this.canInteract(actor, user);
    if (!interactionCheck.allowed) {
      ui.notifications.warn(interactionCheck.reason);
      return { success: false, reason: interactionCheck.reason };
    }
    
    // Получение всех предметов из кучи
    const items = actor.items.contents;
    const currencies = this.mainManager.systemAdapter.getActorCurrency(actor);
    
    // Проверка инвентаря пользователя
    const userActor = user.character;
    if (!userActor) {
      return { success: false, reason: 'Нет персонажа у пользователя' };
    }
    
    // Расчет общей стоимости для логирования
    let totalValue = 0;
    for (const item of items) {
      const price = this.mainManager.systemAdapter.getItemPrice(item);
      totalValue += price * this.mainManager.systemAdapter.getItemQuantity(item);
    }
    
    // Передача предметов пользователю
    const transferResults = [];
    
    try {
      // Передача предметов
      for (const item of items) {
        if (this.canTransferItem(item)) {
          await userActor.createEmbeddedDocuments('Item', [item.toObject()]);
          transferResults.push({
            type: 'item',
            name: item.name,
            quantity: this.mainManager.systemAdapter.getItemQuantity(item),
            success: true
          });
        }
      }
      
      // Передача валюты
      if (currencies && Object.values(currencies).some(v => v > 0)) {
        await userActor.update({
          'system.currency': currencies
        });
        transferResults.push({
          type: 'currency',
          currencies: currencies,
          success: true
        });
      }
      
      // Обновление истории
      await this.updateLootHistory(actor, user, transferResults, totalValue);
      
      // Проверка на удаление пустой кучи
      const settings = actor.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);
      if (settings?.general?.deleteWhenEmpty && items.length === 0) {
        await actor.delete();
        ui.notifications.info(`Куча "${actor.name}" удалена (пустая)`);
      }
      
      return {
        success: true,
        transferred: transferResults,
        totalValue: totalValue
      };
      
    } catch (error) {
      console.error('THM Hoard Manager | Auto loot error:', error);
      return {
        success: false,
        error: error.message,
        transferred: transferResults
      };
    }
  }

  /**
   * Проверка можно ли передать предмет
   */
  canTransferItem(item) {
    // Проверка через системный адаптер
    return this.mainManager.systemAdapter.canItemBeInHoard(item);
  }

  /**
   * Обновление истории добычи
   */
  async updateLootHistory(actor, user, transferredItems, totalValue) {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      items: transferredItems,
      totalValue: totalValue
    };
    
    const currentHistory = actor.getFlag(CONSTANTS.MODULE_NAME, 'data.lootHistory') || [];
    const updatedHistory = [historyEntry, ...currentHistory].slice(0, 49); // Храним последние 50 записей
    
    await actor.update({
      [`flags.${CONSTANTS.MODULE_NAME}.data.lootHistory`]: updatedHistory,
      [`flags.${CONSTANTS.MODULE_NAME}.data.currentValue`]: totalValue
    });
  }

  /**
   * Разделение добычи между игроками
   */
  async splitLoot(actor, users, splitOptions = {}) {
    console.log(`THM Hoard Manager | Splitting ${actor.name} between ${users.length} users`);
    
    const items = actor.items.contents;
    const currencies = this.mainManager.systemAdapter.getActorCurrency(actor);
    
    if (items.length === 0 && Object.values(currencies).every(v => v === 0)) {
      ui.notifications.warn('Нечего делить - куча пуста');
      return { success: false, reason: 'Куча пуста' };
    }
    
    const defaultSplitOptions = {
      equalSplit: true,
      randomSplit: false,
      prioritizeValue: true
    };
    
    const finalSplitOptions = mergeObject(defaultSplitOptions, splitOptions);
    
    // Расчет разделения
    const splitResult = this.calculateSplit(items, currencies, users, finalSplitOptions);
    
    // Выполнение разделения
    const transferResults = [];
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userActor = user.character;
      
      if (!userActor) {
        ui.notifications.warn(`У пользователя ${user.name} нет персонажа`);
        continue;
      }
      
      const userItems = splitResult.items[i] || [];
      const userCurrencies = splitResult.currencies[i] || {};
      
      // Передача предметов
      if (userItems.length > 0) {
        await userActor.createEmbeddedDocuments('Item', userItems);
        transferResults.push({
          userId: user.id,
          userName: user.name,
          items: userItems,
          currencies: userCurrencies
        });
      }
      
      // Передача валюты
      if (Object.values(userCurrencies).some(v => v > 0)) {
        await userActor.update({
          'system.currency': userCurrencies
        });
      }
    }
    
    // Очистка кучи после разделения
    await actor.updateEmbeddedDocuments('Item', []);
    await actor.update({
      'system.currency': {
        pp: 0, gp: 0, ep: 0, sp: 0, cp: 0
      }
    });
    
    // Отправка уведомлений
    this.sendSplitNotifications(actor, transferResults);
    
    return {
      success: true,
      split: transferResults
    };
  }

  /**
   * Расчет разделения добычи
   */
  calculateSplit(items, currencies, users, options) {
    const result = {
      items: [],
      currencies: []
    };
    
    if (options.equalSplit) {
      // Равномерное разделение
      const itemsPerUser = Math.floor(items.length / users.length);
      const currenciesPerUser = {};
      
      // Разделение предметов
      for (let i = 0; i < users.length; i++) {
        const startIndex = i * itemsPerUser;
        const endIndex = (i === users.length - 1) ? items.length : (i + 1) * itemsPerUser;
        
        result.items[i] = items.slice(startIndex, endIndex).map(item => item.toObject());
      }
      
      // Разделение валюты
      for (const [currency, amount] of Object.entries(currencies)) {
        const amountPerUser = Math.floor(amount / users.length);
        currenciesPerUser[currency] = amountPerUser;
      }
      
      result.currencies = Array(users.length).fill(currenciesPerUser);
    }
    
    return result;
  }

  /**
   * Отправка уведомлений о разделе
   */
  sendSplitNotifications(actor, transferResults) {
    for (const transfer of transferResults) {
      const message = `
        <div class="thm-split-notification">
          <p><strong>${transfer.userName}</strong> получил из кучи <strong>${actor.name}:</strong></p>
          <ul>
            ${transfer.items.map(item => `<li>${item.name} (${item.quantity || 1})</li>`).join('')}
          </ul>
          ${Object.entries(transfer.currencies).map(([curr, amount]) => 
            amount > 0 ? `<li>${amount} ${curr}</li>` : ''
          ).join('')}
        </div>
      `;
      
      ChatMessage.create({
        content: message,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });
    }
  }

  /**
   * Получение информации о куче
   */
  getHoardInfo(actor) {
    if (!this.mainManager.isValidHoard(actor)) {
      return null;
    }
    
    const flags = actor.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS);
    const data = flags?.data || {};
    const settings = flags?.settings || {};
    
    return {
      type: flags.type,
      name: actor.name,
      enabled: flags.enabled,
      data: data,
      settings: settings,
      items: actor.items.contents,
      currencies: this.mainManager.systemAdapter.getActorCurrency(actor),
      totalValue: data.currentValue || 0,
      lootHistory: data.lootHistory || []
    };
  }
}
