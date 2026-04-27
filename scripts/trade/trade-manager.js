/**
 * Treasure Hoard Manager - Trade Manager
 * Управление торговлей между игроками
 */

import { CONSTANTS } from '../core/constants.js';

export class TradeManager {
  
  constructor(mainManager) {
    this.mainManager = mainManager;
    this.activeTrades = new Map();
  }

  /**
   * Создание запроса на торговлю
   */
  async createTradeRequest(fromUser, toUser, actor, items) {
    console.log(`THM Trade Manager | Creating trade request from ${fromUser.name} to ${toUser.name}`);
    
    const tradeId = this.generateTradeId();
    
    const tradeData = {
      id: tradeId,
      fromUser: fromUser.id,
      fromUserName: fromUser.name,
      toUser: toUser.id,
      toUserName: toUser.name,
      fromActor: actor.uuid,
      toActor: null, // Будет установлен при принятии
      status: CONSTANTS.TRADE_STATUS.PENDING,
      fromItems: [],
      toItems: [],
      fromConfirmed: false,
      toConfirmed: false,
      createdAt: new Date().toISOString()
    };
    
    this.activeTrades.set(tradeId, tradeData);
    
    // Отправка запроса через сокеты для синхронизации
    await this.mainManager.socketManager.executeForUsers(
      CONSTANTS.SOCKET_HOOKS.TRADE_REQUEST,
      [toUser.id],
      {
        tradeId,
        fromUser: fromUser.id,
        fromUserName: fromUser.name,
        toUser: toUser.id,
        toUserName: toUser.name,
        actor: actor.uuid,
        actorName: actor.name,
        tradeData: tradeData // Отправляем полные данные трейда
      }
    );
    
    return tradeId;
  }

  /**
   * Показать диалог запроса на торговлю
   */
  async _showTradeRequestDialog(tradeId, fromUser, toUser, actor) {
    // Используем Dialog V1 для совместимости - предупреждение не мешает функциональности
    const dialog = new Dialog({
      title: 'Запрос на торговлю',
      content: `
        <div class="thm-trade-request">
          <p><strong>${fromUser.name}</strong> хочет обменяться предметами с вами!</p>
          <p>Персонаж: <strong>${actor.name}</strong></p>
          <p>Принять запрос на торговлю?</p>
        </div>
      `,
      buttons: {
        accept: {
          label: 'Принять',
          callback: () => this.handleTradeResponse(tradeId, 'accepted', toUser.id)
        },
        decline: {
          label: 'Отклонить',
          callback: () => this.handleTradeResponse(tradeId, 'declined', toUser.id)
        }
      },
      default: 'accept'
    });
    
    dialog.render(true);
  }

  /**
   * Обработка ответа на запрос торговли
   */
  async handleTradeResponse(tradeId, response, userId) {
    console.log(`THM Trade Manager | Handling trade response for ${tradeId}: ${response}`);
    
    const trade = this.activeTrades.get(tradeId);
    if (!trade) {
      console.warn(`THM Trade Manager | Trade ${tradeId} not found`);
      return;
    }
    
    if (response === 'accepted') {
      trade.status = CONSTANTS.TRADE_STATUS.ACTIVE;
      trade.respondedAt = new Date().toISOString();
      
      // Ищем актера для принимающей стороны
      const toUser = game.users.get(userId);
      let targetActor = toUser?.character; // Сначала ищем дефолтного
      
      // Если дефолтного нет, берем выделенный токен на столе
      if (!targetActor && canvas.tokens.controlled.length > 0) {
        targetActor = canvas.tokens.controlled[0].actor;
      }
      
      if (targetActor) {
        trade.toActor = targetActor.uuid;
      } else {
        // Если вообще нет актера, отменяем сделку
        ui.notifications.error("Для обмена у вас должен быть назначен персонаж или выделен ваш токен!");
        trade.status = CONSTANTS.TRADE_STATUS.CANCELLED;
        this.activeTrades.delete(tradeId);
        return;
      }
      
      // Синхронизируем с отправителем
      await this.mainManager.socketManager.executeForUsers(
        CONSTANTS.SOCKET_HOOKS.TRADE_RESPONSE,
        [trade.fromUser],
        { tradeId, response: 'accepted', userId: game.user.id, tradeData: trade }
      );
      
      await this.notifyTradeStatus(trade);
      this.openTradeInterface(tradeId);
    } else {
      trade.status = CONSTANTS.TRADE_STATUS.CANCELLED;
      trade.respondedAt = new Date().toISOString();
      
      // Синхронизируем отмену с отправителем (без рекурсии)
      await this.mainManager.socketManager.executeForUsers(
        CONSTANTS.SOCKET_HOOKS.TRADE_RESPONSE,
        [trade.fromUser],
        { tradeId, response: 'declined', userId: game.user.id, tradeData: trade }
      );
      
      // Уведомление об отмене
      ui.notifications.info(`${trade.toUserName} отклонил запрос на торговлю`);
      await this.notifyTradeStatus(trade);
      
      // Удаляем торговлю
      this.activeTrades.delete(tradeId);
    }
  }

  /**
   * Открытие интерфейса торговли
   */
  async openTradeInterface(tradeId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    console.log(`THM Trade Manager | Opening trade interface for ${tradeId}`);
    
    // Открываем интерфейс для обоих участников
    const userIds = [trade.fromUser, trade.toUser];
    
    for (const userId of userIds) {
      await this.mainManager.socketManager.executeForUsers(
        CONSTANTS.SOCKET_HOOKS.TRADE_UPDATE,
        [userId],
        {
          action: 'open',
          tradeId: tradeId,
          trade: trade
        }
      );
    }
    
    // Также открываем локально для текущего пользователя
    if (userIds.includes(game.user.id)) {
      await this.mainManager.uiManager.showTradeInterface(tradeId);
    }
  }

  /**
   * Обновление предметов в торговле
   */
  async updateTradeItems(tradeId, userId, items, side) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    if (side === 'from') {
      trade.fromItems = items;
    } else {
      trade.toItems = items;
    }
    
    // Сбрасываем подтверждения при изменении предметов
    trade.fromConfirmed = false;
    trade.toConfirmed = false;
    
    // Уведомляем об изменении
    await this.mainManager.socketManager.executeForUsers(
      CONSTANTS.SOCKET_HOOKS.TRADE_UPDATE,
      [trade.fromUser, trade.toUser],
      {
        action: 'update',
        tradeId: tradeId,
        trade: trade
      }
    );
  }

  /**
   * Подтверждение торговли
   */
  async confirmTrade(tradeId, userId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    if (userId === trade.fromUser) {
      trade.fromConfirmed = true;
    } else if (userId === trade.toUser) {
      trade.toConfirmed = true;
    }
    
    // Уведомляем о подтверждении
    await this.mainManager.socketManager.executeForUsers(
      CONSTANTS.SOCKET_HOOKS.TRADE_CONFIRM,
      [trade.fromUser, trade.toUser],
      {
        tradeId: tradeId,
        userId: userId,
        trade: trade
      }
    );
    
    // БЛОК ВЫЗОВА completeTrade ОТСЮДА УДАЛЕН!
  }

  /**
   * Сброс выбора предметов
   */
  async resetTrade(tradeId, userId) {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    if (userId === trade.fromUser) {
      trade.fromItems = [];
      trade.fromConfirmed = false;
    } else if (userId === trade.toUser) {
      trade.toItems = [];
      trade.toConfirmed = false;
    }
    
    // Уведомляем о сбросе
    await this.mainManager.socketManager.executeForUsers(
      CONSTANTS.SOCKET_HOOKS.TRADE_RESET,
      [trade.fromUser, trade.toUser],
      {
        tradeId: tradeId,
        userId: userId,
        trade: trade
      }
    );
  }

  /**
   * Завершение торговли
   */
  async completeTrade(tradeId) {
    console.log(`THM Trade Manager | Completing trade ${tradeId}`);
    const trade = this.activeTrades.get(tradeId);
    
    // ЗАЩИТА: Если сделка уже завершается или завершена - прерываем
    if (!trade || trade.status === CONSTANTS.TRADE_STATUS.COMPLETED) return;
    
    trade.status = CONSTANTS.TRADE_STATUS.COMPLETED;
    
    // Если нажимает сам Мастер - выполняем перенос локально и сразу
    if (game.user.isGM) {
      console.log(`THM Trade Manager | GM is executing trade locally`);
      await this._processTradeItemsAsGM(tradeId);
    } else {
      // ВАЖНО: Просим Мастера переложить вещи ТОЛЬКО от лица одного игрока (отправителя),
      // чтобы избежать дублирования команд на сервере.
      if (game.user.id === trade.fromUser) {
        console.log(`THM Trade Manager | Requesting GM via socket to complete trade`);
        await this.mainManager.socketManager.executeAsGM('executeTradeAsGM', { 
          tradeId: tradeId,
          tradeData: trade // Передаем полный объект!
        });
      }
    }
  }

  /**
   * Обработка перемещения предметов от лица GM
   */
  async _processTradeItemsAsGM(tradeId, externalTradeData = null) {
    const trade = externalTradeData || this.activeTrades.get(tradeId);
    
    // Защита от повторного выполнения (Race Condition)
    if (!trade || trade.isProcessing) return;
    trade.isProcessing = true; 
    
    trade.completedAt = new Date().toISOString();
    
    const fromActor = await fromUuid(trade.fromActor);
    const toActor = await fromUuid(trade.toActor);
    
    if (!fromActor || !toActor) {
      console.error('THM Trade Manager | Actors not found for trade completion');
      return;
    }
    
    try {
      // Используем оптимизированный ItemManager для массового переноса!
      if (trade.fromItems && trade.fromItems.length > 0) {
        await this.mainManager.itemManager.transferItems(fromActor, toActor, trade.fromItems);
      }
      
      if (trade.toItems && trade.toItems.length > 0) {
        await this.mainManager.itemManager.transferItems(toActor, fromActor, trade.toItems);
      }
      
      // Отправка завершения всем, чтобы закрыть окна
      await this.mainManager.socketManager.broadcast(
        CONSTANTS.SOCKET_HOOKS.TRADE_COMPLETE,
        { tradeId, trade }
      );
      
      await this.sendTradeCompletionMessage(trade);
      this.activeTrades.delete(tradeId);
      
    } catch (error) {
      console.error('THM Trade Manager | Error processing trade items:', error);
      trade.isProcessing = false; // Снимаем блокировку в случае ошибки
    }
  }

  
  /**
   * Отправка сообщения о завершении торговли
   */
  async sendTradeCompletionMessage(trade) {
    const fromItemsList = trade.fromItems.map(item => `<li>${item.name} (${item.quantity || 1})</li>`).join('');
    const toItemsList = trade.toItems.map(item => `<li>${item.name} (${item.quantity || 1})</li>`).join('');
    
    const message = `
      <div class="thm-trade-complete">
        <h3>🤝 Торговля завершена!</h3>
        <div class="trade-participants">
          <div class="participant">
            <h4>${trade.fromUserName}</h4>
            <p>Отдал:</p>
            <ul>${fromItemsList || '<li>Ничего</li>'}</ul>
          </div>
          <div class="participant">
            <h4>${trade.toUserName}</h4>
            <p>Получил:</p>
            <ul>${toItemsList || '<li>Ничего</li>'}</ul>
          </div>
        </div>
      </div>
    `;
    
    ChatMessage.create({
      content: message,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
  }

  /**
   * Отмена торговли
   */
  async cancelTrade(tradeId, userId) {
    console.log(`THM Trade Manager | Cancelling trade ${tradeId} by ${userId}`);
    
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return;
    
    trade.status = 'cancelled';
    trade.cancelledAt = new Date().toISOString();
    trade.cancelledBy = userId;
    
    // Отправка отмены через сокеты
    await this.mainManager.socketManager.executeForUsers(
      CONSTANTS.SOCKET_HOOKS.TRADE_REQUEST_CANCELLED,
      [trade.fromUser, trade.toUser],
      {
        tradeId,
        cancelledBy: userId
      }
    );
    
    this.activeTrades.delete(tradeId);
  }

  /**
   * Получение информации о торговле
   */
  getTradeInfo(tradeId) {
    return this.activeTrades.get(tradeId);
  }

  /**
   * Получение всех активных торгов
   */
  getActiveTrades() {
    return Array.from(this.activeTrades.entries());
  }

  /**
   * Генерация ID торговли
   */
  generateTradeId() {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Валидация предметов для торговли
   */
  validateTradeItems(items) {
    const errors = [];
    
    for (const item of items) {
      if (!item || !item.name) {
        errors.push(`Неверный предмет: ${item}`);
      }
      
      if (item.quantity <= 0) {
        errors.push(`Количество предмета ${item.name} должно быть положительным`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Добавление предмета в торговлю
   */
  async addItemToTrade(tradeId, playerSide, item) {
    try {
      const trade = this.activeTrades.get(tradeId);
      if (!trade) {
        console.error(`THM Trade Manager | Trade ${tradeId} not found`);
        return;
      }

      // Защита от дублирования предметов
      let itemsArray = playerSide === 'from' ? trade.fromItems : trade.toItems;
      if (itemsArray.find(i => i.id === item.id)) {
        console.warn(`THM Trade Manager | Item ${item.name} is already in trade`);
        return; // Прерываем выполнение, предмет уже на столе
      }

      // Добавляем предмет в соответствующий массив
      if (playerSide === 'from') {
        trade.fromItems.push(item);
      } else if (playerSide === 'to') {
        trade.toItems.push(item);
      }

      // Обновляем время изменения
      trade.updatedAt = new Date().toISOString();

      console.log(`THM Trade Manager | Added item to trade ${tradeId}: ${item.name} (${playerSide})`);

      // Отправляем обновление через сокеты
      await this.mainManager.socketManager.executeForUsers(
        CONSTANTS.SOCKET_HOOKS.TRADE_UPDATE,
        [trade.fromUser, trade.toUser],
        {
          action: 'update',
          tradeId: tradeId,
          trade: trade
        }
      );

    } catch (error) {
      console.error('THM Trade Manager | Error adding item to trade:', error);
    }
  }

  /**
   * Удаление предмета из торговли
   */
  async removeItemFromTrade(tradeId, playerSide, itemId) {
    try {
      const trade = this.activeTrades.get(tradeId);
      if (!trade) {
        console.error(`THM Trade Manager | Trade ${tradeId} not found`);
        return;
      }

      // Удаляем предмет из соответствующего массива
      let itemsArray = playerSide === 'from' ? trade.fromItems : trade.toItems;
      const itemIndex = itemsArray.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const removedItem = itemsArray.splice(itemIndex, 1)[0];
        console.log(`THM Trade Manager | Removed item from trade ${tradeId}: ${removedItem.name} (${playerSide})`);
      }

      // Обновляем время изменения
      trade.updatedAt = new Date().toISOString();

      // Отправляем обновление через сокеты
      await this.mainManager.socketManager.executeForUsers(
        CONSTANTS.SOCKET_HOOKS.TRADE_UPDATE,
        [trade.fromUser, trade.toUser],
        {
          action: 'update',
          tradeId: tradeId,
          trade: trade
        }
      );

    } catch (error) {
      console.error('THM Trade Manager | Error removing item from trade:', error);
    }
  }

  /**
   * Удаленный обработчик подтверждения торговли
   */
  async _onRemoteTradeConfirm(data) {
    const { tradeId, userId, trade } = data;
    console.log(`THM Trade Manager | Remote confirmation received for ${tradeId} from ${userId}`);
    
    // Синхронизируем данные
    this.activeTrades.set(tradeId, trade);
    
    // Обновляем UI
    const tradeWindow = Object.values(ui.windows).find(w => 
      w.constructor.name === 'TradeInterface' && w.tradeId === tradeId
    );
    
    if (tradeWindow) {
      await tradeWindow.updateTrade(trade);
    }
  }

  /**
   * Удаленный обработчик сброса торговли
   */
  async _onRemoteTradeReset(data) {
    const { tradeId, userId, trade } = data;
    console.log(`THM Trade Manager | Remote reset received for ${tradeId} from ${userId}`);
    
    this.activeTrades.set(tradeId, trade);
    
    const tradeWindow = Object.values(ui.windows).find(w => 
      w.constructor.name === 'TradeInterface' && w.tradeId === tradeId
    );
    
    if (tradeWindow) {
      await tradeWindow.updateTrade(trade);
    }
  }

  /**
   * Удаленный обработчик завершения торговли
   */
  async _onRemoteTradeComplete(data) {
    const { tradeId, trade } = data;
    console.log(`THM Trade Manager | Remote completion received for ${tradeId}`);
    
    this.activeTrades.delete(tradeId);
    
    const tradeWindow = Object.values(ui.windows).find(w => 
      w.constructor.name === 'TradeInterface' && w.tradeId === tradeId
    );
    
    if (tradeWindow) {
      ui.notifications.info("Торговля успешно завершена!");
      tradeWindow.close();
    }
  }

  /**
   * Прокси-метод для вызова исполнения сделки от лица GM
   */
  async executeTrade(tradeId, tradeData = null) {
    return await this._processTradeItemsAsGM(tradeId, tradeData);
  }

  /**
   * Уведомление о статусе торговли
   */
  async notifyTradeStatus(trade) {
    console.log(`THM Trade Manager | Trade ${trade.id} status: ${trade.status}`);
  }
}
