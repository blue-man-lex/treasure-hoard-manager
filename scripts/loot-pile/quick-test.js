// 🧪 Быстрый тест для проверки getTokensAtLocation
console.log("🧪 Тест getTokensAtLocation...");

// Проверяем что функция существует
if (game.THM?.manager?.getTokensAtLocation) {
  console.log("✅ Функция getTokensAtLocation найдена");
  
  // Тестируем с пустой позицией
  try {
    const tokens = game.THM.manager.getTokensAtLocation({ x: 0, y: 0 });
    console.log(`✅ Функция работает, найдено токенов: ${tokens.length}`);
  } catch (error) {
    console.error("❌ Ошибка при вызове getTokensAtLocation:", error);
  }
} else {
  console.error("❌ Функция getTokensAtLocation не найдена");
  console.log("Доступные методы:", Object.getOwnPropertyNames(game.THM?.manager || {}));
}

// Проверяем другие функции
if (game.THM?.manager?.getCanvasMouse) {
  console.log("✅ Функция getCanvasMouse найдена");
} else {
  console.error("❌ Функция getCanvasMouse не найдена");
}

if (game.THM?.manager?.getDocument) {
  console.log("✅ Функция getDocument найдена");
} else {
  console.error("❌ Функция getDocument не найдена");
}

console.log("🧪 Тест завершен");
