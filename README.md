# Plutus

Plutus is a desktop personal finance tracker built with Python (PySide6) and an HTML/CSS/JavaScript UI.

## Current Capabilities

### Navigation and UI
- Multi-view app shell with dock navigation: `Summary`, `Transactions`, `Budget`, `Categories`, `Goals`
- Hash-based routing between views
- Light/Dark theme toggle with icon swapping

### Transactions
- Add income or expense transactions
- Capture amount, date, category, name, and repeat metadata
- Filter by type (all/income/expense)
- Search transactions
- Delete transactions
- Live totals for income and expenses
- Expense rows can be highlighted when spending is over allocated category budget

### Budget
- Set an overall monthly spending cap
- Allocate monthly limits to expense categories
- Optional "allocate remaining" helper
- Validation to prevent over-allocation
- Per-category tracking for limit, spent, and remaining
- Pie chart breakdown of allocations (Chart.js)

### Categories
- Add and delete income/expense categories
- Category color support
- Category filtering and search
- Category counts for income and expense

### Goals (What-If Scenarios)
- Add and remove scenario items (income or expense)
- Scenario summary for projected income, expenses, and net cash flow
- Budget projection impact against existing budget allocations
- Clear all scenarios

### Backend and Persistence
- Desktop host app via `QWebEngineView` and `QWebChannel`
- SQLite/SQLCipher database initialization for:
  - `Budgets`
  - `ExpenseCategories`
  - `IncomeCategories`
  - `Income`
  - `Expenses`
  - `Goals`
- Frontend app state currently uses `localStorage` for transactions, categories, budget state, goals, and theme preference

## Current Status Notes
- `Summary` page is a placeholder ("Coming Soon")
- Password lock UI exists, but lock behavior is not implemented
- JavaScript currently persists and computes from `localStorage`; database-backed synchronization is only partially wired through the Python `QWebChannel` handler
- `index.html` includes backend test calls in an inline script (example `log_expense` / `log_income` calls) that should be removed for production use

## Requirements

- Python 3.10+ (recommended)
- Python packages:
  - `PySide6`
  - `PyInstaller`
  - `sqlcipher3`
  - `sqlite3` (standard library)

Install dependencies:

```powershell
pip install PySide6 PyInstaller sqlcipher3
```

## Run

```powershell
python main.py
```

## Build Executable

`build.py` calls PyInstaller and includes `.html`, `.css`, and `.js` assets.

```powershell
python build.py
```

## Project Files

- `main.py`: PySide6 app host and database/webchannel logic
- `classes.py`: transaction, category, budget, and goal model classes
- `index.html`: app layout and views
- `scripts.js`: client-side app logic
- `styles.css`: app styling
- `build.py`: PyInstaller build entrypoint
