/**
 * Treasure Hoard Manager - Socket Manager
 * Управление сокетным взаимодействием между клиентами
 */

import { CONSTANTS } from '../core/constants.js';
import { logger } from '../core/simple-logger.js';

export class SocketManager {

  constructor(mainManager) {
    this.mainManager = mainManager;
    this.socket = null;
    this.ready = false;
    this.handlers = new Map();
  }

  /**
   * Инициализация сокетного менеджера
   */
  async init() {
    logger.info('Инициализация Socket Manager...');

    if (!game.modules.get('socketlib')?.active) {
      logger.error('Treasure Hoard Manager требует модуль socketlib');
      throw new Error('Treasure Hoard Manager требует модуль socketlib');
    }

    logger.debug('THM Socket Manager | Initializing socketlib...');
    logger.debug('THM Socket Manager | socketlib available:', !!socketlib);
    logger.debug('THM Socket Manager | CONSTANTS.MODULE_NAME:', CONSTANTS.MODULE_NAME);

    try {
      // Регистрация модуля
      this.socket = socketlib.registerModule(CONSTANTS.MODULE_NAME);
      logger.info('THM Socket Manager | Socket registered successfully');
      logger.debug('THM Socket Manager | Socket object:', this.socket);

      if (!this.socket) {
        logger.error('THM Socket Manager | Failed to register socket');
        throw new Error('Failed to register socket');
      }

      // Проверяем наличие методов
      logger.debug('THM Socket Manager | Checking socket methods...');
      logger.debug('THM Socket Manager | executeAsGM available:', typeof this.socket.executeAsGM);
      logger.debug('THM Socket Manager | executeForAllGMs available:', typeof this.socket.executeForAllGMs);
      logger.debug('THM Socket Manager | executeForEveryone available:', typeof this.socket.executeForEveryone);

    } catch (error) {
      logger.error('THM Socket Manager | Error registering socket:', error);
      throw error;
    }

    // Регистрация обработчиков
    this.registerHandlers();

    this.ready = true;
    logger.info('THM Socket Manager | Socket initialized successfully via socketlib');

    return true;
  }

  /**
   * Регистрация всех обработчиков сокетов
   */
  registerHandlers() {
    // Основные операции с предметами
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.LOOT_ALL, this.handleLootAll.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.LOOT_ITEM, this.handleLootItem.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.LOOT_CURRENCY, this.handleLootCurrency.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.UPDATE_HOARD, this.handleUpdateHoard.bind(this));

    // Сокеты Чёрного Рынка
    this.registerHandler('purchaseBlackMarketService', async (data) => {
      if (!game.user.isGM) return;
      return await this.mainManager.blackMarketManager.processServicePurchase(data);
    });

    this.registerHandler('buyExclusiveItem', async (data) => {
      if (!game.user.isGM) return;
      return await this.mainManager.blackMarketManager.processExclusivePurchase(data);
    });

    // Трансфер от лица игрока
    this.registerHandler('executeTransferAsGM', this.handleExecuteTransfer.bind(this));

    // Интерфейсы
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.RENDER_INTERFACE, this.handleRenderInterface.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.UNRENDER_INTERFACE, this.handleUnrenderInterface.bind(this));

    // Drop to scene functionality
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.CREATE_LOOT_PILE, this.handleCreateLootPile.bind(this));

    // Торговля
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.TRADE_REQUEST, this.handleTradeRequest.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.TRADE_RESPONSE, this.handleTradeResponse.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.TRADE_UPDATE, this.handleTradeUpdate.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.TRADE_CONFIRM, this.handleTradeConfirm.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.TRADE_RESET, this.handleTradeReset.bind(this));
    this.registerHandler(CONSTANTS.SOCKET_HOOKS.TRADE_COMPLETE, this.handleTradeComplete.bind(this));
    this.registerHandler('executeTradeAsGM', this.handleExecuteTradeAsGM.bind(this));

    // Обновление денег актера
    this.registerHandler('updateActorCurrency', this.handleUpdateActorCurrency.bind(this));
    this.registerHandler('spendWealthAsGM', this.handleSpendWealthAsGM.bind(this));

    logger.info('THM Socket Manager | All handlers registered via socketlib');
  }

  /**
   * Регистрация обработчика
   */
  registerHandler(name, handler) {
    this.handlers.set(name, handler);
    this.socket.register(name, handler);
    logger.debug(`THM Socket Manager | Registered handler: ${name}`);
  }

  /**
   * Обработчик забора предмета
   */
  async handleLootItem(data) {
    try {
      const { containerUuid, itemId, looterUuid, userId } = data;

      if (!game.user.isGM) return;

      const container = await fromUuid(containerUuid);
      const looter = await fromUuid(looterUuid);

      if (!container || !looter) {
        console.warn('THM Socket | Invalid actors in loot item:', { containerUuid, looterUuid });
        return;
      }

      const item = container.items.get(itemId);
      if (!item) {
        console.warn('THM Socket | Item not found:', itemId);
        return;
      }

      // Перемещаем предмет
      await container.deleteEmbeddedDocuments('Item', [item.id]);
      await looter.createEmbeddedDocuments('Item', [item.toObject()]);

      // Отправляем подтверждение игроку
      await this.sendToUser(userId, 'socketEvent', {
        type: 'lootItemSuccess',
        data: { userId }
      });

      console.log(`THM Socket | Item looted: ${item.name} by ${looter.name}`);

    } catch (error) {
      console.error('THM Socket | Error in loot item handler:', error);
      throw error;
    }
  }

  /**
   * Обработчик забора всех предметов
   */
  async handleLootAll(data) {
    try {
      logger.info('THM Socket | Processing loot all request:', data);

      const { containerUuid, looterUuid, userId } = data;

      // Получаем актеров
      const container = await fromUuid(containerUuid);
      const looter = await fromUuid(looterUuid);

      if (!container || !looter) {
        throw new Error('Контейнер или игрок не найден');
      }

      // Проверяем права GM
      if (!game.user.isGM) {
        throw new Error('Только GM может обрабатывать запросы на лут');
      }

      // 1. ЗАБИРАЕМ ПРЕДМЕТЫ
      const items = container.items.map(item => item.toObject());

      if (items.length > 0) {
        // Перемещаем все предметы игроку
        await looter.createEmbeddedDocuments('Item', items);
        await container.deleteEmbeddedDocuments('Item', container.items.map(i => i.id));
      }

      // 2. ЗАБИРАЕМ ВАЛЮТУ (с учетом настроек деления)
      await this._processCurrencyLoot(container, looter, userId);

      // Отправляем подтверждение игроку
      await this.sendToUser(userId, 'socketEvent', {
        type: 'lootItemSuccess',
        data: { userId }
      });

      logger.info(`THM Socket | Loot all completed for ${looter.name}`);

    } catch (error) {
      logger.error('THM Socket | Error in loot all handler:', error);
      throw error;
    }
  }

  /**
   * Обработчик забора валюты
   */
  async handleLootCurrency(data) {
    try {
      logger.info('THM Socket | Processing loot currency request:', data);

      const { containerUuid, looterUuid, userId } = data;

      // Получаем актеров
      const container = await fromUuid(containerUuid);
      const looter = await fromUuid(looterUuid);

      if (!container || !looter) {
        throw new Error('Контейнер или игрок не найден');
      }

      // Проверяем права GM
      if (!game.user.isGM) {
        throw new Error('Только GM может обрабатывать запросы на лут');
      }

      // Обрабатываем валюту с учетом настроек
      await this._processCurrencyLoot(container, looter, userId);

      // Отправляем подтверждение игроку
      await this.sendToUser(userId, 'socketEvent', {
        type: 'lootCurrencySuccess',
        data: { userId }
      });

      logger.info(`THM Socket | Currency loot processed by ${looter.name}`);

    } catch (error) {
      logger.error('THM Socket | Error in loot currency handler:', error);
      throw error;
    }
  }

  /**
   * Вспомогательный метод для обработки сбора валюты с учетом настроек деления
   */
  async _processCurrencyLoot(container, looter, userId) {
    const adapter = this.mainManager.systemAdapter;
    const currencyPath = adapter.getCurrencyPath();

    // Получаем валюту контейнера
    const containerCurrency = adapter.getActorCurrency(container);
    const hasCurrency = containerCurrency && Object.values(containerCurrency).some(v => v > 0);

    if (!hasCurrency) return;

    // Читаем настройки деления из контейнера
    const settings = container.getFlag(CONSTANTS.MODULE_NAME, 'settings') || {};
    const equalSplit = settings.specific?.splitOptions?.equalSplit ?? true;

    const configKeys = Object.keys(adapter.getCurrencyConfig ? adapter.getCurrencyConfig() : { cp: {}, sp: {}, ep: {}, gp: {}, pp: {} });

    if (equalSplit) {
      // РЕЖИМ ДЕЛЕНИЯ: Делим между всеми активными игроками с персонажами
      const activePlayers = game.users.filter(u => u.active && u.character);
      const participantCount = activePlayers.length || 1;

      logger.info(`THM Socket | Splitting currency between ${participantCount} active players`);

      for (const player of activePlayers) {
        const playerActor = player.character;
        const playerCurrency = adapter.getActorCurrency(playerActor);
        const newCurrency = { ...playerCurrency };
        let hasUpdates = false;

        for (const key of configKeys) {
          const amount = containerCurrency[key] || 0;
          if (amount <= 0) continue;

          const share = Math.floor(amount / participantCount);
          if (share > 0) {
            newCurrency[key] = (newCurrency[key] || 0) + share;
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          await adapter.updateActorCurrency(playerActor, newCurrency);
        }
      }

      // Очищаем валюту в контейнере
      const emptyCurrency = {};
      for (const key of configKeys) emptyCurrency[key] = 0;
      await adapter.updateActorCurrency(container, emptyCurrency);

      // Оповещение в чат о делении
      ChatMessage.create({
        content: `
          <div class="thm-split-chat-card" style="background: rgba(20, 20, 20, 0.9); border: 1px solid #c9aa71; border-radius: 8px; padding: 15px; color: #f0ebe0; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; border-bottom: 1px solid rgba(201, 170, 113, 0.3); padding-bottom: 8px;">
               <i class="fas fa-coins" style="color: #f1c40f; font-size: 1.4em; text-shadow: 0 0 5px rgba(241, 196, 15, 0.5);"></i>
               <h4 style="margin: 0; color: #c9aa71; font-family: 'Modesto Condensed', 'Palatino Linotype', serif; font-size: 1.5em; letter-spacing: 1px;">ЗОЛОТО РАЗДЕЛЕНО</h4>
            </div>
            <div style="font-size: 1.05em; line-height: 1.5; margin-bottom: 10px;">
              Содержимое <strong>${container.name}</strong> было поровну распределено между <strong>${participantCount}</strong> искателями приключений.
            </div>
            <div style="display: flex; justify-content: flex-end; font-size: 0.85em; opacity: 0.6; font-style: italic;">
              — Treasure Hoard Manager —
            </div>
          </div>
        `,
        speaker: { alias: "Система добычи" }
      });

    } else {
      // РЕЖИМ "ВСЁ ОДНОМУ": Отдаем всё тому, кто залутал
      const looterCurrency = adapter.getActorCurrency(looter);
      const newLooterCurrency = { ...looterCurrency };
      const emptyCurrency = {};

      for (const key of configKeys) {
        const amount = containerCurrency[key] || 0;
        newLooterCurrency[key] = (newLooterCurrency[key] || 0) + amount;
        emptyCurrency[key] = 0;
      }

      await adapter.updateActorCurrency(looter, newLooterCurrency);
      await adapter.updateActorCurrency(container, emptyCurrency);
    }
  }

  /**
   * Обработчик рендера интерфейса
   */
  async handleRenderInterface(data) {
    try {
      const { actorUuid, userIds } = data;

      if (!game.user.isGM) return;

      const actor = await fromUuid(actorUuid);
      if (!actor) return;

      // Отправляем команду на рендеринг указанным пользователям
      for (const userId of userIds) {
        await this.sendToUser(userId, CONSTANTS.SOCKET_HOOKS.RENDER_INTERFACE, { actorUuid });
      }

    } catch (error) {
      logger.error('THM Socket | Error in render interface handler:', error);
    }
  }

  /**
   * Обработчик закрытия интерфейса
   */
  async handleUnrenderInterface(data) {
    try {
      const { actorUuid, userIds } = data;

      if (!game.user.isGM) return;

      // Отправляем команду на закрытие указанным пользователям
      for (const userId of userIds) {
        await this.sendToUser(userId, 'socketEvent', {
          type: 'unrenderInterface',
          data: { actorUuid }
        });
      }

    } catch (error) {
      logger.error('THM Socket | Error in unrender interface handler:', error);
    }
  }

  /**
   * Обработчик обновления хранилища/магазина
   */
  async handleUpdateHoard(data) {
    try {
      const { actorUuid, action } = data;

      logger.info(`THM Socket | Processing update hoard: ${action} for ${actorUuid}`);

      const actor = await fromUuid(actorUuid);
      if (!actor) {
        logger.warn(`THM Socket | Actor not found: ${actorUuid}`);
        return;
      }

      // DEBOUNCE: Небольшая задержка чтобы данные успели обновиться в базе данных Foundry
      setTimeout(() => {
        // Обновляем все открытые интерфейсы для этого актера
        Object.values(ui.windows).forEach(window => {
          if (window.actor && window.actor.id === actor.id) {
            window.render();
          }
        });

        logger.info(`THM Socket | Updated interfaces for ${actor.name}`);
      }, 100); // 100ms задержка

    } catch (error) {
      logger.error('THM Socket | Error in update hoard handler:', error);
    }
  }

  /**
   * Отправка сообщения конкретному пользователю
   */
  async sendToUser(userId, handlerName, data) {
    if (!this.ready) return;

    try {
      // Используем сокет из бэкапа
      await this.socket.executeAsUser(handlerName, userId, data);
      logger.debug(`THM Socket | Sent ${handlerName} to user ${userId}`);
    } catch (error) {
      logger.error(`THM Socket | Failed to send ${handlerName} to user ${userId}:`, error);
    }
  }

  /**
   * Отправка сообщения нескольким пользователям
   */
  async executeForUsers(handlerName, userIds, data) {
    if (!this.ready) return;

    try {
      // Отправляем сообщение каждому указанному пользователю
      for (const userId of userIds) {
        await this.socket.executeAsUser(handlerName, userId, data);
      }
      logger.debug(`THM Socket | Sent ${handlerName} to users: ${userIds.join(', ')}`);
    } catch (error) {
      logger.error('THM Socket | Error in executeForUsers:', error);
    }
  }

  /**
   * Отправка сообщения всем пользователям
   */
  async broadcast(eventName, data) {
    logger.debug(`THM Socket Manager | Broadcasting ${eventName} to all users`);
    return await this.socket.executeForEveryone(eventName, data);
  }

  /**
   * Выполнение от имени GM (одного)
   */
  async executeAsGM(handlerName, data) {
    if (!this.ready) {
      logger.error('THM Socket | Socket manager not ready');
      return;
    }

    if (!this.socket) {
      logger.error('THM Socket | Socket not initialized');
      return;
    }

    try {
      // Выполняем обработчик от имени GM
      return await this.socket.executeAsGM(handlerName, data);
    } catch (error) {
      logger.error(`THM Socket | Failed to execute ${handlerName} as GM:`, error);
      throw error;
    }
  }

  /**
   * Выполнение на всех GM клиентах (fallback к executeAsGM если нет множественного метода)
   */
  async executeForGM(handlerName, data) {
    if (!this.ready || !this.socket) {
      logger.error('THM Socket | Socket manager not ready or socket not initialized');
      return;
    }

    try {
      // Пытаемся вызвать executeForAllGMs (стандарт socketlib), если нет - используем executeAsGM
      const method = this.socket.executeForAllGMs || this.socket.executeAsGM;
      return await method.call(this.socket, handlerName, data);
    } catch (error) {
      logger.error(`THM Socket | Failed to execute ${handlerName} for GM:`, error);
      throw error;
    }
  }

  /**
   * Обработчик выполнения трансфера от лица игрока
   */
  async handleExecuteTransfer(data) {
    try {
      if (!game.user.isGM) return;

      const { sourceUuid, targetUuid, items, currency, userId } = data;

      const sourceActor = await fromUuid(sourceUuid);
      const targetActor = await fromUuid(targetUuid);

      if (!sourceActor || !targetActor) return;

      // Выполняем трансфер ПРЕДМЕТОВ (передаем массив объектов)
      if (items && items.length > 0) {
        await this.mainManager.itemManager.transferItems(sourceActor, targetActor, items);
      }

      // Выполняем трансфер ВАЛЮТЫ
      if (currency && Object.keys(currency).some(key => currency[key] > 0)) {
        await this.mainManager.itemManager.transferCurrency(sourceActor, targetActor, currency);
      }

      if (userId) {
        await this.sendToUser(userId, 'socketEvent', {
          type: 'transferSuccess',
          data: { sourceUuid, targetUuid }
        });
      }
    } catch (error) {
      logger.error('THM Socket | Error in executeTransfer handler:', error);
    }
  }

  /**
   * Обработчик запроса на торговлю
   */
  async handleTradeRequest(data) {
    try {
      const { tradeId, fromUser, fromUserName, toUser, toUserName, actor, actorName, tradeData } = data;

      logger.info(`THM Socket | Trade request received: ${tradeId} from ${fromUserName}`);

      // Получаем реальные ОБЪЕКТЫ по их ID/UUID, чтобы диалог мог прочитать их .name
      const senderUser = game.users.get(fromUser) || { name: fromUserName };
      const senderActor = await fromUuid(actor) || { name: actorName };

      // Сохраняем трейд на стороне получателя
      this.mainManager.tradeManager.activeTrades.set(tradeId, tradeData);

      // Передаем объекты в диалог
      await this.mainManager.tradeManager._showTradeRequestDialog(tradeId, senderUser, game.user, senderActor);

    } catch (error) {
      logger.error('THM Socket | Error in handleTradeRequest:', error);
    }
  }

  /**
   * Обработчик ответа на запрос торговли
   */
  async handleTradeResponse(data) {
    try {
      const { tradeId, response, userId, tradeData } = data;

      logger.info(`THM Socket | Trade response received: ${tradeId} - ${response}`);

      // Если есть данные трейда, синхронизируем их и открываем интерфейс
      if (tradeData) {
        this.mainManager.tradeManager.activeTrades.set(tradeId, tradeData);

        if (response === 'accepted') {
          // Открываем интерфейс торговли у отправителя
          await this.mainManager.tradeManager.openTradeInterface(tradeId);
        } else {
          // Удаляем трейд у отправителя
          this.mainManager.tradeManager.activeTrades.delete(tradeId);
        }
      }

    } catch (error) {
      logger.error('THM Socket | Error in handleTradeResponse:', error);
    }
  }

  /**
   * Обработчик обновления торговли
   */
  async handleTradeUpdate(data) {
    try {
      const { action, tradeId, trade, playerSide, item } = data;

      if (action === 'open') {
        // Открываем интерфейс торговли
        await this.mainManager.uiManager.showTradeInterface(tradeId);
      } else if (action === 'addItem') {
        // Добавляем предмет в торговлю
        await this.mainManager.tradeManager.addItemToTrade(tradeId, playerSide, item);
      } else if (action === 'removeItem') {
        // Удаляем предмет из торговли
        await this.mainManager.tradeManager.removeItemFromTrade(tradeId, playerSide, item.id);
      } else if (action === 'update') {
        // Обновляем данные в открытом интерфейсе
        this.mainManager.tradeManager.activeTrades.set(tradeId, trade);

        const tradeWindow = Object.values(ui.windows).find(w =>
          w.constructor.name === 'TradeInterface' && w.tradeId === tradeId
        );

        if (tradeWindow) {
          await tradeWindow.updateTrade(trade);
        }
      } else if (action === 'setCurrency') {
        // Устанавливаем валюту в торговле
        await this.mainManager.tradeManager.setCurrencyInTrade(tradeId, data.playerSide, data.amountAtoms);
      }

      logger.info(`THM Socket | Trade update received: ${tradeId} - ${action}`);
    } catch (error) {
      logger.error('THM Socket | Error in handleTradeUpdate:', error);
    }
  }

  /**
   * Обработчик подтверждения торговли
   */
  handleTradeConfirm(data) {
    this.mainManager.tradeManager._onRemoteTradeConfirm(data);
  }

  /**
   * Обработчик сброса торговли
   */
  handleTradeReset(data) {
    this.mainManager.tradeManager._onRemoteTradeReset(data);
  }

  /**
   * Обработчик завершения торговли
   */
  handleTradeComplete(data) {
    this.mainManager.tradeManager._onRemoteTradeComplete(data);
  }

  /**
   * Выполнение торговли от лица GM
   */
  async handleExecuteTradeAsGM(data) {
    await this.mainManager.tradeManager.executeTrade(data.tradeId, data.tradeData);
  }

  /**
   * Обновление денег актера (через сокет от лица GM)
   */
  async handleUpdateActorCurrency(data) {
    if (!game.user.isGM) return;
    
    const { actorUuid, currency } = data;
    const document = await fromUuid(actorUuid);
    
    // Поддержка как Actor, так и TokenDocument
    const actor = document.actor || document;
    
    if (actor && actor.update) {
      const adapter = this.mainManager.systemAdapter;
      await adapter.updateActorCurrency(actor, currency);
      logger.info(`THM Socket | Currency updated for ${actor.name}`);
    } else {
      logger.error('THM Socket | Failed to find valid actor for currency update:', actorUuid);
    }
  }

  /**
   * Умное списание денег актера (через сокет от лица GM)
   */
  async handleSpendWealthAsGM(data) {
    if (!game.user.isGM) return;
    
    const { actorUuid, amount } = data;
    const document = await fromUuid(actorUuid);
    const actor = document.actor || document;
    
    if (actor && actor.update) {
      const adapter = this.mainManager.systemAdapter;
      await adapter.spendWealth(actor, amount);
      logger.info(`THM Socket | Wealth spent for ${actor.name}: ${amount}`);
    } else {
      logger.error('THM Socket | Failed to find valid actor for spendWealth:', actorUuid);
    }
  }

  /**
   * Создание лутбокса из дропа
   */
  async handleCreateLootPile(data) {
    try {
      const { itemData, position, sceneId, userId } = data;
      if (!game.user.isGM) return;
      await this.mainManager.createLootPileFromDrop(itemData, position, sceneId);
    } catch (error) {
      logger.error('THM Socket | Error in handleCreateLootPile:', error);
    }
  }

  /**
   * Получение названия услуги
   */
  _getServiceName(serviceType) {
    const names = {
      serviceShadowHelp: "Помощь теневого мира",
      serviceAssassination: "Заказ на убийство",
      serviceInformation: "Покупка информации",
      serviceCustom: "Особый заказ"
    };
    return names[serviceType] || "Неизвестная услуга";
  }
}
