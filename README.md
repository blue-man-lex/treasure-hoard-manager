# 🪙 Treasure Hoard Manager (THM)

![Version](https://img.shields.io/badge/Foundry-v12--v13-orange)
![Systems](https://img.shields.io/badge/Systems-DnD5e%20%7C%20Cyberpunk%20RED-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**Treasure Hoard Manager** is a premium, system-agnostic module for Foundry VTT that transforms loot management and trading into an immersive, high-fidelity experience. Whether you are running a high-fantasy dungeon crawl or a gritty cyberpunk heist, THM provides the tools to manage your game's economy with unprecedented depth.

---

## ✨ Key Features

### 🛒 Advanced Merchant System
*   **Dynamic Pricing**: Prices change based on character reputation and merchant greed.
*   **Specialized Shops**: Presets for Alchemists, Blacksmiths, Fixers, Ripperdocs, and more.
*   **Black Market**: Exclusive, one-of-a-kind items that notify the GM upon purchase.

### 🤝 Seamless Trading
*   **Player-to-Player (P2P)**: A fully synchronized, interactive trade window for exchanging gear and currency.
*   **Barter Mode**: Exchange items for items with a "Balance" indicator to ensure fair deals.
*   **Atomic Transactions**: Zero-risk transfers managed via server-side socket logic.

### 📦 Premium Looting
*   **Beautiful Interfaces**: Modern, glassmorphism-inspired UI for containers and loot piles.
*   **Smart Distribution**: Automatically calculate and distribute coin shares among party members.
*   **System Agnostic**: Works out-of-the-box with DnD5e and features a high-fidelity adapter for **Cyberpunk RED**.

### 🌆 Cyberpunk RED Integration
*   **Eurobuck Support**: Full integration with the CPR wealth and ledger system.
*   **Ammo Logic**: Intelligent pricing for ammunition (e.g., price per 10 rounds).
*   **Night City Vibe**: Custom icons and categories for Netrunner programs, Cyberware, and specialized gear.

---

## 🛠️ Installation

1.  Open the Foundry VTT Setup screen.
2.  Go to the **Add-on Modules** tab.
3.  Click **Install Module**.
4.  Paste the following manifest URL:
    `https://github.com/yourusername/treasure-hoard-manager/releases/latest/download/module.json`

### 📋 Dependencies
*   [lib-wrapper](https://foundryvtt.com/packages/lib-wrapper) (Required for clean UI hooks)
*   [socketlib](https://foundryvtt.com/packages/socketlib) (Required for P2P synchronization)

---

## 📖 How to Use

### Managing Merchants
1.  Open any Actor sheet (Merchant or NPC).
2.  Click the **THM Configuration** button in the header.
3.  Set the merchant type, markup, and reputation requirements.
4.  Activate the **Shop Interface** for your players.

### Trading with Players
1.  Target another player's token.
2.  Press the **Trade** keybind (default: `T`) or use the macro.
3.  Add items, confirm the deal, and enjoy a safe transaction.

---

## 👨‍💻 For Developers
THM uses a modular **Adapter Pattern**. You can add support for your favorite game system by creating a new adapter in `scripts/systems/`. See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details.

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Created with passion for the Foundry VTT community.*
