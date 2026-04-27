/**
 * 🧪 Тестовый файл для Loot Pile функциональности
 * 
 * Используйте этот файл для тестирования drop to scene функциональности
 * в консоли Foundry VTT
 */

// Тест 1: Проверка регистрации хука
console.log("🧪 THM Loot Pile Test 1: Проверка регистрации хука");

// Проверяем, что Treasure Hoard Manager загружен
if (game.THM?.manager) {
  console.log("✅ Treasure Hoard Manager загружен");
  
  // Проверяем наличие метода handleCanvasDrop
  if (typeof game.THM.manager.handleCanvasDrop === 'function') {
    console.log("✅ Метод handleCanvasDrop доступен");
  } else {
    console.error("❌ Метод handleCanvasDrop не найден");
  }
  
  // Проверяем наличие метода createLootPileFromDrop
  if (typeof game.THM.manager.createLootPileFromDrop === 'function') {
    console.log("✅ Метод createLootPileFromDrop доступен");
  } else {
    console.error("❌ Метод createLootPileFromDrop не найден");
  }
  
  // Проверяем наличие сокета CREATE_LOOT_PILE
  if (game.THM.manager.socketManager?.handlers?.has('createLootPile')) {
    console.log("✅ Сокет CREATE_LOOT_PILE зарегистрирован");
  } else {
    console.error("❌ Сокет CREATE_LOOT_PILE не найден");
  }
  
} else {
  console.error("❌ Treasure Hoard Manager не загружен");
}

// Тест 2: Проверка констант
console.log("🧪 THM Loot Pile Test 2: Проверка констант");

if (window.THM_CONSTANTS?.SOCKET_HOOKS?.CREATE_LOOT_PILE) {
  console.log("✅ Константа CREATE_LOOT_PILE определена");
} else {
  console.error("❌ Константа CREATE_LOOT_PILE не найдена");
}

// Тест 3: Проверка создания лутбокса напрямую
console.log("🧪 THM Loot Pile Test 3: Тест создания лутбокса");

async function testCreateLootPile() {
  try {
    // Создаем тестовый предмет
    const testItem = {
      name: "Test Sword",
      type: "weapon",
      img: "icons/weapons/swords/longsword-blue.webp",
      system: {
        description: { value: "Test sword for loot pile" },
        quantity: 1,
        price: { value: 100 }
      }
    };
    
    console.log("🔄 Создание тестового лутбокса...");
    
    // Получаем позицию курсора
    const position = { x: 1000, y: 1000 };
    
    // Создаем лутбокс
    const token = await game.THM.manager.createLootPileFromDrop(testItem, position);
    
    console.log(`✅ Лутбокс создан: ${token.name}`);
    return token;
    
  } catch (error) {
    console.error("❌ Ошибка при создании лутбокса:", error);
  }
}

// Тест 4: Проверка получения/создания актера
console.log("🧪 THM Loot Pile Test 4: Проверка актера для лутбоксов");

async function testLootActor() {
  try {
    const actor = await game.THM.manager.getOrCreateLootActor();
    console.log(`✅ Актер для лутбоксов: ${actor.name} (ID: ${actor.id})`);
    return actor;
  } catch (error) {
    console.error("❌ Ошибка при получении актера:", error);
  }
}

// Тест 5: Проверка сокетов
console.log("🧪 THM Loot Pile Test 5: Проверка сокетов");

async function testSocketCreation() {
  try {
    const testItem = {
      name: "Socket Test Item",
      type: "equipment",
      img: "icons/svg/chest.svg",
      system: {
        description: { value: "Test item via socket" },
        quantity: 1,
        price: { value: 50 }
      }
    };
    
    const position = { x: 1200, y: 1200 };
    const sceneId = canvas.scene.id;
    
    console.log("🔄 Тест создания лутбокса через сокет...");
    
    // Вызываем сокет
    await game.THM.manager.socketManager.executeAsGM(
      'createLootPile',
      {
        itemData: testItem,
        position: position,
        sceneId: sceneId,
        userId: game.user.id
      }
    );
    
    console.log("✅ Запрос на создание лутбокса отправлен");
    
  } catch (error) {
    console.error("❌ Ошибка при тестировании сокета:", error);
  }
}

// Экспортируем тестовые функции для использования в консоли
window.THM_LOOT_PILE_TESTS = {
  testCreateLootPile,
  testLootActor,
  testSocketCreation
};

console.log("🧪 THM Loot Pile Tests загружены. Используйте:");
console.log("  - THM_LOOT_PILE_TESTS.testCreateLootPile()");
console.log("  - THM_LOOT_PILE_TESTS.testLootActor()");
console.log("  - THM_LOOT_PILE_TESTS.testSocketCreation()");

// Автоматический запуск базовых тестов
setTimeout(() => {
  console.log("🧪 Автоматический запуск базовых тестов...");
  testLootActor();
}, 1000);
