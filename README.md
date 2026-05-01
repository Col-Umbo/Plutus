# Plutus

Plutus is a desktop personal finance tracker built with Python (`PySide6`) and a local HTML/CSS/JavaScript UI rendered in `QWebEngineView`.

## Features

- Multi-page UI: `Summary`, `Transactions`, `Budget`, `Categories`, `Goals`
- Transaction logging for income and expenses, including recurring metadata
- Monthly budget with per-category allocations and spending progress
- Category management with color tagging
- What-if goal scenarios to project income/expense changes
- CSV import/export for transaction data
- Optional SQLCipher-backed password lock for the local database
- Live UI refresh when database changes are detected

## Tech Stack

- Python backend: `PySide6`, `QWebChannel`, `sqlite/sqlcipher3`, `pandas`
- Frontend: vanilla JavaScript modules in `scripts/`
- Charts: Chart.js (loaded via CDN in `index.html`)

## Requirements

- Python 3.10+
- Node.js 18+ (for JavaScript tests)
- Python packages:
  - `PySide6`
  - `PyInstaller`
  - `sqlcipher3`
  - `pandas`

Install Python dependencies:

```powershell
pip install PySide6 PyInstaller sqlcipher3 pandas
```

## Run Locally

```powershell
python main.py
```

On first run, `main.py` creates `plutus.db` and seeds default categories.

## Tests

Run Python tests:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Run JavaScript tests (Node test runner):

```powershell
node --test tests/*.test.js
```

## Build

Create an executable with PyInstaller:

```powershell
python build.py
```

`build.py` packages HTML/CSS/JS/fonts/icons automatically by walking the repo and passing `--add-data` entries to PyInstaller.

## Project Structure

- `main.py`: app bootstrap, Qt web host, DB schema setup, bridge methods exposed to JS
- `classes.py`: transaction/category/budget model classes
- `index.html`: application shell and all page markup
- `styles.css`: app styling and layout
- `scripts/core.js`: routing, theme, boot splash, password overlay
- `scripts/summary.js`: home summary cards/charts/recent activity
- `scripts/transactions.js`: transaction CRUD, filters, totals, recurring UI
- `scripts/budget.js`: monthly budget and category allocation workflows
- `scripts/categories.js`: category CRUD, filters, counts
- `scripts/goals.js`: what-if scenarios and projection metrics
- `tests/`: Python and Node-based tests
- `build.py`: PyInstaller build entrypoint
