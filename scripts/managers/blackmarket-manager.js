/**
 * Treasure Hoard Manager - Black Market Manager
 * Управление чёрным рынком
 */

import { CONSTANTS } from '../core/constants.js';

export class BlackMarketManager {

  constructor(mainManager) {
    this.mainManager = mainManager;
    this.activeBlackMarkets = new Map();
  }

  /**
   * Создание чёрного рынка
   */
  async createBlackMarket(actor, options = {}) {
    console.log(`THM Black Market Manager | Creating black market from ${actor.name}`);

    const defaultSettings = {
      marketName: actor.name,
      isActive: true,
      shadowServices: {
        shadowHelp: false,
        assassination: false,
        information: false,
        custom: false
      },
      marketRules: {
        offerDuration: 24,
        exclusiveItem: true,
        priceMarkup: 2.5,
        reputationRequired: 0
      }
    };

    const finalSettings = mergeObject(defaultSettings, options);

    const updates = {
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.TYPE}`]: CONSTANTS.PILE_TYPES.BLACKMARKET,
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.ENABLED}`]: true,
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.VERSION}`]: CONSTANTS.VERSION,
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`]: {
        marketName: finalSettings.marketName,
        isActive: finalSettings.isActive,
        shadowServices: finalSettings.shadowServices,
        currentOffers: [],
        completedOffers: []
      },
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.SETTINGS}`]: {
        general: {
          interactionDistance: finalSettings.interactionDistance || CONSTANTS.DEFAULTS.INTERACTION_DISTANCE,
          showItemCards: finalSettings.showItemCards || CONSTANTS.DEFAULTS.SHOW_ITEM_CARDS,
          deleteWhenEmpty: finalSettings.deleteWhenEmpty || CONSTANTS.DEFAULTS.DELETE_WHEN_EMPTY,
          stackItems: finalSettings.stackItems || CONSTANTS.DEFAULTS.STACK_ITEMS,
          reputationModule: finalSettings.reputationModule || CONSTANTS.DEFAULTS.REPUTATION_MODULE,
          timeModule: finalSettings.timeModule || CONSTANTS.DEFAULTS.TIME_MODULE,
          builtinReputation: finalSettings.builtinReputation || CONSTANTS.DEFAULTS.BUILTIN_REPUTATION
        },
        specific: {
          marketRules: finalSettings.marketRules,
          allowedBuyers: 'all',
          requireReputation: false,
          inventorySources: finalSettings.inventorySources || []
        }
      }
    };

    await actor.update(updates);

    // Обновление внешнего вида актера
    await this.mainManager.itemManager.updateTokenAppearance(actor.token, CONSTANTS.PILE_TYPES.BLACKMARKET);

    ui.notifications.info(`Чёрный рынок "${actor.name}" создан успешно`);

    return {
      success: true,
      blackMarket: actor,
      settings: finalSettings
    };
  }

  /**
   * Создание эксклюзивного предложения
   */
  async createExclusiveOffer(targetDoc, compendiumSource, duration = 24) {
    if (!targetDoc) throw new Error(`Целевой токен не найден`);

    // Получение компендиума
    const pack = game.packs.get(compendiumSource);
    if (!pack) throw new Error(`Компендиум ${compendiumSource} не найден`);

    const items = await pack.getDocuments();
    if (items.length === 0) throw new Error(`Компендиум пуст`);

    // Ищем редкие предметы через адаптер
    let rareItems = items.filter(item => {
      const rarity = this.mainManager.systemAdapter.getItemRarity(item);
      return ['rare', 'very rare', 'legendary'].includes(rarity.toLowerCase());
    });
    if (rareItems.length === 0) rareItems = items;

    // Выбор случайного предмета
    const sourceItem = rareItems[Math.floor(Math.random() * rareItems.length)];

    // ВАЖНО: Создаем ФИЗИЧЕСКИЙ предмет в инвентаре актера!
    const actor = targetDoc.actor || targetDoc;
    const [createdItem] = await actor.createEmbeddedDocuments("Item", [sourceItem.toObject()]);

    const offerId = foundry.utils.randomID();

    // Используем генерацию цены для эксклюзива
    const basePrice = await this.mainManager.systemAdapter.generateItemPrice(createdItem, 'dmg') || 100;
    const markupPrice = Math.floor(basePrice * 2.5);

    const offer = {
      id: offerId,
      itemId: createdItem.id, // СОХРАНЯЕМ ID РЕАЛЬНО СОЗДАННОГО ПРЕДМЕТА!
      itemName: createdItem.name,
      itemImg: createdItem.img,
      originalPrice: basePrice,
      markupPrice: markupPrice,
      createdAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + duration * 3600000).toISOString(),
      status: 'active',
      type: 'exclusive'
    };

    // Сохраняем предложение во флаги
    const dataFlag = targetDoc.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA) || {};
    const currentOffers = dataFlag.currentOffers || [];

    await targetDoc.update({
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}.currentOffers`]: [...currentOffers, offer]
    });

    return offerId;
  }

  /**
   * Активация теневой услуги
   */
  async activateShadowService(blackMarketId, serviceType, userId) {
    console.log(`THM Black Market Manager | Activating shadow service ${serviceType} for user ${userId}`);

    const blackMarket = this.activeBlackMarkets.get(blackMarketId);
    if (!blackMarket) {
      throw new Error(`Чёрный рынок ${blackMarketId} не найден`);
    }

    const data = blackMarket.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA);
    const settings = blackMarket.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);

    // Проверка доступности услуги
    if (!data.shadowServices[serviceType]) {
      throw new Error(`Услуга ${serviceType} недоступна`);
    }

    // Проверка репутации ВАЖНО - В РАЗРАБОТКЕ!!!!!
    if (settings?.specific?.requireReputation) {
      const hasAccess = await this.mainManager.reputationManager.checkReputationAccess(userId, settings.specific.marketRules.reputationRequired);
      if (!hasAccess) {
        throw new Error('У вас недостаточно репутации для использования этой услуги');
      }
    }

    // Создание запроса на услугу
    const serviceRequest = {
      id: this.generateRequestId(),
      serviceType,
      userId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Уведомление GM через сокеты
    await this.mainManager.socketManager.executeAsGM(
      CONSTANTS.SOCKET_HOOKS.BLACKMARKET_SERVICE,
      {
        blackMarketId,
        serviceRequest
      }
    );

    ui.notifications.info(`Запрос на услугу "${serviceType}" отправлен`);

    return serviceRequest;
  }

  /**
   * Получение информации о чёрном рынке
   */
  getBlackMarketInfo(blackMarketId) {
    const blackMarket = this.activeBlackMarkets.get(blackMarketId);
    if (!blackMarket) {
      return null;
    }

    const data = blackMarket.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA);
    const settings = blackMarket.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);

    return {
      id: blackMarketId,
      name: data.marketName,
      isActive: data.isActive,
      shadowServices: data.shadowServices,
      currentOffers: data.currentOffers,
      completedOffers: data.completedOffers,
      settings: settings
    };
  }

  /**
   * Проверка истекших предложений
   */
  async checkExpiredOffers(blackMarketId) {
    const blackMarket = this.activeBlackMarkets.get(blackMarketId);
    if (!blackMarket) {
      return;
    }

    const data = blackMarket.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA);
    const currentOffers = data.currentOffers || [];
    const now = new Date();

    const expiredOffers = currentOffers.filter(offer =>
      offer.status === 'active' && new Date(offer.endsAt) < now
    );

    if (expiredOffers.length > 0) {
      const activeOffers = currentOffers.filter(offer =>
        !expiredOffers.includes(offer)
      );

      const completedOffers = [
        ...(data.completedOffers || []),
        ...expiredOffers.map(offer => ({
          ...offer,
          status: 'expired',
          completedAt: now.toISOString()
        }))
      ];

      await blackMarket.update({
        [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}`]: {
          ...data,
          currentOffers: activeOffers,
          completedOffers: completedOffers
        }
      });

      // Уведомление об истечении предложений
      await this.mainManager.socketManager.executeForEveryone(
        CONSTANTS.SOCKET_HOOKS.UPDATE_HOARD,
        {
          actorUuid: blackMarket.uuid,
          action: "offers_expired",
          expiredOffers: expiredOffers.map(o => o.id)
        }
      );
    }
  }

  /**
   * Генерация ID чёрного рынка
   */
  generateBlackMarketId() {
    return `blackmarket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Генерация ID предложения
   */
  generateOfferId() {
    return `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Генерация ID запроса на услугу
   */
  generateRequestId() {
    return `request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Обработка покупки услуги
   */
  async processServicePurchase(data) {
    const { actorUuid, userId, serviceType, price } = data; // price в золоте (gp) для 5е
    const doc = await fromUuid(actorUuid);
    const actor = doc?.actor || doc;
    const user = game.users.get(userId);
    const playerActor = user?.character;

    if (!doc || !playerActor) {
      console.error("THM | Black Market | Document or Player Actor not found", { actorUuid, userId });
      return false;
    }

    const adapter = this.mainManager.systemAdapter;

    // Проверяем, не куплена ли услуга уже
    const purchasedServices = doc.getFlag(CONSTANTS.MODULE_NAME, 'data.purchasedServices') || [];
    if (purchasedServices.includes(serviceType)) {
      ui.notifications.warn("Эта услуга уже приобретена!");
      return;
    }

    // Переводим цену из основной валюты системы (gp для 5е, eb для CPR) в атомы
    let conversion = adapter.getCurrencyConversion(adapter.getPrimaryCurrencyKey());
    
    // ПРИНУДИТЕЛЬНАЯ СТРАХОВКА ДЛЯ DnD 5e (1 gp = 100 cp)
    if (game.system.id === 'dnd5e') {
      conversion = 100;
    }
    
    const priceInAtoms = price * conversion;

    const success = await adapter.spendWealth(playerActor, priceInAtoms);

    if (!success) {
      ui.notifications.warn(`Недостаточно средств у ${playerActor.name}`);
      return;
    }

    // Сохраняем информацию о покупке
    purchasedServices.push(serviceType);

    // Обновляем флаги на том же документе, где они хранятся (Токен или Актер)
    await doc.update({
      [`flags.${CONSTANTS.MODULE_NAME}.data.purchasedServices`]: purchasedServices
    });

    console.log(`THM | Service ${serviceType} purchased for ${actor.name}. Flags updated on: ${doc.constructor.name}`);

    // Сообщение в чат
    const serviceName = this._getServiceName(serviceType);
    // Создаем объект валюты для корректного отображения
    const currencyObj = adapter.convertAtomsToCurrency(priceInAtoms);
    const priceHtml = adapter.formatCurrencyHtml(currencyObj);

    ChatMessage.create({
      content: `
        <div class="thm-blackmarket-chat" style="background: linear-gradient(135deg, #1a1a1a 0%, #000 100%); border: 1px solid #9f824e; border-radius: 8px; padding: 15px; color: #e8dcc0;">
          <div style="border-bottom: 1px solid #9f824e; padding-bottom: 8px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-user-secret" style="color: #9f824e; font-size: 1.5em;"></i>
            <h3 style="margin: 0; color: #ffd700; font-family: 'Modesto Condensed', serif; font-size: 1.6em;">ТЕНЕВАЯ СДЕЛКА</h3>
          </div>
          <div style="font-size: 1.1em; margin-bottom: 8px;">
            <strong>${playerActor.name}</strong> приобрел услугу: <br>
            <span style="color: #ffd700; font-weight: bold; font-size: 1.2em;">"${serviceName}"</span>
          </div>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(159, 130, 78, 0.3); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-style: italic; opacity: 0.7;">Оплачено:</span>
            <span>${priceHtml}</span>
          </div>
        </div>
      `,
      speaker: { alias: "Теневой Посредник" }
    });

    ui.notifications.info(`Услуга "${serviceName}" успешно оплачена.`);

    // Оповещаем интерфейсы о необходимости обновления
    this.mainManager.socketManager.broadcast(CONSTANTS.SOCKET_HOOKS.UPDATE_HOARD, {
      actorUuid: actor.uuid,
      action: "service_purchased"
    });
  }

  /**
   * Обработка покупки эксклюзивного предмета (System Agnostic)
   */
  async processExclusivePurchase(data) {
    const { actorUuid, userId, offerId, price } = data;
    const doc = await fromUuid(actorUuid);
    const actor = doc?.actor || doc;
    const user = game.users.get(userId);
    const playerActor = user?.character;

    if (!doc || !playerActor) {
      console.error("THM | Black Market | Document or Player Actor not found", { actorUuid, userId });
      return false;
    }

    const flagData = doc.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA) || {};
    const offers = flagData.currentOffers || [];
    const offer = offers.find(o => o.id === offerId);

    if (!offer) {
      ui.notifications.error("Предложение не найдено или уже выкуплено");
      return false;
    }

    const adapter = this.mainManager.systemAdapter;

    let conversion = adapter.getCurrencyConversion(adapter.getPrimaryCurrencyKey());
    
    // ПРИНУДИТЕЛЬНАЯ СТРАХОВКА ДЛЯ DnD 5e (1 gp = 100 cp)
    if (game.system.id === 'dnd5e') {
      conversion = 100;
    }
    
    const priceInAtoms = price * conversion;

    // Снимаем деньги
    const success = await adapter.spendWealth(playerActor, priceInAtoms);

    if (!success) {
      ui.notifications.warn(`Недостаточно средств у ${playerActor.name}`);
      return;
    }

    // Передаем предмет
    const item = actor.items.get(offer.itemId);
    if (item) {
      const itemData = item.toObject();
      await playerActor.createEmbeddedDocuments("Item", [itemData]);
      await actor.deleteEmbeddedDocuments("Item", [item.id]);
    }

    // Удаляем из списка офферов или помечаем как проданный
    const newOffers = offers.filter(o => o.id !== offerId);

    // Обновляем флаги на том же документе, где они хранятся (Токен или Актер)
    await doc.update({
      [`flags.${CONSTANTS.MODULE_NAME}.${CONSTANTS.FLAGS.DATA}.currentOffers`]: newOffers
    });

    ui.notifications.info(`Предмет "${offer.itemName}" успешно выкуплен.`);

    // Оповещаем интерфейсы о необходимости обновления
    this.mainManager.socketManager.broadcast(CONSTANTS.SOCKET_HOOKS.UPDATE_HOARD, {
      actorUuid: actor.uuid,
      action: "item_sold"
    });
  }

  _getServiceName(type) {
    const names = {
      serviceShadowHelp: "Помощь теневого мира",
      serviceAssassination: "Заказ на убийство",
      serviceInformation: "Покупка информации",
      serviceCustom: "Особый заказ"
    };
    return names[type] || "Теневая услуга";
  }
}
