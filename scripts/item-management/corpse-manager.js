/**
 * Treasure Hoard Manager - Corpse Manager
 * Управление трупами врагов для обыска (D&D 5e only)
 */

import { CONSTANTS } from '../core/constants.js';
import { THMSettings } from '../core/settings.js';

export class CorpseManager {
  
  constructor(mainManager) {
    this.mainManager = mainManager;
    this.processedActors = new Set(); // Защита от множественных обработок
  }

  /**
   * Проверка, включена ли функция обыска трупов
   */
  isEnabled() {
    // Проверяем систему и настройку
    if (game.system.id !== 'dnd5e') return false;
    return THMSettings.enableCorpseLooting;
  }

  /**
   * Проверка, является ли актер уже трупом THM
   * @param {Actor} actor
   * @returns {boolean}
   */
  isCorpse(actor) {
    return actor.getFlag(CONSTANTS.MODULE_NAME, 'isCorpse') === true;
  }

  /**
   * Проверка, мертв ли актер
   * @param {Actor} actor
   * @returns {boolean}
   */
  isDead(actor) {
    // Для D&D 5e проверяем HP
    if (game.system.id === 'dnd5e') {
      const hp = actor.system.attributes?.hp;
      return hp && hp.value <= 0;
    }
    return false;
  }

  /**
   * Обработка обновления актера (вызывается из хука updateActor)
   * @param {Actor} actor
   */
  async handleActorUpdate(actor) {
    if (!this.isEnabled()) return;
    if (!actor || actor.type !== 'npc') return;

    // Защита от повторной обработки в том же тике
    if (this.processedActors.has(actor.uuid)) return;
    this.processedActors.add(actor.uuid);
    setTimeout(() => this.processedActors.delete(actor.uuid), 1000);

    const isDead = this.isDead(actor);
    const isAlreadyCorpse = this.isCorpse(actor);

    if (isDead && !isAlreadyCorpse) {
      // Актер только что умер - конвертируем в труп
      await this.convertToCorpse(actor);
    } else if (!isDead && isAlreadyCorpse) {
      // Актер воскрес - убираем флаг трупа
      await this.revertFromCorpse(actor);
    }
  }

  /**
   * Конвертация актера в труп (основной метод)
   * @param {Actor} actor
   */
  async convertToCorpse(actor) {
    console.log(`THM Corpse Manager | Converting ${actor.name} to lootable corpse`);

    // Проверяем, есть ли что-то для лута
    const hasItems = actor.items.size > 0;
    const currency = this.mainManager.systemAdapter.getActorCurrency(actor);
    const hasCurrency = currency && Object.values(currency).some(v => v > 0);

    if (!hasItems && !hasCurrency) {
      console.log(`THM Corpse Manager | ${actor.name} has no loot, skipping corpse conversion`);
      return;
    }

    // Устанавливаем флаги
    await actor.setFlag(CONSTANTS.MODULE_NAME, 'isCorpse', true);
    await actor.setFlag(CONSTANTS.MODULE_NAME, 'corpseData', {
      diedAt: new Date().toISOString(),
      convertedBy: game.user.id,
      originalType: actor.type,
      wasLooted: false,
      lootedBy: []
    });

    // Конвертируем в контейнер THM
    await actor.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.ENABLED, true);
    await actor.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.VERSION, CONSTANTS.VERSION);
    
    // Устанавливаем флаг DATA с типом CONTAINER
    await actor.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA, {
      type: CONSTANTS.PILE_TYPES.CONTAINER,
      hoardName: `Труп: ${actor.name}`,
      isVisibleToPlayers: true,
      autoLoot: false,
      lootHistory: [],
      currentValue: 0,
      enabled: true,
      isCorpse: true
    });

    await actor.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS, {
      general: {
        interactionDistance: 1, // Близкая дистанция для обыска
        showItemCards: true,
        deleteWhenEmpty: game.settings.get('treasure-hoard-manager', 'deleteEmptyCorpse'),
        stackItems: true,
        reputationModule: CONSTANTS.DEFAULTS.REPUTATION_MODULE,
        timeModule: CONSTANTS.DEFAULTS.TIME_MODULE,
        builtinReputation: CONSTANTS.DEFAULTS.BUILTIN_REPUTATION
      },
      specific: {
        autoCollect: false,
        visibilitySettings: {
          gmOnly: false,
          requiresProximity: true,
          revealOnSearch: true
        },
        itemFilters: {
          allowedTypes: [],
          maxRarity: "legendary",
          excludeIdentified: false
        }
      }
    });

    // Применяем визуальные эффекты к токену (если есть)
    await this.applyCorpseVisuals(actor);

    // Автоматическое открытие интерфейса (если включено)
    if (game.settings.get('treasure-hoard-manager', 'autoOpenCorpseOnDeath')) {
      await this.broadcastCorpseAvailable(actor);
    }

    ui.notifications.info(`${actor.name} стал доступен для обыска`);
    
    console.log(`THM Corpse Manager | ${actor.name} successfully converted to corpse`);
  }

  /**
   * Возврат актера из состояния трупа (если воскресили)
   * @param {Actor} actor
   */
  async revertFromCorpse(actor) {
    console.log(`THM Corpse Manager | Reverting ${actor.name} from corpse state (resurrection)`);

    // Убираем флаги трупа
    await actor.unsetFlag(CONSTANTS.MODULE_NAME, 'isCorpse');
    await actor.unsetFlag(CONSTANTS.MODULE_NAME, 'corpseData');

    // Убираем флаги хранилища THM
    await actor.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.TYPE);
    await actor.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.ENABLED);
    await actor.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.DATA);
    await actor.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS.SETTINGS);

    // Восстанавливаем визуальные эффекты токена
    await this.removeCorpseVisuals(actor);

    ui.notifications.info(`${actor.name} воскрешен и больше не является трупом`);
  }

  /**
   * Применение визуальных эффектов к токену трупа
   * @param {Actor} actor
   */
  async applyCorpseVisuals(actor) {
    // Получаем все токены этого актера на текущей сцене
    const tokens = canvas.tokens?.placeables.filter(t => t.actor?.id === actor.id) || [];
    
    for (const token of tokens) {
      try {
        const updates = {};
        
        // Настройка из settings - применять ли визуальные эффекты
        const applyVisuals = game.settings.get('treasure-hoard-manager', 'corpseVisualEffects');
        
        if (applyVisuals) {
          updates.alpha = 0.8; // Легкая прозрачность
          updates['texture.tint'] = '#808080'; // Серый оттенок
        }

        // Убираем HP bar (больше не нужен)
        updates['bar1.attribute'] = null;
        
        // Блокируем вращение
        updates.lockRotation = true;

        if (Object.keys(updates).length > 0) {
          await token.document.update(updates);
        }
      } catch (error) {
        console.warn(`THM Corpse Manager | Could not apply visuals to token:`, error);
      }
    }
  }

  /**
   * Удаление визуальных эффектов трупа
   * @param {Actor} actor
   */
  async removeCorpseVisuals(actor) {
    const tokens = canvas.tokens?.placeables.filter(t => t.actor?.id === actor.id) || [];
    
    for (const token of tokens) {
      try {
        await token.document.update({
          alpha: 1.0,
          'texture.tint': null,
          lockRotation: false
        });
      } catch (error) {
        console.warn(`THM Corpse Manager | Could not remove visuals from token:`, error);
      }
    }
  }

  /**
   * Уведомление игроков о доступном трупе
   * @param {Actor} actor
   */
  async broadcastCorpseAvailable(actor) {
    // Отправляем всем активным игрокам (не GM)
    const playerUsers = game.users.filter(u => u.active && !u.isGM);
    
    if (playerUsers.length === 0) return;

    // Показываем уведомление
    const message = `💀 ${actor.name} повержен! Вы можете обыскать труп.`;
    
    ChatMessage.create({
      content: `<div class="thm-corpse-notification" style="
        background: linear-gradient(135deg, #2c1810 0%, #1a0f0a 100%);
        border: 2px solid #8b4513;
        border-radius: 8px;
        padding: 15px;
        color: #f4e4c1;
        text-align: center;
        font-size: 1.1em;
      ">
        <i class="fas fa-skull" style="font-size: 1.5em; margin-right: 10px;"></i>
        ${message}
      </div>`,
      whisper: playerUsers.map(u => u.id),
      speaker: { alias: "Система добычи" }
    });

  }

  /**
   * Открытие интерфейса обыска трупа
   * @param {Actor} actor
   * @param {User} user
   */
  async openCorpseInterface(actor, user = game.user) {
    if (!this.isCorpse(actor)) {
      ui.notifications.warn(`${actor.name} не является трупом для обыска`);
      return;
    }

    // Проверяем дистанцию (если на сцене)
    if (canvas.tokens) {
      const userToken = canvas.tokens.controlled[0] || 
                       canvas.tokens.placeables.find(t => t.actor?.id === user.character?.id);
      const corpseToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);

      if (userToken && corpseToken) {
        const distance = this.mainManager.hoardManager._getTokenDistance(userToken, corpseToken);
        const maxDistance = actor.getFlag(CONSTANTS.MODULE_NAME, 'settings.general.interactionDistance') || 1;
        
        if (distance > maxDistance) {
          ui.notifications.warn(`Вы слишком далеко от трупа. Требуемая дистанция: ${maxDistance} клеток`);
          return;
        }
      }
    }

    // Открываем интерфейс контейнера
    await this.mainManager.uiManager.showContainerInterface(actor);

    // Логируем обыск
    const corpseData = actor.getFlag(CONSTANTS.MODULE_NAME, 'corpseData') || {};
    const lootedBy = corpseData.lootedBy || [];
    
    if (!lootedBy.some(l => l.userId === user.id)) {
      lootedBy.push({
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString()
      });

      await actor.setFlag(CONSTANTS.MODULE_NAME, 'corpseData.lootedBy', lootedBy);
      await actor.setFlag(CONSTANTS.MODULE_NAME, 'corpseData.wasLooted', true);
    }
  }

  /**
   * Проверка истечения времени для трупов (для автоудаления)
   */
  async checkCorpseDecay() {
    if (!this.isEnabled()) return;

    const decayTime = game.settings.get('treasure-hoard-manager', 'corpseDecayTime');
    if (decayTime <= 0) return; // Функция отключена

    const now = Date.now();
    const decayMs = decayTime * 3600000; // Часы в миллисекунды

    // Проходим по всем актерам-трупам
    for (const actor of game.actors) {
      if (!this.isCorpse(actor)) continue;

      const corpseData = actor.getFlag(CONSTANTS.MODULE_NAME, 'corpseData');
      if (!corpseData?.diedAt) continue;

      const diedAt = new Date(corpseData.diedAt).getTime();
      const elapsed = now - diedAt;

      if (elapsed > decayMs) {
        console.log(`THM Corpse Manager | Removing decayed corpse: ${actor.name}`);
        
        // Удаляем все токены на сценах
        for (const scene of game.scenes) {
          const tokens = scene.tokens.filter(t => t.actorId === actor.id);
          if (tokens.length > 0) {
            await scene.deleteEmbeddedDocuments('Token', tokens.map(t => t.id));
          }
        }

        
        ui.notifications.info(`Труп ${actor.name} разложился и исчез`);
      }
    }
  }

  /**
   * Инициализация менеджера трупов
   */
  init() {
    console.log('THM Corpse Manager | Initializing...');

    // Периодическая проверка разложения (если включена)
    if (game.user.isGM) {
      setInterval(() => {
        this.checkCorpseDecay();
      }, 60000); // Каждую минуту
    }

    console.log('THM Corpse Manager | Initialized');
  }
}
