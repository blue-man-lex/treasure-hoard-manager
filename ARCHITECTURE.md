# Treasure Hoard Manager (THM) - Architecture Documentation

This document describes the internal structure and logic flow of the Treasure Hoard Manager module for Foundry VTT.

## 1. Core Architecture Pattern: System Agnostic & Adapter Pattern

The module is built with a strictly decoupled architecture. The core logic (shops, loot, trade) does not know about system-specific data structures (like DnD5e or Cyberpunk RED). Instead, it communicates through a **System Adapter**.

### The Flow:
`Foundry System Data` ↔ `System Adapter` ↔ `THM Core Manager` ↔ `User Interface`

- **Generic/System Agnostic**: Most of the code resides in the `scripts/managers` and `scripts/ui` folders.
- **System Specific**: Located in `scripts/systems/`. Each system (e.g., `dnd5e`, `cyberpunk-red-core`) has its own adapter that translates system data into a format THM understands.

---

## 2. File Structure Overview

### `/scripts`
The heart of the module.
- `treasure-hoard-manager.js`: Entry point. Initializes the correct adapter and creates the main `TreasureHoardManager` instance.
- **`/core`**: Base classes and global utilities.
  - `main.js`: The central hub that coordinates all sub-managers.
  - `constants.js`: Global flags, paths, and configuration keys.
  - `settings.js`: Foundry VTT setting registrations.
  - `simple-logger.js`: A robust logging system for debugging.
- **`/systems`**: Adapters for different game systems.
  - `base-adapter.js`: The interface/base class that all adapters must implement.
  - `dnd5e/`: Logic for D&D 5th Edition.
  - `cyberpunk-red-core/`: High-fidelity logic for Cyberpunk RED (Eurobucks, ammo pricing, ledger integration).
- **`/managers`**: Business logic.
  - `loot-manager.js`: Handles generation of loot, inventory distribution, and "Loot Pile" logic.
  - `shop-manager.js`: Merchant logic, stock management, and reputation-based pricing.
  - `black-market.js`: Exclusive items, shadow market logic, and GM-to-Player notifications for rare deals.
- **`/trade`**:
  - `trade-manager.js`: Orchestrates complex Player-to-Player and Player-to-Merchant trades, ensuring atomic transactions and synchronization via sockets.
- **`/item-management`**:
  - `item-manager.js`: Handles the physical movement of items and currency between actors.
- **`/sockets`**:
  - `socket-manager.js`: Manages network communication. Essential for allowing players to trigger actions that require GM permissions (like updating another player's inventory).
- **`/ui`**: Handlebars-based applications.
  - `shop-interface.js`: The premium merchant UI.
  - `trade-interface.js`: The interactive trade window.
  - `container-interface.js`: High-end loot container UI.

---

## 3. Key Mechanisms

### Reputation System
Located in `ShopManager`. It calculates a `markup` or `discount` based on the actor's reputation with a specific merchant. This affects all prices dynamically in the UI.

### Black Market
Exclusive items can be flagged by the GM. When a player purchases an exclusive item, the `BlackMarketManager` handles the unique logic, including "Sold Out" states and notifications.

### Trade Synchronization
When two players trade, the `TradeManager` uses the `SocketManager` to ensure both clients see the same items in the trade window. The transaction is only finalized when both parties confirm, at which point the GM's client executes the item transfer.

---

## 4. How to Extend
To add support for a new system (e.g., Pathfinder 2e):
1. Create a new folder in `scripts/systems/pathfinder2e/`.
2. Implement an `adapter.js` inheriting from `SystemAdapter`.
3. Map system-specific paths (e.g., where money is stored, what constitutes a "weapon").
4. Register the new adapter in `scripts/treasure-hoard-manager.js`.

---

## 5. Styling and Assets
- **`/styles`**: Vanilla CSS with modern aesthetics (Glassmorphism, CSS variables for theming).
- **`/templates`**: Handlebars (`.hbs`) files for all interfaces.
- **`/assets`**: Icons, backgrounds, and UI elements.
