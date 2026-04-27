/**
 * Treasure Hoard Manager - Trade Interface
 * Интерфейс торговли между игроками
 */

import { CONSTANTS } from '../core/constants.js';
import ShopTooltipsNew from './shop-tooltips-new.js';

export class TradeInterface extends Application {

  constructor(tradeId, options = {}) {
    super(options);

    this.tradeId = tradeId;
    this.tradeManager = game.modules.get('treasure-hoard-manager')?.manager?.tradeManager;
    this.mainManager = game.modules.get('treasure-hoard-manager')?.manager;

    if (!this.tradeManager) {
      throw new Error('Trade Manager не найден!');
    }

    this.trade = this.tradeManager.getTradeInfo(tradeId);
    if (!this.trade) {
      throw new Error(`Торговля ${tradeId} не найдена`);
    }

    // Определяем сторону текущего пользователя
    this.userSide = this._getUserSide();

    // Кэши данных
    this.fromPlayerData = null;
    this.toPlayerData = null;
    this.fromTradeItems = [];
    this.toTradeItems = [];
    this.rarityFilters = { from: 'all', to: 'all' };

    // Инициализация универсальных подсказок
    this.tooltips = new ShopTooltipsNew(this);

    console.log(`THM Trade Interface | Created for trade ${tradeId}, user side: ${this.userSide}`);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "modules/treasure-hoard-manager/templates/trade-interface.hbs",
      classes: ["thm-trade-interface", "thm-window-fix"],
      width: 1000,
      height: 700,
      resizable: true,
      minimizable: true
    });
  }

  /** @override */
  get title() {
    return `Торговля - ${this.trade.fromUserName} и ${this.trade.toUserName}`;
  }

  /**
   * Определяет сторону текущего пользователя в торговле
   */
  _getUserSide() {
    if (game.user.id === this.trade.fromUser) {
      return 'from';
    } else if (game.user.id === this.trade.toUser) {
      return 'to';
    }
    return null;
  }

  /**
   * Получение данных для шаблона
   */
  async getData() {
    // Получаем актеров
    const fromActor = await fromUuid(this.trade.fromActor);
    const toActor = await fromUuid(this.trade.toActor);

    if (!fromActor || !toActor) {
      throw new Error('Актеры не найдены для торговли');
    }

    // Получаем данные игроков через адаптер
    this.fromPlayerData = await this._getPlayerData(fromActor, 'from');
    this.toPlayerData = await this._getPlayerData(toActor, 'to');

    // Получаем текущие предметы на столе
    this.fromTradeItems = this.trade.fromItems || [];
    this.toTradeItems = this.trade.toItems || [];

    // Применяем фильтры редкости к инвентарю
    this._applyRarityFilters();

    // Фильтруем инвентарь: убираем предметы, которые уже выложены на стол обмена
    if (this.fromPlayerData?.items) {
      this.fromPlayerData.items = this.fromPlayerData.items.filter(
        item => !this.fromTradeItems.find(tradeItem => tradeItem.id === item.id)
      );
    }

    if (this.toPlayerData?.items) {
      this.toPlayerData.items = this.toPlayerData.items.filter(
        item => !this.toTradeItems.find(tradeItem => tradeItem.id === item.id)
      );
    }

    // Подготовка HTML валюты через адаптер
    const adapter = this.mainManager.systemAdapter;
    const currencyHtmlFrom = adapter.formatCurrencyHtml(this.fromPlayerData.currency);
    const currencyHtmlTo = adapter.formatCurrencyHtml(this.toPlayerData.currency);

    return {
      cssClasses: this.options.classes.join(' '),
      tradeId: this.tradeId,
      fromPlayerData: this.fromPlayerData,
      toPlayerData: this.toPlayerData,
      currencyHtmlFrom: currencyHtmlFrom,
      currencyHtmlTo: currencyHtmlTo,
      fromTradeItems: this.fromTradeItems,
      toTradeItems: this.toTradeItems,
      bothConfirmed: this.trade.fromConfirmed && this.trade.toConfirmed,
      userSide: this.userSide,
      rarityFilters: this.rarityFilters
    };
  }

  /**
   * Применение фильтров редкости к закэшированным данным игроков
   */
  _applyRarityFilters() {
    const filterSide = (playerData, side) => {
      if (!playerData?.items || !this.rarityFilters[side] || this.rarityFilters[side] === 'all') return;
      
      const targetRarity = this.rarityFilters[side].toLowerCase();
      playerData.items = playerData.items.filter(i => (i.rarityId || i.rarity || 'common').toLowerCase() === targetRarity);
    };

    filterSide(this.fromPlayerData, 'from');
    filterSide(this.toPlayerData, 'to');
  }

  /**
   * Получение данных игрока через адаптер
   */
  async _getPlayerData(actor, side) {
    const user = side === 'from' ?
      game.users.get(this.trade.fromUser) :
      game.users.get(this.trade.toUser);

    const confirmed = side === 'from' ?
      this.trade.fromConfirmed :
      this.trade.toConfirmed;

    const adapter = this.mainManager.systemAdapter;
    
    // Получаем предметы, пропущенные через фильтры адаптера
    const items = actor.items
      .filter(item => adapter.canItemBeInHoard(item))
      .map(item => {
        const rarityData = adapter.getItemRarityData(item);
        return {
          id: item.id,
          name: item.name,
          img: item.img,
          rarity: rarityData.label,
          rarityId: rarityData.value,
          rarityClass: rarityData.class,
          quantity: adapter.getItemQuantity(item)
        };
      });

    // Получаем валюту через адаптер
    const currency = adapter.getActorCurrency(actor);

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img || actor.token?.img || "icons/svg/mystery-man.svg",
      currency: currency,
      items: items,
      confirmed: confirmed,
      userId: user.id,
      actor: actor
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Клик по предметам в инвентаре
    html.find('.inventory-item-slot').click(this._handleAddItem.bind(this));

    // Кнопки удаления предметов из торговли
    html.find('.remove-from-trade').click(this._handleRemoveItem.bind(this));

    // Кнопки подтверждения и сброса
    html.find('#confirmFromTrade, #confirmToTrade').click(this._handleConfirm.bind(this));
    html.find('#resetFromTrade, #resetToTrade').click(this._handleReset.bind(this));

    // Фильтры редкости
    html.find('.rarity-filter').change(this._handleRarityFilter.bind(this));

    // Добавляем класс для стилей
    document.body.classList.add('thm-trade-window-active');

    // Восстанавливаем состояние селектов
    if (this.rarityFilters.from) html.find('.rarity-filter[data-player="from"]').val(this.rarityFilters.from);
    if (this.rarityFilters.to) html.find('.rarity-filter[data-player="to"]').val(this.rarityFilters.to);

    // Инициализация подсказок (новая система)
    this.tooltips.setupTooltips(html);

    // Настройка модального окна выбора количества
    this._setupQuantityModal(html);
  }

  /**
   * Обработка добавления предмета
   */
  async _handleAddItem(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = event.currentTarget;
    const itemId = item.dataset.itemId;
    const playerSide = item.dataset.player;

    if (this.userSide !== playerSide) {
      ui.notifications.warn('Вы можете добавлять только свои предметы!');
      return;
    }

    const actor = playerSide === 'from' ? this.fromPlayerData.actor : this.toPlayerData.actor;
    if (!actor) return;

    const adapter = this.mainManager.systemAdapter;
    const itemData = actor.items.get(itemId);
    if (!itemData) return;
    
    const maxQuantity = adapter.getItemQuantity(itemData);

    const sendItemToTrade = async (qty) => {
      await this.mainManager.socketManager.executeForUsers(
        CONSTANTS.SOCKET_HOOKS.TRADE_UPDATE,
        [this.trade.fromUser, this.trade.toUser],
        {
          action: 'addItem',
          tradeId: this.tradeId,
          playerSide: playerSide,
          item: {
            id: itemData.id,
            _id: itemData.id,
            uuid: itemData.uuid,
            name: itemData.name,
            img: itemData.img,
            quantity: qty,
            rarityClass: adapter.getItemRarityData(itemData).class
          }
        }
      );
    };

    if (maxQuantity <= 1) {
      await sendItemToTrade(1);
    } else {
      this._showQuantityModal(itemData, playerSide, maxQuantity, sendItemToTrade);
    }
  }

  /**
   * Показ модального окна выбора количества
   */
  _showQuantityModal(itemData, playerSide, maxQuantity, callback) {
    const modal = $('.quantity-modal');
    this._modalCallback = callback;

    modal.find('#modalItemImage').attr('src', itemData.img);
    modal.find('#modalItemName').text(itemData.name);

    const adapter = this.mainManager.systemAdapter;
    const rarity = adapter.getItemRarityData(itemData);
    modal.find('#modalItemRarity').text(rarity.label).attr('class', `item-rarity rarity-${rarity.class}`);

    modal.find('#quantityInput').attr('max', maxQuantity).val(1);
    modal.find('#quantitySlider').attr('max', maxQuantity).val(1);

    modal.addClass('active');
  }

  /**
   * Настройка обработчиков модального окна
   */
  _setupQuantityModal(html) {
    const modal = html.find('.quantity-modal');

    modal.find('#closeQuantityModal, #cancelQuantity').on('click', () => {
      modal.removeClass('active');
    });

    modal.find('#decreaseQuantity').on('click', () => {
      const input = modal.find('#quantityInput');
      const val = Math.max(1, (parseInt(input.val()) || 1) - 1);
      input.val(val);
      modal.find('#quantitySlider').val(val);
    });

    modal.find('#increaseQuantity').on('click', () => {
      const input = modal.find('#quantityInput');
      const max = parseInt(input.attr('max')) || 1;
      const val = Math.min(max, (parseInt(input.val()) || 1) + 1);
      input.val(val);
      modal.find('#quantitySlider').val(val);
    });

    modal.find('#quantitySlider').on('input', (e) => {
      modal.find('#quantityInput').val(e.target.value);
    });

    modal.find('#confirmQuantity').on('click', async () => {
      const val = parseInt(modal.find('#quantityInput').val()) || 1;
      if (this._modalCallback) await this._modalCallback(val);
      modal.removeClass('active');
    });
  }

  /**
   * Удаление предмета
   */
  async _handleRemoveItem(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const itemId = button.dataset.itemId;
    const playerSide = button.dataset.player;
    if (this.userSide !== playerSide) return;

    const tradeItems = playerSide === 'from' ? this.fromTradeItems : this.toTradeItems;
    const itemIndex = tradeItems.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    tradeItems.splice(itemIndex, 1);
    await this.tradeManager.updateTradeItems(this.tradeId, game.user.id, tradeItems, playerSide);
  }

  /**
   * Подтверждение
   */
  async _handleConfirm(event) {
    event.preventDefault();
    const isAlreadyConfirmed = this.userSide === 'from' ? this.trade.fromConfirmed : this.trade.toConfirmed;
    if (isAlreadyConfirmed) return;

    const button = event.currentTarget;
    if (this.userSide !== button.dataset.player) return;

    const $btn = $(button);
    $btn.prop('disabled', true).css('opacity', '0.5');
    const originalHtml = $btn.html();
    $btn.html('<i class="fas fa-spinner fa-spin"></i> Ожидание...');

    try {
      await this.tradeManager.confirmTrade(this.tradeId, game.user.id);
    } catch (err) {
      console.error('THM | Trade confirm error:', err);
      $btn.prop('disabled', false).css('opacity', '1').html(originalHtml);
    }
  }

  /**
   * Сброс
   */
  async _handleReset(event) {
    event.preventDefault();
    if (this.userSide !== event.currentTarget.dataset.player) return;
    await this.tradeManager.resetTrade(this.tradeId, game.user.id);
  }

  /**
   * Фильтр редкости
   */
  _handleRarityFilter(event) {
    event.preventDefault();
    const select = event.currentTarget;
    this.rarityFilters[select.dataset.player] = select.value;
    this.render(true);
  }

  /**
   * Обновление данных (сокеты)
   */
  async updateTrade(tradeData) {
    this.trade = tradeData;
    if (this.trade.status === 'completed' || this.trade.status === 'cancelled') return;

    this.fromTradeItems = this.trade.fromItems || [];
    this.toTradeItems = this.trade.toItems || [];

    if (this.fromPlayerData) this.fromPlayerData.confirmed = this.trade.fromConfirmed;
    if (this.toPlayerData) this.toPlayerData.confirmed = this.trade.toConfirmed;

    this.render();

    if (this.trade.fromConfirmed && this.trade.toConfirmed) {
      await this.tradeManager.completeTrade(this.tradeId);
    }
  }

  /** @override */
  async close(options = {}) {
    if (this.tooltips) this.tooltips.destroy();
    document.body.classList.remove('thm-trade-window-active');
    await super.close(options);
  }
}
