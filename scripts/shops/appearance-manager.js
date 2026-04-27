/**
 * Treasure Hoard Manager - Appearance Manager
 * Простая система управления портретами и токенами для магазинов
 */

import { CONSTANTS } from '../core/constants.js';

export class AppearanceManager {
  
  constructor() {
    this.basePath = 'modules/treasure-hoard-manager/assets';
  }

  /**
   * Получение случайного портрета для категории магазина
   * @param {string} shopCategory - категория магазина (alchemist, armorer, etc.)
   * @returns {Promise<string|null>} - путь к файлу портрета
   */
  async getRandomPortrait(shopCategory) {
    try {
      const portraitPath = `${this.basePath}/shop-portraits/${shopCategory}`;
      console.log(`THM Appearance Manager | Ищем портреты в: ${portraitPath}`);
      
      const FilePickerClass = foundry.applications.apps.FilePicker.implementation;
      const portraitFiles = await FilePickerClass.browse("user", portraitPath);
      
      if (portraitFiles.files && portraitFiles.files.length > 0) {
        const randomFile = portraitFiles.files[Math.floor(Math.random() * portraitFiles.files.length)];
        console.log(`THM Appearance Manager | Выбран портрет: ${randomFile}`);
        return randomFile;
      }
      
      console.warn(`THM Appearance Manager | Портреты для ${shopCategory} не найдены`);
      return this.getDefaultPortrait(shopCategory);
      
    } catch (error) {
      console.warn(`THM Appearance Manager | Ошибка загрузки портретов для ${shopCategory}:`, error);
      return this.getDefaultPortrait(shopCategory);
    }
  }

  /**
   * Получение случайного токена для категории и пола
   * @param {string} shopCategory - категория магазина
   * @param {string} gender - пол (male, female, any)
   * @returns {Promise<string|null>} - путь к файлу токена
   */
  async getRandomToken(shopCategory, gender = 'any') {
    try {
      // Если пол случайный, ищем в обеих папках
      if (gender === 'any') {
        console.log(`THM Appearance Manager | Случайный пол: ищем токены в male и female папках для ${shopCategory}`);
        
        const maleTokenPath = `${this.basePath}/shop-tokens/${shopCategory}/male`;
        const femaleTokenPath = `${this.basePath}/shop-tokens/${shopCategory}/female`;
        
        const FilePickerClass = foundry.applications.apps.FilePicker.implementation;
        
        // Ищем токены в обеих папках параллельно
        const [maleTokens, femaleTokens] = await Promise.allSettled([
          FilePickerClass.browse("user", maleTokenPath),
          FilePickerClass.browse("user", femaleTokenPath)
        ]);
        
        const allTokens = [];
        
        // Добавляем мужские токены
        if (maleTokens.status === 'fulfilled' && maleTokens.value.files?.length > 0) {
          allTokens.push(...maleTokens.value.files);
          console.log(`THM Appearance Manager | Найдено ${maleTokens.value.files.length} мужских токенов`);
        }
        
        // Добавляем женские токены
        if (femaleTokens.status === 'fulfilled' && femaleTokens.value.files?.length > 0) {
          allTokens.push(...femaleTokens.value.files);
          console.log(`THM Appearance Manager | Найдено ${femaleTokens.value.files.length} женских токенов`);
        }
        
        if (allTokens.length > 0) {
          const randomFile = allTokens[Math.floor(Math.random() * allTokens.length)];
          console.log(`THM Appearance Manager | Выбран случайный токен из ${allTokens.length} доступных: ${randomFile}`);
          return randomFile;
        }
        
        console.warn(`THM Appearance Manager | Токены для ${shopCategory} (оба пола) не найдены`);
        return this.getDefaultToken(shopCategory);
      }
      
      // Для конкретного пола ищем в соответствующей папке
      const tokenPath = `${this.basePath}/shop-tokens/${shopCategory}/${gender}`;
      console.log(`THM Appearance Manager | Ищем токены в: ${tokenPath}`);
      
      const FilePickerClass = foundry.applications.apps.FilePicker.implementation;
      const tokenFiles = await FilePickerClass.browse("user", tokenPath);
      
      if (tokenFiles.files && tokenFiles.files.length > 0) {
        const randomFile = tokenFiles.files[Math.floor(Math.random() * tokenFiles.files.length)];
        console.log(`THM Appearance Manager | Выбран токен: ${randomFile}`);
        return randomFile;
      }
      
      // Fallback: если для пола нет файлов, ищем в другой половой папке
      const fallbackGender = gender === 'male' ? 'female' : 'male';
      console.log(`THM Appearance Manager | Fallback: ищем в папке ${fallbackGender}`);
      return this.getRandomToken(shopCategory, fallbackGender);
      
    } catch (error) {
      console.warn(`THM Appearance Manager | Ошибка загрузки токенов для ${shopCategory}/${gender}:`, error);
      return this.getDefaultToken(shopCategory);
    }
  }

  /**
   * Применение портрета и токена к ТОКЕНУ НА СЦЕНЕ
   * @param {Actor} actor - актер (донор)
   * @param {string} shopCategory - категория магазина
   * @param {Object} options - опции { name, gender }
   * @returns {Promise<boolean>} - успех операции
   */
  async applyShopAppearance(actor, shopCategory, options = {}) {
    console.log(`THM Appearance Manager | Применяем внешний вид для ${shopCategory}: ${actor.name}`);
    
    // ✅ ПРОВЕРКА: Работаем ТОЛЬКО с токеном на сцене
    // Проверяем несколько способов наличия токена на сцене
    const hasSceneToken = actor.token || 
                          (canvas?.tokens?.placeables?.some(t => t.document.actorId === actor.id)) ||
                          game.actorsTokens?.[actor.id];
    
    if (!hasSceneToken) {
      console.warn(`THM Appearance Manager | Нет токена на сцене для актера ${actor.name}`);
      ui.notifications.warn('⚠️ Внешний вид можно применять только к токенам на сцене!');
      return false;
    }

    // Получаем токен документа
    const tokenDocument = actor.token?.document || 
                         canvas?.tokens?.placeables?.find(t => t.document.actorId === actor.id)?.document;

    if (!tokenDocument) {
      console.warn(`THM Appearance Manager | Не удалось получить token document для актера ${actor.name}`);
      ui.notifications.warn('⚠️ Не удалось найти токен на сцене!');
      return false;
    }

    const finalName = options.name || actor.name;
    const gender = options.gender || 'any';

    try {
      // Получаем изображения
      const [portrait, token] = await Promise.all([
        this.getRandomPortrait(shopCategory),
        this.getRandomToken(shopCategory, gender)
      ]);

      console.log(`THM Appearance Manager | Получены изображения:`, { portrait, token });

      // ✅ ОБНОВЛЯЕМ ТОЛЬКО ТОКЕН НА СЦЕНЕ
      const updateData = {
        name: finalName
      };

      // Обновляем изображение токена ТОЛЬКО если найден новый токен
      if (token) {
        updateData.img = token;
        updateData.texture = {
          src: token
        };
        console.log(`THM Appearance Manager | Применяем новый токен: ${token}`);
      } else {
        console.log(`THM Appearance Manager | Новый токен не найден, сохраняем текущий`);
      }

      await tokenDocument.update(updateData);
      console.log(`THM Appearance Manager | Токен на сцене обновлен:`, updateData);

      // ✅ ОБНОВЛЯЕМ ПРОТОТИП ТОКЕНА (для будущих токенов)
      const actorUpdateData = {
        img: portrait || actor.img // портрет актера
      };

      // Обновляем прототип токена ТОЛЬКО если найден новый токен
      if (token) {
        actorUpdateData.prototypeToken = {
          name: finalName,
          texture: {
            src: token
          }
        };
        console.log(`THM Appearance Manager | Применяем новый токен в прототип: ${token}`);
      } else {
        console.log(`THM Appearance Manager | Новый токен не найден, сохраняем текущий прототип`);
      }

      await actor.update(actorUpdateData);

      console.log(`THM Appearance Manager | Прототип токена обновлен`);
      
      // ✅ ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ CANVAS
      if (canvas?.tokens) {
        const canvasToken = canvas.tokens.get(tokenDocument.id);
        if (canvasToken) {
          canvasToken.refresh();
        }
      }

      ui.notifications.info(`🎨 Внешний вид для \"${finalName}\" применен`);
      return true;

    } catch (error) {
      console.error(`THM Appearance Manager | Ошибка применения внешнего вида:`, error);
      ui.notifications.error('❌ Не удалось применить внешний вид');
      return false;
    }
  }

  /**
   * Получение портрета по умолчанию
   */
  getDefaultPortrait(shopCategory) {
    const defaults = {
      alchemist: 'icons/skills/trades/alchemy-flask-potion-green.webp',
      armorer: 'icons/equipment/chest/breastplate-scale.webp',
      cook: 'icons/consumables/food/stew-bowl-meat.webp',
      merchant: 'icons/environment/settlement/market-stall.webp',
      weaponsmith: 'icons/skills/trades/smithing-hammer-anvil.webp',
      scribe: 'icons/sundries/scrolls/scroll-yellow-teal.webp',
      general: 'icons/svg/item-bag.svg'
    };

    const portrait = defaults[shopCategory] || defaults.general;
    console.log(`THM Appearance Manager | Используем портрет по умолчанию для ${shopCategory}: ${portrait}`);
    return portrait;
  }

  /**
   * Получение токена по умолчанию
   * Возвращает null чтобы сохранить оригинальный токен
   */
  getDefaultToken(shopCategory) {
    console.log(`THM Appearance Manager | Нет токенов для ${shopCategory}, сохраняем оригинальный`);
    return null; // <-- Возвращаем null чтобы сохранить оригинальный токен
  }

  /**
   * Проверка доступности папок (для отладки)
   */
  async checkFolders() {
    const results = {};
    const categories = ['alchemist', 'armorer', 'cook', 'merchant', 'weaponsmith', 'scribe', 'general'];

    for (const category of categories) {
      try {
        const portraitPath = `${this.basePath}/shop-portraits/${category}`;
        const tokenPath = `${this.basePath}/shop-tokens/${category}`;
        
        const FilePickerClass = foundry.applications.apps.FilePicker.implementation;
        const [portraits, tokens] = await Promise.all([
          FilePickerClass.browse("user", portraitPath),
          FilePickerClass.browse("user", tokenPath)
        ]);

        results[category] = {
          portraits: {
            available: portraits.files?.length > 0,
            count: portraits.files?.length || 0
          },
          tokens: {
            available: tokens.files?.length > 0,
            count: tokens.files?.length || 0
          }
        };
      } catch (error) {
        results[category] = {
          portraits: { available: false, count: 0, error: error.message },
          tokens: { available: false, count: 0, error: error.message }
        };
      }
    }

    return results;
  }
}
