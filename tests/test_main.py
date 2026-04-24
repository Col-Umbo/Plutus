import importlib
import json
import sqlite3
import sys
import time
import types
import unittest


def _install_dependency_stubs():
    if "PySide6" not in sys.modules:
        pyside6 = types.ModuleType("PySide6")
        qtcore = types.ModuleType("PySide6.QtCore")
        qtwidgets = types.ModuleType("PySide6.QtWidgets")
        qtwebenginewidgets = types.ModuleType("PySide6.QtWebEngineWidgets")
        qtwebchannel = types.ModuleType("PySide6.QtWebChannel")
        qtwebenginecore = types.ModuleType("PySide6.QtWebEngineCore")

        class QObject:
            def __init__(self, *_args, **_kwargs):
                pass

        def Slot(*_args, **_kwargs):
            def decorator(func):
                return func

            return decorator

        class _SignalConnection:
            def __init__(self):
                self.callback = None

            def connect(self, callback):
                self.callback = callback

        class Signal:
            def __init__(self, *_args, **_kwargs):
                self.calls = []

            def emit(self, *args, **kwargs):
                self.calls.append((args, kwargs))

        class QTimer:
            def __init__(self, *_args, **_kwargs):
                self.timeout = _SignalConnection()
                self.interval = 0
                self.started = False

            def setInterval(self, interval):
                self.interval = interval

            def start(self):
                self.started = True

            def stop(self):
                self.started = False

        class QUrl:
            @staticmethod
            def fromLocalFile(path):
                return path

        class QJsonValue:
            pass

        class QJsonArray:
            pass

        class QFileInfo:
            def __init__(self, path):
                self.path = path

            def absoluteFilePath(self):
                return self.path

        class QApplication:
            def __init__(self, *_args, **_kwargs):
                pass

            def exec(self):
                return 0

        class QMainWindow:
            pass

        class QInputDialog:
            pass

        class QMessageBox:
            pass

        class _DummySettings:
            def setAttribute(self, *_args, **_kwargs):
                pass

        class _DummyPage:
            def setWebChannel(self, *_args, **_kwargs):
                pass

        class QWebEngineView:
            def __init__(self):
                self._settings = _DummySettings()
                self._page = _DummyPage()

            def settings(self):
                return self._settings

            def page(self):
                return self._page

            def setUrl(self, *_args, **_kwargs):
                pass

        class QWebChannel:
            def registerObject(self, *_args, **_kwargs):
                pass

        class QWebEngineSettings:
            class WebAttribute:
                ShowScrollBars = 0
                LocalContentCanAccessRemoteUrls = 1

        qtcore.QUrl = QUrl
        qtcore.QObject = QObject
        qtcore.Slot = Slot
        qtcore.QJsonValue = QJsonValue
        qtcore.QJsonArray = QJsonArray
        qtcore.Signal = Signal
        qtcore.QTimer = QTimer
        qtcore.QFileInfo = QFileInfo

        qtwidgets.QApplication = QApplication
        qtwidgets.QMainWindow = QMainWindow
        qtwidgets.QInputDialog = QInputDialog
        qtwidgets.QMessageBox = QMessageBox

        qtwebenginewidgets.QWebEngineView = QWebEngineView
        qtwebchannel.QWebChannel = QWebChannel
        qtwebenginecore.QWebEngineSettings = QWebEngineSettings

        pyside6.QtCore = qtcore
        pyside6.QtWidgets = qtwidgets
        pyside6.QtWebEngineWidgets = qtwebenginewidgets
        pyside6.QtWebChannel = qtwebchannel
        pyside6.QtWebEngineCore = qtwebenginecore

        sys.modules["PySide6"] = pyside6
        sys.modules["PySide6.QtCore"] = qtcore
        sys.modules["PySide6.QtWidgets"] = qtwidgets
        sys.modules["PySide6.QtWebEngineWidgets"] = qtwebenginewidgets
        sys.modules["PySide6.QtWebChannel"] = qtwebchannel
        sys.modules["PySide6.QtWebEngineCore"] = qtwebenginecore

    if "sqlcipher3" not in sys.modules:
        sqlcipher3 = types.ModuleType("sqlcipher3")
        sqlcipher3.dbapi2 = sqlite3
        sys.modules["sqlcipher3"] = sqlcipher3


_install_dependency_stubs()
main = importlib.import_module("main")


def make_handler_with_in_memory_db():
    handler = main.CallHandler.__new__(main.CallHandler)
    handler.con = sqlite3.connect(":memory:")
    handler.cursor = handler.con.cursor()
    handler._unlock = lambda: None
    handler.current_month_key = lambda: "2026-04"
    return handler


class MainCallHandlerTests(unittest.TestCase):
    def test_current_month_key_format(self):
        handler = main.CallHandler.__new__(main.CallHandler)
        month_key = handler.current_month_key()
        self.assertRegex(month_key, r"^\d{4}-\d{2}$")

    def test_current_timestamp_ms_is_integer_and_monotonic(self):
        handler = main.CallHandler.__new__(main.CallHandler)
        first = handler.current_timestamp_ms()
        time.sleep(0.002)
        second = handler.current_timestamp_ms()
        self.assertIsInstance(first, int)
        self.assertGreaterEqual(second, first)

    def test_read_data_version_falls_back_to_previous_version(self):
        class BrokenCursor:
            def execute(self, *_args, **_kwargs):
                raise main.sqlite.Error("fail")

        handler = main.CallHandler.__new__(main.CallHandler)
        handler.cursor = BrokenCursor()
        handler._last_data_version = 9
        self.assertEqual(handler._read_data_version(), 9)

    def test_check_external_db_changes_reload_and_emit(self):
        class DummySignal:
            def __init__(self):
                self.messages = []

            def emit(self, message):
                self.messages.append(message)

        handler = main.CallHandler.__new__(main.CallHandler)
        handler._last_data_version = 1
        handler._read_data_version = lambda: 2
        reloaded = []
        handler._reload_cache = lambda: reloaded.append(True)
        handler.database_changed = DummySignal()

        handler._check_external_db_changes()

        self.assertEqual(handler._last_data_version, 2)
        self.assertEqual(reloaded, [True])
        self.assertEqual(handler.database_changed.messages, ["external"])

    def test_check_external_db_changes_noop_when_version_same(self):
        class DummySignal:
            def __init__(self):
                self.messages = []

            def emit(self, message):
                self.messages.append(message)

        handler = main.CallHandler.__new__(main.CallHandler)
        handler._last_data_version = 7
        handler._read_data_version = lambda: 7
        reloaded = []
        handler._reload_cache = lambda: reloaded.append(True)
        handler.database_changed = DummySignal()

        handler._check_external_db_changes()

        self.assertEqual(reloaded, [])
        self.assertEqual(handler.database_changed.messages, [])

    def test_get_budget_amount_defaults_to_zero_for_missing_month(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.cursor.execute(
            "CREATE TABLE Budgets (date TEXT PRIMARY KEY, amount FLOAT)"
        )

        payload = json.loads(handler.get_budget_amount())
        self.assertEqual(payload, {"date": "2026-04", "amount": 0.0})

    def test_set_budget_amount_upserts_current_month(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.cursor.execute(
            "CREATE TABLE Budgets (date TEXT PRIMARY KEY, amount FLOAT)"
        )

        handler.set_budget_amount(900.0)
        handler.set_budget_amount(1200.5)

        payload = json.loads(handler.get_budget_amount())
        self.assertEqual(payload, {"date": "2026-04", "amount": 1200.5})

    def test_upsert_budget_allocation_insert_and_update(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.cursor.execute(
            "CREATE TABLE BudgetAllocations (date TEXT, category TEXT, limitAmount FLOAT, PRIMARY KEY (date, category))"
        )

        handler.upsert_budget_allocation("Groceries", 125.0)
        handler.upsert_budget_allocation("Groceries", 200.0)

        handler.cursor.execute(
            "SELECT limitAmount FROM BudgetAllocations WHERE date=? AND category=?",
            ("2026-04", "Groceries"),
        )
        row = handler.cursor.fetchone()
        self.assertEqual(float(row[0]), 200.0)

    def test_get_budget_allocations_json_shape_and_order(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.cursor.execute(
            "CREATE TABLE BudgetAllocations (date TEXT, category TEXT, limitAmount FLOAT, PRIMARY KEY (date, category))"
        )
        handler.cursor.executemany(
            "INSERT INTO BudgetAllocations (date, category, limitAmount) VALUES (?, ?, ?)",
            [
                ("2026-04", "z-last", 5),
                ("2026-04", "Alpha", 10.5),
                ("2026-04", "beta", 12.25),
            ],
        )
        handler.con.commit()

        payload = json.loads(handler.get_budget_allocations())
        self.assertEqual(
            payload,
            [
                {"category": "Alpha", "limit": 10.5},
                {"category": "beta", "limit": 12.25},
                {"category": "z-last", "limit": 5.0},
            ],
        )

    def test_delete_budget_allocation_only_deletes_current_month(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.cursor.execute(
            "CREATE TABLE BudgetAllocations (date TEXT, category TEXT, limitAmount FLOAT, PRIMARY KEY (date, category))"
        )
        handler.cursor.executemany(
            "INSERT INTO BudgetAllocations (date, category, limitAmount) VALUES (?, ?, ?)",
            [
                ("2026-04", "Food", 100),
                ("2026-05", "Food", 300),
            ],
        )
        handler.con.commit()

        handler.delete_budget_allocation("Food")
        handler.cursor.execute(
            "SELECT date, limitAmount FROM BudgetAllocations WHERE category=? ORDER BY date",
            ("Food",),
        )
        rows = handler.cursor.fetchall()
        self.assertEqual(rows, [("2026-05", 300.0)])

    def test_get_net_impact_sums_matching_scenarios(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.cursor.execute(
            "CREATE TABLE GoalScenarios (scenarioType TEXT, amount FLOAT, category TEXT)"
        )
        handler.cursor.executemany(
            "INSERT INTO GoalScenarios (scenarioType, amount, category) VALUES (?, ?, ?)",
            [
                ("expense", 12.5, "Food"),
                ("expense", None, "Food"),
                ("expense", 7.5, "Food"),
                ("income", 999, "Food"),
            ],
        )
        handler.con.commit()

        total = handler.get_net_impact("expense", "Food")
        self.assertEqual(total, 20.0)

    def test_add_category_routes_to_expected_table_and_cache(self):
        handler = make_handler_with_in_memory_db()
        self.addCleanup(handler.con.close)
        handler.expenseCategories = []
        handler.incomeCategories = []
        handler.cursor.execute(
            "CREATE TABLE ExpenseCategories (name TEXT PRIMARY KEY, amount FLOAT, color TEXT)"
        )
        handler.cursor.execute(
            "CREATE TABLE IncomeCategories (name TEXT PRIMARY KEY, amount FLOAT, color TEXT)"
        )

        handler.add_category(False, "Food", 0.0, "#112233")
        handler.add_category(True, "Salary", 0.0, "#445566")

        self.assertEqual(len(handler.expenseCategories), 1)
        self.assertEqual(handler.expenseCategories[0].name, "Food")
        self.assertEqual(len(handler.incomeCategories), 1)
        self.assertEqual(handler.incomeCategories[0].name, "Salary")

    def test_has_password_reflects_encrypted_flag(self):
        handler = main.CallHandler.__new__(main.CallHandler)
        handler.encrypted = True
        self.assertTrue(handler.has_password())
        handler.encrypted = False
        self.assertFalse(handler.has_password())


if __name__ == "__main__":
    unittest.main()
