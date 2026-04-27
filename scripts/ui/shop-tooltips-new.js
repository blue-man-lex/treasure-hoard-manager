/**
 * Treasure Hoard Manager - Shop Tooltips (NEW CLEAN VERSION)
 * Полностью переработанная система подсказок без конфликтов
 * Базируется на рабочей системе из контейнера
 */
class ShopTooltipsNew {
  constructor(shopInterface) {
    this.shopInterface = shopInterface;
    this.activeTooltip = null;
    this.activeItem = null;
    this.hideTimeout = null;
  }

  /**
   * Инициализация новых подсказок
   */
  setupTooltips(html) {
    // Проверяем, загружены ли стили несколькими способами
    const styleElement1 = document.querySelector('link[href*="shop-tooltips-new.css"]');
    const styleElement2 = document.querySelector('style[data-source*="shop-tooltips-new.css"]');
    const styleElement3 = Array.from(document.styleSheets).find(sheet => 
      sheet.href && sheet.href.includes('shop-tooltips-new.css')
    );
    
    if (!styleElement1 && !styleElement2 && !styleElement3) {
      this._loadStylesManually();
    }
    
    // Список селекторов для всех окон (Магазин, Сундук, Рынок, Бартер)
    const selectors = '.inventory-item, .trade-item, .item-row, .exclusive-item-card, .inventory-item-slot';

    // Удаляем старые обработчики чтобы избежать дублирования
    html.off('mouseenter', selectors);
    html.off('mouseleave', selectors);
    html.off('mousemove', selectors);
    
    // Используем делегирование событий для динамических элементов
    html.on('mouseenter', selectors, async (event) => {
      await this._showTooltip(event);
    });

    html.on('mouseleave', selectors, (event) => {
      this._hideTooltip();
    });

    html.on('mousemove', selectors, (event) => {
      this._updateTooltipPosition(event);
    });
  }

  /**
   * Ручная загрузка CSS стилей
   */
  async _loadStylesManually() {
    try {
      const cssUrl = 'modules/treasure-hoard-manager/styles/shop-tooltips-new.css';
      const response = await fetch(cssUrl);
      const cssText = await response.text();
      
      const styleElement = document.createElement('style');
      styleElement.textContent = cssText;
      styleElement.setAttribute('data-source', 'shop-tooltips-new.css');
      document.head.appendChild(styleElement);
    } catch (error) {
      // Silently fail - tooltips will work with inline styles
    }
  }

  /**
   * Показать подсказку
   */
  async _showTooltip(event) {
    const target = event.currentTarget;
    const itemId = target.dataset.itemId;
    const actorId = target.dataset.actorId;
    
    if (!itemId) return;

    // Сначала ищем предмет у актера интерфейса или по data-actor-id
    let actor = this.shopInterface.actor;
    if (actorId && actorId !== actor?.id) {
        const foundActor = game.actors.get(actorId) || fromUuidSync(`Actor.${actorId}`);
        if (foundActor) actor = foundActor;
    }
    
    if (!actor) return;
    let item = actor.items.get(itemId);
    
    const isValidWindow = document.body.classList.contains('thm-barter-window-active') || 
                         document.body.classList.contains('thm-loot-window-active') || 
                         document.body.classList.contains('thm-trade-window-active') ||
                         document.body.classList.contains('thm-blackmarket-window-active');

    if (!item || !isValidWindow) return;
    if (this.activeItem === itemId && this.activeTooltip) return;

    // Генерируем тултип асинхронно
    const currentHoverId = itemId;
    this.activeItem = itemId;
    const newTooltip = await this._createTooltip(item);
    
    // Защита от гонки (если мышка уже ушла)
    if (this.activeItem !== currentHoverId) return;
    
    this._removeTooltip();
    this.activeTooltip = newTooltip;
    document.body.appendChild(this.activeTooltip);
    this._updateTooltipPosition(event);
    
    requestAnimationFrame(() => {
      if (this.activeTooltip) this.activeTooltip.classList.add('active');
    });
  }

  /**
   * Скрыть подсказку
   */
  _hideTooltip() {
    if (!this.activeTooltip) return;

    // Отменяем задержку скрытия если есть
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Сразу скрываем без анимации для надежности
    this._removeTooltip();
  }

  /**
   * Удалить подсказку
   */
  _removeTooltip() {
    if (this.activeTooltip && this.activeTooltip.parentNode) {
      this.activeTooltip.parentNode.removeChild(this.activeTooltip);
    }
    this.activeTooltip = null;
    this.activeItem = null;
    
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /**
   * Создать элемент подсказки
   */
  async _createTooltip(item) {
    const tooltip = document.createElement('div');
    // ИСПОЛЬЗУЕМ КЛАСС МАГАЗИНА, ЧТОБЫ ПОДХВАТИТЬ СТИЛИ!
    tooltip.className = 'thm-shop-tooltip';
    
    // БЕЗОПАСНОЕ ПОЛУЧЕНИЕ РЕДКОСТИ ДЛЯ КЛАССА CSS
    let rawRarity = item.system?.rarity?.value || item.system?.rarity || 'common';
    if (typeof rawRarity !== 'string') rawRarity = 'common';
    const cleanRarity = rawRarity.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    
    tooltip.classList.add(`rarity-${cleanRarity}`);

    // Создаем контент подсказки
    const content = await this._buildTooltipContent(item);
    tooltip.innerHTML = content;

    // Изолируем наши стили - добавляем уникальные классы и атрибуты
    tooltip.setAttribute('data-thm-tooltip', 'shop');

    return tooltip;
  }

  /**
   * Построить HTML контент подсказки
   */
  async _buildTooltipContent(item) {
    // Логика неопознанных предметов
    const isIdentified = item.system?.identified !== false; // По умолчанию считаем опознанными, если флага нет
    
    // БЕЗОПАСНОЕ ПОЛУЧЕНИЕ РЕДКОСТИ ДЛЯ ТЕКСТА (Делаем первую букву большой)
    let rawRarity = item.system?.rarity?.value || item.system?.rarity || 'common';
    if (typeof rawRarity !== 'string') rawRarity = 'common';
    const displayRarity = rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1);
    
    const rarity = isIdentified ? displayRarity : '???';
    const displayName = isIdentified ? item.name : (item.system.unidentified?.name || `Неопознанный предмет (${item.type})`);
    const rawDescription = isIdentified ? (item.system.description?.value || '') : (item.system.unidentified?.description || '<p>Свойства этого предмета неизвестны. Требуется опознание.</p>');
    
    const price = item.system.price?.value || 0;
    const weight = item.system.weight || 0;
    
    let enrichedDescription = "<i>Нет описания</i>";
    if (rawDescription) {
      const textEnricher = foundry.applications?.ux?.TextEditor ?? TextEditor;
      enrichedDescription = await textEnricher.enrichHTML(rawDescription, {
        async: true,
        secrets: false,
        rollData: item.getRollData ? item.getRollData() : {}
      });
    }
    
    let content = `
      <div class="tooltip-content">
        <div class="tooltip-header">
          <img class="tooltip-image" src="${item.img}" alt="${displayName}">
          <div class="tooltip-info">
            <div class="item-name">${displayName}</div>
            <div class="item-type">${item.type} - ${rarity}</div>
          </div>
        </div>
        <div class="item-description foundry-enriched">
          ${enrichedDescription}
        </div>
        <div class="item-details">
    `;
    
    if (price > 0 || weight > 0) {
      content += `<div class="item-details-row" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(159, 130, 78, 0.3); padding-top: 6px; margin-top: 6px; width: 100%;">`;
      if (price > 0) content += `<div class="item-price">${this._formatCurrency(price)}</div>`;
      if (weight > 0) content += `<div class="item-weight">Вес: ${weight} кг</div>`;
      content += `</div>`;
    }
    
    content += `</div></div>`;
    return content;
  }

  /**
   * Обновить позицию подсказки
   */
  _updateTooltipPosition(event) {
    if (!this.activeTooltip) return;

    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const tooltipRect = this.activeTooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = mouseX + 15;
    let top = mouseY - 10;

    // Проверка границ справа
    if (left + tooltipRect.width > windowWidth) {
      left = mouseX - tooltipRect.width - 15;
    }

    // Проверка границ снизу
    if (top + tooltipRect.height > windowHeight) {
      top = windowHeight - tooltipRect.height - 10;
    }

    // Проверка границ сверху
    if (top < 10) {
      top = 10;
    }

    // Проверка границ слева
    if (left < 10) {
      left = 10;
    }

    // Дополнительная проверка - если все еще не помещается, ограничиваем размер
    if (left + tooltipRect.width > windowWidth) {
      left = Math.max(10, windowWidth - tooltipRect.width - 10);
      this.activeTooltip.style.setProperty('max-width', `${windowWidth - left - 20}px`, 'important');
    }

    if (top + tooltipRect.height > windowHeight) {
      top = Math.max(10, windowHeight - tooltipRect.height - 10);
    }

    this.activeTooltip.style.left = `${left}px`;
    this.activeTooltip.style.top = `${top}px`;
  }

  /**
   * Форматирование валюты через системный адаптер
   */
  _formatCurrency(priceValue) {
    const adapter = game.THM?.manager?.systemAdapter;
    if (!adapter) {
      return `${priceValue} gp`;
    }
    
    // В DnD5e priceValue — это обычно золото (gp). Адаптер ожидает атомы (cp).
    // Поэтому переводим gp -> cp (умножаем на 100)
    return adapter.formatCurrencyHtml(priceValue * 100);
  }


  /**
   * Очистка при закрытии интерфейса
   */
  destroy() {
    this._removeTooltip();
  }
}

// Экспорт для использования
export default ShopTooltipsNew;
