# 🎯 **LOOT PILE FUNCTIONALITY**

## 📋 **Обзор**

Функциональность "Loot Pile" позволяет пользователям перетаскивать предметы из компендиумов или глобальных предметов прямо на сцену, автоматически создавая лутбоксы (контейнеры с предметами).

## 🔄 **Как это работает**

### **Основной процесс:**
1. **Пользователь перетаскивает предмет** из компендиума/инвентаря на сцену
2. **Hook `dropCanvasData`** перехватывает событие
3. **Проверка типа данных** - работаем только с предметами (`type: "Item"`)
4. **Проверка позиции** - не создаем лутбокс если есть токены под курсором
5. **Создание лутбокса** через сокеты (GM только)
6. **Создание токена** на сцене с флагами THM
7. **Добавление предмета** в актера токена

### **Техническая реализация:**

#### **1. Hook регистрации:**
```javascript
Hooks.on("dropCanvasData", (canvas, dropData) => {
  return self.handleCanvasDrop(canvas, dropData);
});
```

#### **2. Обработка дропа:**
```javascript
async handleCanvasDrop(canvas, dropData) {
  // Проверка типа предмета
  if (dropData.type !== "Item") return;
  
  // Получение данных предмета
  let item = await Item.implementation.fromDropData(dropData);
  let itemData = item ? item.toObject() : false;
  
  // Проверка позиции
  const { x, y } = canvas.grid.getTopLeftPoint(dropData);
  const tokensAtLocation = getTokensAtLocation({ x, y });
  
  if (!tokensAtLocation.length) {
    // Создание через сокет
    await this.socketManager.executeAsGM(
      CONSTANTS.SOCKET_HOOKS.CREATE_LOOT_PILE, 
      { itemData, position: { x, y }, sceneId: canvas.scene.id }
    );
  }
}
```

#### **3. Создание лутбокса:**
```javascript
async createLootPileFromDrop(itemData, position, sceneId) {
  // Получение/создание актера
  const lootActor = await this.getOrCreateLootActor();
  
  // Создание токена
  const tokenData = {
    name: itemData.name,
    x: position.x,
    y: position.y,
    actorId: lootActor.id,
    actorLink: false, // ВАЖНО!
    flags: {
      "treasure-hoard-manager": {
        type: "container",
        enabled: true,
        data: {
          deleteWhenEmpty: true,
          showItemName: true,
          displayOne: true
        }
      }
    }
  };
  
  // Создание токена на сцене
  const [tokenDocument] = await scene.createEmbeddedDocuments("Token", [tokenData]);
  
  // Добавление предмета
  await tokenDocument.actor.createEmbeddedDocuments("Item", [itemData]);
  
  return tokenDocument;
}
```

## 🔌 **Система сокетов**

### **Новый хук:**
```javascript
CREATE_LOOT_PILE: "createLootPile"
```

### **Обработчик:**
```javascript
async handleCreateLootPile(data) {
  const { itemData, position, sceneId, userId } = data;
  
  // Проверка прав GM
  if (!game.user.isGM) return;
  
  // Создание лутбокса
  const tokenDocument = await this.mainManager.createLootPileFromDrop(
    itemData, position, sceneId
  );
  
  // Уведомление пользователя
  const user = game.users.get(userId);
  if (user && user.id !== game.user.id) {
    ui.notifications.info(`Лутбокс создан по запросу ${user.name}`);
  }
}
```

## 🎮 **Использование**

### **Для GM:**
1. **Открыть компендиум** с предметами
2. **Перетащить предмет** на пустое место на сцене
3. **Автоматически создается** лутбокс с предметом

### **Для игроков:**
1. **Перетащить предмет** из инвентаря на сцену
2. **Запрос отправляется** GM через сокет
3. **GM создает лутбокс** от своего имени
4. **Игрок получает уведомление** о создании

## 🏗️ **Архитектурные особенности**

### **Важные моменты:**

#### **1. Actor Link:**
```javascript
actorLink: false // ВАЖНО! Отключаем связь токена с актером
```
- Каждый токен имеет независимый инвентарь
- Предметы не дублируются между токенами

#### **2. Флаги THM:**
```javascript
flags: {
  "treasure-hoard-manager": {
    type: "container",
    enabled: true,
    data: {
      deleteWhenEmpty: true,
      showItemName: true,
      displayOne: true
    }
  }
}
```

#### **3. Default Loot Actor:**
```javascript
async getOrCreateLootActor() {
  let lootActor = game.actors.find(a => 
    a.getFlag("treasure-hoard-manager", "defaultLootActor")
  );
  
  if (!lootActor) {
    lootActor = await Actor.create({
      name: "THM Loot Pile",
      type: "npc",
      flags: {
        "treasure-hoard-manager": {
          defaultLootActor: true
        }
      }
    });
  }
  
  return lootActor;
}
```

## 🔄 **Интеграция с THM**

### **Совместимость:**
- ✅ **Не нарушает** существующую архитектуру
- ✅ **Использует** существующую систему флагов
- ✅ **Интегрируется** с системой сокетов
- ✅ **Поддерживает** мультиплеер

### **Преимущества:**
- **Простота использования** - drag & drop
- **Автоматизация** - создание контейнеров
- **Мультиплеер** - поддержка игроков
- **Гибкость** - настройки контейнеров

## 🚀 **Будущие улучшения**

### **Возможные доработки:**
1. **Настройки по умолчанию** для создаваемых лутбоксов
2. **Выбор иконки** для лутбоксов
3. **Массовый дроп** нескольких предметов
4. **Интеграция с системой репутации**
5. **Автоматическое удаление** пустых лутбоксов

### **Расширения:**
- Поддержка валюты в дропе
- Создание магазинов из дропа
- Интеграция с крафтингом
- Случайная генерация лута

## 📊 **Сравнение с Item Piles**

| Функция | Item Piles | THM Implementation |
|---------|------------|-------------------|
| **Drop to Scene** | ✅ | ✅ |
| **Socket Support** | ✅ | ✅ |
| **Actor Link: false** | ✅ | ✅ |
| **Flag System** | Своя | THM флаги |
| **Multiplayer** | ✅ | ✅ |
| **Customization** | ✅ | ✅ |

## 🎯 **Заключение**

Функциональность Loot Pile полностью интегрирована в архитектуру Treasure Hoard Manager без нарушения существующих систем. Пользователи могут легко создавать лутбоксы перетаскиванием предметов на сцену, а система автоматически обрабатывает все необходимые операции через сокеты для поддержки мультиплеера.
