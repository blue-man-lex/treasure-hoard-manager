import { CONSTANTS } from '../core/constants.js';
import ShopTooltipsNew from './shop-tooltips-new.js';

export class BlackMarketInterface extends FormApplication {
  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;
    this.timerInterval = null;
    this.tooltips = new ShopTooltipsNew(this);
    this._loadCSS();

    // Слушаем обновления через сокеты для реактивного обновления интерфейса
    Hooks.on("treasure-hoard-manager.updateHoard", (data) => {
      if (data.actorUuid === this.actor.uuid || data.actorUuid === this.actor.token?.uuid) {
        console.log("THM | Black Market refreshing due to socket update");
        this.render(false);
      }
    });
  }

  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();
    if (game.user.isGM) {
      buttons.unshift({
        label: "Настройки",
        class: "thm-shop-settings",
        icon: "fas fa-cog",
        onclick: () => game.THM.manager.uiManager.showConfig(this.actor)
      });
      buttons.unshift({
        label: "Actor Sheet",
        icon: "fa-solid fa-user",
        class: "thm-open-actor-sheet",
        onclick: () => this.actor.sheet.render(true, { focus: true, bypassTHM: true })
      });
    }
    return buttons;
  }

  _loadCSS() {
    const cssId = 'thm-blackmarket-interface-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = `modules/${CONSTANTS.MODULE_NAME}/styles/blackmarket-interface.css`;
      document.head.appendChild(link);
    }
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["thm-blackmarket-window", "thm-window-fix"],
      template: `modules/treasure-hoard-manager/templates/blackmarket-interface.hbs`,
      width: 900,
      height: "auto",
      resizable: false,
      minimizable: false,
      id: "blackmarket-interface"
    });
  }

  async getData(options = {}) {
    const target = this.actor.token || this.actor;
    const flags = target.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA) || {};
    const settings = target.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS) || {};

    const purchasedServices = flags.purchasedServices || [];
    const srvConfig = settings.specific?.services || {};
    const servicesList = [];

    // Маппинг услуг
    const serviceMap = [
      { id: 'serviceShadowHelp', config: srvConfig.srv1, name: "Помощь теневого мира", icon: "fas fa-user-ninja" },
      { id: 'serviceAssassination', config: srvConfig.srv2, name: "Заказ на убийство", icon: "fas fa-skull-crossbones" },
      { id: 'serviceInformation', config: srvConfig.srv3, name: "Покупка информации", icon: "fas fa-eye" },
      { id: 'serviceCustom', config: srvConfig.srv4, name: "Особый заказ", icon: "fas fa-scroll" }
    ];

    for (const s of serviceMap) {
      if (s.config?.enabled) {
        // Получаем изображение из настроек или используем дефолтное
        let serviceImg = s.config.img;
        if (!serviceImg) {
          // Используем те же дефолтные пути, что и в config-app.js
          const defaultImages = {
            serviceShadowHelp: "modules/treasure-hoard-manager/assets/blackmarket/1.png",
            serviceAssassination: "modules/treasure-hoard-manager/assets/blackmarket/2.png",
            serviceInformation: "modules/treasure-hoard-manager/assets/blackmarket/3.png",
            serviceCustom: "modules/treasure-hoard-manager/assets/blackmarket/4.png"
          };
          serviceImg = defaultImages[s.id] || `modules/${CONSTANTS.MODULE_NAME}/assets/blackmarket/${s.id}.png`;
        }

        servicesList.push({
          id: s.id,
          name: s.name,
          icon: s.icon,
          desc: s.config.desc,
          price: s.config.price,
          img: serviceImg,
          isBought: purchasedServices.includes(s.id)
        });
      }
    }

    const currentOffers = flags.currentOffers || [];
    const exclusiveOffer = currentOffers.find(offer => offer.type === 'exclusive' && offer.status === 'active');

    let timeRemaining = null;
    if (exclusiveOffer) {
      const realItem = this.actor.items.get(exclusiveOffer.itemId);
      if (realItem) {
        exclusiveOffer.itemRarity = realItem.system?.rarity || 'common';
        const textEnricher = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
        const enrichedDescription = await textEnricher.enrichHTML(realItem.system.description.value, { async: true, entities: true, links: true });

        exclusiveOffer.tooltip = `
          <div class="thm-enriched-tooltip rarity-${exclusiveOffer.itemRarity.toLowerCase()}">
            <header><img src="${realItem.img}"><div class="header-info"><div class="name">${realItem.name}</div></div></header>
            <div class="description">${enrichedDescription}</div>
          </div>`;
      }

      const diff = new Date(exclusiveOffer.endsAt) - new Date();
      if (diff > 0) {
        timeRemaining = {
          hours: String(Math.floor(diff / 3600000)).padStart(2, '0'),
          minutes: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
          seconds: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')
        };
      }
    }

    const adapter = game.THM.manager.systemAdapter;
    const currencyLabel = adapter.getCurrencyLabel?.() || 'зм';

    return { actor: this.actor.toObject(), servicesList, exclusiveOffer, timeRemaining, currencyLabel };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Купить услугу
    html.find('.buy-service-btn').on('click', this._onBuyService.bind(this));
    // Выкупить предмет
    html.find('.buy-exclusive-btn').on('click', this._onBuyExclusive.bind(this));

    // Переворот карточки
    html.find('.service-card').on('click', (e) => {
      if ($(e.target).closest('.buy-service-btn').length > 0) return;
      $(e.currentTarget).find('.service-card-inner').toggleClass('flipped');
    });

    // Тултипы (Единая система ShopTooltipsNew)
    this.tooltips.setupTooltips(html);

    // Добавляем класс на body для стилей
    document.body.classList.add('thm-blackmarket-window-active');

    this._startTimer();
  }

  async close(options = {}) {
    document.body.classList.remove('thm-blackmarket-window-active');
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.tooltips._hideTooltip(); // Скрываем если зависла
    return super.close(options);
  }

  _handleTooltip(event) {
    if (event.type === 'mouseenter') {
      const content = event.currentTarget.dataset.bmTooltip;
      if (!content) return;
      this.activeTooltip = document.createElement('div');
      this.activeTooltip.className = 'thm-enriched-tooltip-container active';
      this.activeTooltip.innerHTML = content;
      document.body.appendChild(this.activeTooltip);
    }
    else if (event.type === 'mousemove' && this.activeTooltip) {
      let x = event.clientX + 20, y = event.clientY + 20;
      if (x + this.activeTooltip.offsetWidth > window.innerWidth) x = event.clientX - this.activeTooltip.offsetWidth - 20;
      if (y + this.activeTooltip.offsetHeight > window.innerHeight) y = window.innerHeight - this.activeTooltip.offsetHeight - 10;
      this.activeTooltip.style.left = `${x}px`;
      this.activeTooltip.style.top = `${y}px`;
    }
    else if (event.type === 'mouseleave') {
      if (this.activeTooltip) { this.activeTooltip.remove(); this.activeTooltip = null; }
    }
  }

  _startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this._state <= 0) { clearInterval(this.timerInterval); return; }
      const timerDisplay = this.element.find('.timer-display');
      if (!timerDisplay.length) return;

      const target = this.actor.token || this.actor;
      const flags = target.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA) || {};
      const exclusiveOffer = (flags.currentOffers || []).find(offer => offer.type === 'exclusive' && offer.status === 'active');

      if (exclusiveOffer) {
        const diff = new Date(exclusiveOffer.endsAt) - new Date();
        if (diff > 0) {
          const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
          const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
          const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
          timerDisplay.text(`Осталось: ${h}ч ${m}м ${s}с`);
        } else {
          this.element.find('.exclusive-timer').html('<div class="timer-expired">Срок истёк</div>');
          clearInterval(this.timerInterval);
        }
      }
    }, 1000);
  }

  async _onBuyExclusive(event) {
    event.preventDefault();
    const btn = $(event.currentTarget);
    if (!game.user.character) return ui.notifications.warn('Выберите персонажа!');
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');

    try {
      const result = await game.THM.manager.socketManager.executeAsGM('buyExclusiveItem', {
        actorUuid: this.actor.token?.uuid || this.actor.uuid,
        userId: game.user.id,
        offerId: btn.data('offer-id'),
        price: parseInt(btn.data('price'))
      });

      if (result === false) {
        btn.prop('disabled', false).html('<i class="fas fa-crown"></i> Выкупить');
      }
    } catch (error) {
      console.error(error);
      btn.prop('disabled', false).html('<i class="fas fa-crown"></i> Выкупить');
    }
  }

  async _onBuyService(event) {
    event.preventDefault();
    const btn = $(event.currentTarget);
    if (!game.user.character) return ui.notifications.warn('Выберите персонажа!');
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');

    try {
      const result = await game.THM.manager.socketManager.executeAsGM('purchaseBlackMarketService', {
        actorUuid: this.actor.token?.uuid || this.actor.uuid,
        userId: game.user.id,
        serviceType: btn.data('service'),
        price: parseInt(btn.data('price'))
      });

      if (result === false) {
        btn.prop('disabled', false).html('<i class="fas fa-shopping-cart"></i> Купить');
      }
    } catch (error) {
      console.error(error);
      btn.prop('disabled', false).html('<i class="fas fa-shopping-cart"></i> Купить');
    }
  }
}
