# ➗ Just Divide

A strategic math-based puzzle game built with **Phaser 3**. Place tiles, calculate divisions, and keep the grid clear to score high!

### 🎮 [Play the Live Demo on Vercel](https://just-divide-game-zeta.vercel.app/)

![Game Badge](https://img.shields.io/badge/Status-Playable-success)
![Framework](https://img.shields.io/badge/Built%20With-Phaser%203-blue)

## 🧩 How to Play

The goal is to keep the grid from filling up by merging tiles using division logic.

### **The Math Rules:**
1.  **Equal Tiles:** If you place a tile next to an equal number (e.g., `4` on `4`), **both disappear**.
2.  **Divisible Tiles:** If the numbers divide evenly (e.g., `12` and `3`):
    * The larger number is divided by the smaller one.
    * The result replaces the larger tile.
    * The smaller tile disappears.
    * *(Example: `12` next to `3` becomes `4`).*
3.  **Quotient of 1:** If the division result is `1`, the tile vanishes.

### **Game Over:**
The game ends when the grid is completely full and no moves are possible.

## 🕹️ Controls

* **Drag & Drop:** Move tiles from the "Next" queue to the Grid, Trash, or Keep slot.
* **Keep Slot:** Drag a tile here to save it for later.
* **Trash:** Discard a tile (Limited uses per level!).

### **Keyboard Shortcuts:**
* `Z` - Undo last move
* `R` - Restart Game
* `G` - Toggle Hints
* `M` - Mute/Unmute Sound
* `1, 2, 3` - Change Difficulty (Easy, Medium, Hard)

## ✨ Features

* **Dynamic Grid System:** 4x4 grid with smooth drag-and-drop mechanics.
* **Smart Merging:** Logic handles recursive merges (chain reactions).
* **Leveling System:** Score points to level up and earn more "Trash" uses.
* **High Score:** Saves your best score locally using LocalStorage.
* **Responsive UI:** Adjusts for different screen sizes (Portrait mode requires rotation on mobile).
* **Audio:** Satisfying ASMR-style sound effects for merging, dropping, and clearing.

## 🛠️ Tech Stack

* **Engine:** [Phaser 3](https://phaser.io/)
* **Language:** JavaScript (ES6)
* **Styling:** CSS3
* **Deployment:** Vercel

## 🚀 Local Development

To run this game on your local machine:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/project-pg-i/Just-Divide-Kid-Mode.git
    ```
2.  **Navigate to the folder:**
    ```bash
    cd Just-Divide-Kid-Mode
    ```
3.  **Run a local server:**
    Because of browser security settings regarding audio and images, you need a local server.
    * If you have Python: `python -m http.server`
    * If you have VS Code: Use the "Live Server" extension.

## 📄 Credits & License

This project was developed as a technical assessment for **Eklavya**.

* **Game Concept & Assets:** All visual assets (sprites, UI elements) and the game design specifications were provided by **Eklavya**.
* **Code Implementation:** Developed by **[project-pg-i](https://github.com/project-pg-i)** using Phaser 3.

*Note: The assets are used here strictly for the purpose of this assessment demonstration and remain the property of Eklavya.*

---
*Created by [project-pg-i](https://github.com/project-pg-i)*
