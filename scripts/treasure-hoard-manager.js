/**
 * Treasure Hoard Manager - Main Module Entry Point
 * Универсальный модуль для управления добычей, торговлей 
 */

console.log('THM MAIN | Файл загружен, начинаем инициализацию...');

import { TreasureHoardManager } from './core/main.js';
import { CONSTANTS } from './core/constants.js';
import { TreasureHoardConfig } from './ui/config-app.js';
import { logger } from './core/simple-logger.js';
import { GenericSystemAdapter } from './systems/generic/adapter.js';
import { Dnd5eAdapter } from './systems/dnd5e/adapter.js';
import { CyberpunkRedAdapter } from './systems/cyberpunk-red-core/adapter.js';
import { THMSettings } from './core/settings.js';
import { THMPricingHook } from './core/pricing-hook.js';

console.log('THM MAIN | Все импорты загружены успешно');

class TreasureHoardModule {
  constructor() {
    this.manager = null;
  }

  async init() {
    console.log('THM INIT | Начинаем инициализацию модуля...');

    // 0. Регистрация настроек модуля
    THMSettings.registerSettings();

    // 1. Определение адаптера системы
    const systemId = game.system.id;
    if (systemId === 'dnd5e') {
      this.systemAdapter = new Dnd5eAdapter();
    } else if (systemId === 'cyberpunk-red-core') {
      this.systemAdapter = new CyberpunkRedAdapter();
    } else {
      this.systemAdapter = new GenericSystemAdapter();
    }
    console.log(`THM INIT | Используется адаптер системы: ${systemId}`);

    // 2. Создаем основной менеджер
    this.manager = new TreasureHoardManager(this.systemAdapter);
    console.log('THM INIT | Основной менеджер создан');

    // 3. Инициализируем хук для автоматического назначения цен
    THMPricingHook.init();
    console.log('THM INIT | Хук автоматического назначения цен инициализирован');

    // 4. Сохраняем в объект модуля для доступа
    game.modules.get('treasure-hoard-manager').manager = this.manager;

    // 4. Создаем API для внешних модулей (например SLS)
    game.modules.get('treasure-hoard-manager').api = {
      hoardManager: this.manager.hoardManager,
      shopManager: this.manager.shopManager,
      itemManager: this.manager.itemManager,
      systemAdapter: this.systemAdapter,
      CONSTANTS: CONSTANTS
    };

    console.log('THM INIT | API создан и доступен для внешних модулей');
    console.log('THM INIT | Модуль успешно инициализирован');
  }

  async onReady() {
    // Регистрация настройки для включения логов
    game.settings.register('treasure-hoard-manager', 'enableLogging', {
      name: 'Включить логирование',
      hint: 'Включает сбор логов модуля для отладки',
      scope: 'world',
      config: true,
      type: Boolean,
      default: false,
      onChange: value => logger.setEnabled(value)
    });

    // Включаем логи если настройка активна
    const loggingEnabled = game.settings.get('treasure-hoard-manager', 'enableLogging');
    logger.setEnabled(loggingEnabled);

    // Регистрируем глобальные хелперы Handlebars
    Handlebars.registerHelper('calculateItemPrice', (basePrice, markup) => {
      if (!basePrice) return 0;
      const multiplier = markup / 100;
      return Math.round(basePrice * multiplier);
    });

    Handlebars.registerHelper('subtract', (a, b) => Math.max(0, a - b));
    Handlebars.registerHelper('gt', (a, b) => a > b);
    Handlebars.registerHelper('lt', (a, b) => a < b);

    if (loggingEnabled) {
      logger.info('Логирование включено');
    }

    // 5. ✅ ДОБАВЛЯЕМ КОМАНДЫ ДЛЯ ОТЛАДКИ В КОНСОЛЬ
    game.THM = {
      manager: this.manager,
      uiManager: this.manager.uiManager,
      logger: logger,

      // Тестовая команда для открытия интерфейса
      testContainer: async (actorId) => {
        logger.debug(`Тестирование интерфейса контейнера для актера ${actorId}`);
        const actor = game.actors.get(actorId) || canvas.tokens?.controlled[0]?.actor;
        if (!actor) {
          logger.error('Актер не найден для тестирования');
          ui.notifications.error('Выберите токен или укажите ID актера');
          return;
        }

        try {
          const { ContainerInterface } = await import('./ui/container-interface.js');
          const app = new ContainerInterface(actor);
          app.render(true);
          logger.info(`Тестовый интерфейс контейнера открыт для: ${actor.name}`);
        } catch (error) {
          logger.error('Ошибка при открытии тестового интерфейса', error);
        }
      },

      // Команда для просмотра логов
      showLogs: () => {
        if (!logger.isEnabled()) {
          logger.warn('Логирование выключено. Включите в настройках модуля.');
          return;
        }

        const logs = logger.getLogs();
        console.log('=== THM LOGS ===');
        logs.forEach(log => {
          console.log(`[${log.timestamp}] [${log.level}] ${log.message}`, log.data || '');
        });
        console.log(`=== END LOGS (${logs.length} entries) ===`);
      },

      clearLogs: () => {
        if (!logger.isEnabled()) {
          logger.warn('Логирование выключено.');
          return;
        }
        logger.clear();
        logger.info('Логи очищены.');
      },

      debug: () => {
        logger.info('=== THM DEBUG INFO ===');
        logger.info('Module:', game.modules.get('treasure-hoard-manager'));
        logger.info('Manager:', game.modules.get('treasure-hoard-manager')?.manager);

        // ✅ Проверяем все токены на текущей сцене
        if (canvas?.scene) {
          const tokens = canvas.scene.tokens;
          logger.info('Токены на сцене:');
          tokens.forEach(t => {
            logger.info(`Токен: ${t.name}`);
            logger.debug(`  - ID: ${t.id}`);
            logger.debug(`  - Actor ID: ${t.actorId}`);
            logger.debug(`  - Actor Link: ${t.actorLink}`);
            logger.debug(`  - THM Token Flags: ${JSON.stringify(t.flags?.['treasure-hoard-manager'])}`);
            logger.debug(`  - THM Actor Flags: ${JSON.stringify(t.actor?.flags?.['treasure-hoard-manager'])}`);
            logger.debug(`  - THM Token Data: ${JSON.stringify(t.getFlag?.('treasure-hoard-manager', 'data'))}`);
            logger.debug(`  - THM Actor Data: ${JSON.stringify(t.actor?.getFlag?.('treasure-hoard-manager', 'data'))}`);
            logger.debug('---');
          });
        }

        // ✅ Проверяем всех актеров
        logger.info('Все актеры:');
        game.actors.forEach(a => {
          logger.info(`Актер: ${a.name}`);
          logger.debug(`  - ID: ${a.id}`);
          logger.debug(`  - THM Flags: ${JSON.stringify(a.flags?.['treasure-hoard-manager'])}`);
          logger.debug(`  - THM Data: ${JSON.stringify(a.getFlag?.('treasure-hoard-manager', 'data'))}`);
          logger.debug('---');
        });

        logger.info('=== END DEBUG ===');
      },

      checkToken: (tokenId) => {
        const token = canvas?.scene?.tokens?.get(tokenId);
        if (!token) {
          logger.error('Token not found:', tokenId);
          return;
        }

        logger.info('=== TOKEN CHECK ===');
        logger.info(`Токен: ${token.name}`);
        logger.debug(`  - ID: ${token.id}`);
        logger.debug(`  - Actor ID: ${token.actorId}`);
        logger.debug(`  - Actor Link: ${token.actorLink}`);
        logger.debug(`  - THM Token Flags: ${JSON.stringify(token.flags?.['treasure-hoard-manager'])}`);
        logger.debug(`  - THM Actor Flags: ${JSON.stringify(token.actor?.flags?.['treasure-hoard-manager'])}`);
        logger.debug(`  - THM Token Data: ${JSON.stringify(token.getFlag?.('treasure-hoard-manager', 'data'))}`);
        logger.debug(`  - THM Actor Data: ${JSON.stringify(token.actor?.getFlag?.('treasure-hoard-manager', 'data'))}`);
        logger.info('=== END TOKEN CHECK ===');
      },

      checkActor: (actorId) => {
        const actor = game.actors.get(actorId);
        if (!actor) {
          logger.error('Actor not found:', actorId);
          return;
        }

        logger.info('=== ACTOR CHECK ===');
        logger.info(`Актер: ${actor.name}`);
        logger.debug(`  - ID: ${actor.id}`);
        logger.debug(`  - THM Flags: ${JSON.stringify(actor.flags?.['treasure-hoard-manager'])}`);
        logger.debug(`  - THM Data: ${JSON.stringify(actor.getFlag?.('treasure-hoard-manager', 'data'))}`);
        logger.debug(`  - Prototype Token: ${JSON.stringify(actor.prototypeToken)}`);
        logger.info('=== END ACTOR CHECK ===');
      }
    };

    logger.info('Команды THM доступны в консоли: game.THM');

    // Проверяем загрузку CSS
    logger.debug('Проверка загрузки CSS...');
    const cssLinks = document.querySelectorAll('link[href*="container-interface-premium.css"], link[href*="shop-interface-barter.css"]');
    logger.debug(`Найдено CSS ссылок: ${cssLinks.length}`);
    cssLinks.forEach((link, index) => {
      logger.debug(`CSS ${index}: ${link.href}`);
    });

    // Регистрация меню настроек в конфиге Foundry
    game.settings.registerMenu('treasure-hoard-manager', 'configMenu', {
      label: 'Настройки THM',
      type: TreasureHoardConfig,
      restricted: true
    });

    // Запуск основной логики
    if (this.manager) await this.manager.postInit();
    logger.info('Модуль THM полностью готов!');
  }
}

const thmModule = new TreasureHoardModule();
console.log('THM MAIN | Модуль создан, регистрируем хуки...');

Hooks.on('init', () => {
  console.log('THM MAIN | Хук init вызван!');
  thmModule.init();
});

Hooks.on('ready', () => {
  console.log('THM MAIN | Хук ready вызван!');
  thmModule.onReady();
});
