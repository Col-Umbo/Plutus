import sys
import os
import classes
import datetime
import pandas
from PySide6.QtCore import QUrl
from PySide6.QtCore import QObject, Slot, QJsonValue, QJsonArray, Signal, QTimer
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QFileInfo
from PySide6.QtWebEngineCore import QWebEngineSettings
from PySide6.QtWidgets import QInputDialog, QMessageBox
import sqlite3
from sqlcipher3 import dbapi2 as sqlite
import json
import hashlib

class CallHandler(QObject):
    database_changed = Signal(str)
    # Define class structures
    password = ""
    con : sqlite.Connection
    cursor : sqlite.Cursor
    expenses =[]
    income = []
    budget : classes.Budget
    expenseCategories = []
    incomeCategories = []
    encrypted = False
    def __init__(self):
        super().__init__()
        # Open connection
        self.con = sqlite.connect("plutus.db")
        self.cursor = self.con.cursor()
        # Please note that the database expects all dates to follow the below format. Uncomment and test it if you're unsure what this means.
        # print(datetime.date.today().strftime('%Y-%m-%d'))
        try:
            self.cursor.execute('INSERT OR IGNORE INTO Budgets (date, amount) VALUES ("'+datetime.date.today().strftime('%Y-%m')+'", 0.00)')
            self.con.commit()
            self._reload_cache()
            self._last_data_version = self._read_data_version()
            self.con.commit()
            self._db_watch_timer = QTimer(self)
            self._db_watch_timer.setInterval(1000)
            self._db_watch_timer.timeout.connect(self._check_external_db_changes)
            self._db_watch_timer.start()
            self.encrypted = False
        except sqlite.Error:
            self.encrypted = True
            self._last_data_version = 1

    def _unlock(self):
        if self.encrypted:
            self.cursor.execute("PRAGMA key = '"+self.password+"'")
        
    def _read_data_version(self):
        try:
            self.cursor.execute('PRAGMA data_version')
            row = self.cursor.fetchone()
            return int(row[0]) if row else 0
        except sqlite.Error:
            return self._last_data_version

    def _check_external_db_changes(self):
        current = self._read_data_version()
        if current == self._last_data_version:
            return
        self._last_data_version = current
        self._reload_cache()
        self.database_changed.emit("external")

    def _reload_cache(self):
        self.expenses = []
        self.income = []
        self.expenseCategories = []
        self.incomeCategories = []

        self.cursor.execute('SELECT * FROM Income')
        income = self.cursor.fetchall()
        for row in income:
            self.income.append(classes.Income(*row))
        self.cursor.execute('SELECT * FROM Expenses')
        expenses = self.cursor.fetchall()
        for row in expenses:
            self.expenses.append(classes.Expense(*row))
        self.cursor.execute('SELECT amount FROM Budgets WHERE date="'+datetime.date.today().strftime('%Y-%m')+'"')
        budget = self.cursor.fetchall()
        for row in budget:
            self.budget = classes.Budget(self.income, self.expenses, *row)
        self.cursor.execute('SELECT * FROM ExpenseCategories')
        categoryTable = self.cursor.fetchall()
        for row in categoryTable:
            # Split and parameterize DB entries
            self.expenseCategories.append(classes.ExpenseCategory(row[0], row[2], row[1]))
            expenses = self.cursor.execute(
                'SELECT * FROM Expenses WHERE categoryName = ?',
                (row[0],)
            )
            for expense in expenses:
                self.expenseCategories[-1].transactions.append(classes.Expense(*expense))
                if expense[5] == True and datetime.date.today() >= datetime.datetime.strptime(expense[1], "%Y-%m-%d").date() + datetime.timedelta(expense[6]) and datetime.date.today().strftime('%Y-%m-%d') <= expense[7]:
                    self.cursor.execute("UPDATE Expenses SET recurring = 0 WHERE id = ?",(expense[0],))
                    self.con.commit()
                    if datetime.date.today().strftime('%d-%m-%Y') == expense[7]:
                        self.log_expense(expense[2],expense[3],expense[4],expense[5],expense[6],expense[7],False)
                    else:
                        self.log_expense(expense[2],expense[3],expense[4],False,0,datetime.date.today().strftime('%d-%m-%Y'),False)
                    continue

        self.cursor.execute('SELECT * FROM IncomeCategories')
        categoryTable = self.cursor.fetchall()
        for row in categoryTable:
            # Split and parameterize DB entries
            self.incomeCategories.append(classes.IncomeCategory(row[0], row[2], row[1]))
            income = self.cursor.execute(
                'SELECT * FROM Income WHERE categoryName = ?',
                (row[0],)
            )
            for incomeItem in income:
                self.incomeCategories[-1].transactions.append(classes.Income(*incomeItem))
    
    # time identifier / time keys (more for Budget and Goals pages)    
    def current_month_key(self):
        return datetime.date.today().strftime('%Y-%m')

    def current_timestamp_ms(self):
        return int(datetime.datetime.now().timestamp() * 1000)

    # take an argument from javascript. These only work with @Slot defining the accepted and returned parameter types
    @Slot(str, str, float, str, bool, int, str)
    def log_expense(self, date, name, amount, category, recurring, frequency, endDate):
        self._unlock()
        self.cursor.execute(
        '''
        INSERT INTO Expenses (date, name, amount, categoryName, recurring, frequency, endDate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''',
        (date, name, amount, category, recurring, frequency, endDate)
    )
        self.con.commit()
        new_id = self.cursor.lastrowid
        expense = classes.Expense(new_id, today, name, amount, category, recurring, frequency, endDate)
        self.expenses.append(expense)

    @Slot(str, str, float, str, bool, int, str)
    def log_income(self, date, name, amount, category, recurring, frequency, endDate):
        self.cursor.execute(
            '''
            INSERT INTO Income (date, name, amount, categoryName, recurring, frequency, endDate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (date, name, amount, category, recurring, frequency, endDate)
        )
        self.con.commit()
        new_id = self.cursor.lastrowid
        income = classes.Income(new_id, today, name, amount, category, recurring, frequency, endDate)
        self.income.append(income)
        
    # Edit Categories and Transactions
    @Slot(str, str, float, str, bool, int, str)
    def add_expense_with_date(self, date, name, amount, category, recurring, frequency, endDate):
        print("Method called")
        self._unlock()
        self.cursor.execute(
            '''
            INSERT INTO Expenses (date, name, amount, categoryName, recurring, frequency, endDate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (date, name, amount, category, recurring, frequency, endDate)
        )
        print("sql executed")
        self.con.commit()
        self._reload_cache()

    @Slot(str, str, float, str, bool, int, str)
    def add_income_with_date(self, date, name, amount, category, recurring, frequency, endDate):
        self._unlock()
        self.cursor.execute(
            '''
            INSERT INTO Income (date, name, amount, categoryName, recurring, frequency, endDate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (date, name, amount, category, recurring, frequency, endDate)
        )
        self.con.commit()
        self._reload_cache()

    @Slot(int, str, str, float, str, bool, int, str)
    def update_expense(self, expense_id, date, name, amount, category, recurring, frequency, endDate):
        self._unlock()
        self.cursor.execute(
            '''
            UPDATE Expenses
            SET date = ?, name = ?, amount = ?, categoryName = ?, recurring = ?, frequency = ?, endDate = ?
            WHERE id = ?
            ''',
            (date, name, amount, category, recurring, frequency, endDate, expense_id)
        )
        self.con.commit()
        self._reload_cache()

    @Slot(int, str, str, float, str, bool, int, str)
    def update_income(self, income_id, date, name, amount, category, recurring, frequency, endDate):
        self._unlock()
        self.cursor.execute(
            '''
            UPDATE Income
            SET date = ?, name = ?, amount = ?, categoryName = ?, recurring = ?, frequency = ?, endDate = ?
            WHERE id = ?
            ''',
            (date, name, amount, category, recurring, frequency, endDate, income_id)
        )
        self.con.commit()
        self._reload_cache()

    @Slot(str, str, str)
    def update_expense_category(self, old_name, new_name, color):
        self._unlock()
        self.cursor.execute(
            'UPDATE ExpenseCategories SET name = ?, color = ? WHERE name = ?',
            (new_name, color, old_name)
        )
        self.cursor.execute(
            'UPDATE Expenses SET categoryName = ? WHERE categoryName = ?',
            (new_name, old_name)
        )
        self.cursor.execute(
            'UPDATE BudgetAllocations SET category = ? WHERE category = ?',
            (new_name, old_name)
        )
        self.con.commit()
        self._reload_cache()

    @Slot(str, str, str)
    def update_income_category(self, old_name, new_name, color):
        self._unlock()
        self.cursor.execute(
            'UPDATE IncomeCategories SET name = ?, color = ? WHERE name = ?',
            (new_name, color, old_name)
        )
        self.cursor.execute(
            'UPDATE Income SET categoryName = ? WHERE categoryName = ?',
            (new_name, old_name)
        )
        self.cursor.execute(
            'UPDATE BudgetAllocations SET category = ? WHERE category = ?',
            (new_name, old_name)
        )
        self.con.commit()
        self._reload_cache()
    # End of edit Categories and Transactions

    @Slot (str, int, float, str, bool, int, str)
    def edit_expense(self, id, name, amount, category, recurring, frequency, endDate):
        # Flesh this out later
        self.cursor.execute("UPDATE Expenses SET (name, amount, categoryName, recurring, frequency, endDate) = (?,?,?,?,?,?) WHERE id = ?",(name, amount, category, recurring, frequency, endDate, id))
    @Slot(str, result=str)
    def get_expenses(self, month):
        self._unlock()
        return json.dumps([expense.__dict__ for expense in self.expenses],default=vars)
    @Slot(str, result=str)
    def get_income(self, month):
        self._unlock()
        return json.dumps([income.__dict__ for income in self.income],default=vars)
    @Slot(int)
    def delete_expense(self, id):
        self._unlock()
        self.cursor.execute("DELETE FROM Expenses WHERE id=?",(id,))
        self.con.commit()
        for expense in self.budget.expenses:
            if expense.id == id:
                self.budget.expenses.remove(expense)
                break
    @Slot(int)
    def delete_income(self, id):
        self._unlock()
        self.cursor.execute("DELETE FROM Income WHERE id=?",(id,))
        self.con.commit()
        for income in self.budget.income:
            if income.id == id:
                self.budget.income.remove(income)
                break
    @Slot(result=str)
    def get_expense_categories(self):
        self._unlock()
        return json.dumps([category.__dict__ for category in self.expenseCategories],default=vars)
    @Slot(result=str)
    def get_income_categories(self):
        self._unlock()
        return json.dumps([category.__dict__ for category in self.incomeCategories],default=vars)
    @Slot(str)
    def delete_expense_category(self, name):
        self._unlock()
        self.cursor.execute("DELETE FROM ExpenseCategories WHERE name=?",(name,))
        self.cursor.execute("DELETE FROM Expenses WHERE categoryName=?",(name,))
        self.cursor.execute("DELETE FROM BudgetAllocations WHERE category=?",(name,))
        self.con.commit()
        for expense in self.expenses:
            if expense.category == name:
                self.expenses.remove(expense)
        for category in self.expenseCategories:
            if category.name == name:
                self.expenseCategories.remove(category)
                break
    @Slot(str)
    def delete_income_category(self, name):
        self._unlock()
        self.cursor.execute("DELETE FROM IncomeCategories WHERE name=?",(name,))
        self.cursor.execute("DELETE FROM Income WHERE categoryName=?",(name,))
        self.cursor.execute("DELETE FROM BudgetAllocations WHERE category=?",(name,))
        self.con.commit()
        for income in self.income:
            if income.category == name:
                self.income.remove(income)
        for category in self.incomeCategories:
            if category.name == name:
                self.incomeCategories.remove(category)
                break
    @Slot(bool, str, float, str)
    def add_category(self, categoryType, name, amount, color):
        self._unlock()
        if categoryType is False:
            self.cursor.execute(
                'INSERT INTO ExpenseCategories (name, amount, color) VALUES (?, ?, ?)',
                (name, amount, color)
            )
            self.expenseCategories.append(classes.ExpenseCategory(name, color, amount))
        else:
            self.cursor.execute(
                'INSERT INTO IncomeCategories (name, amount, color) VALUES (?, ?, ?)',
                (name, amount, color)
            )
            self.incomeCategories.append(classes.IncomeCategory(name, color, amount))
        self.con.commit()
    
    # I (Ethan) added this
    @Slot(float)
    def set_budget_amount(self, amount):
        self._unlock()
        month = self.current_month_key()
        self.cursor.execute(
            '''
            INSERT INTO Budgets (date, amount)
            VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET amount=excluded.amount
            ''',
            (month, amount)
        )
        self.con.commit()
    @Slot(result=str)
    def get_budget_amount(self):
        self._unlock()
        month = self.current_month_key()
        self.cursor.execute(
            'SELECT amount FROM Budgets WHERE date = ?',
            (month,)
        )
        row = self.cursor.fetchone()
        amount = float(row[0]) if row else 0.0
        return json.dumps({
            "date": month,
            "amount": amount
        })
    @Slot(str, float)
    def upsert_budget_allocation(self, category, limitAmount):
        self._unlock()
        month = self.current_month_key()
        self.cursor.execute(
            '''
            INSERT INTO BudgetAllocations (date, category, limitAmount)
            VALUES (?, ?, ?)
            ON CONFLICT(date, category) DO UPDATE SET limitAmount=excluded.limitAmount
            ''',
            (month, category, limitAmount)
        )
        self.con.commit()
    @Slot(str)
    def delete_budget_allocation(self, category):
        month = self.current_month_key()
        self.cursor.execute(
            'DELETE FROM BudgetAllocations WHERE date = ? AND category = ?',
            (month, category)
        )
        self.con.commit()
    @Slot(result=str)
    def get_budget_allocations(self):
        self._unlock()
        month = self.current_month_key()
        self.cursor.execute(
            'SELECT category, limitAmount FROM BudgetAllocations WHERE date = ? ORDER BY category COLLATE NOCASE',
            (month,)
        )
        rows = self.cursor.fetchall()
        return json.dumps([
            {"category": row[0], "limit": float(row[1])}
            for row in rows
        ])
    
    # GOALS
    @Slot(str, float, str, str, str)
    def add_goal_scenario(self, scenarioType, amount, category, name, note):
        self._unlock()
        createdAt = self.current_timestamp_ms()
        self.cursor.execute(
            '''
            INSERT INTO GoalScenarios (scenarioType, amount, category, name, note, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (scenarioType, amount, category, name, note, createdAt)
        )
        self.con.commit()
    @Slot(result=str)
    def get_goal_scenarios(self):
        self._unlock()
        self.cursor.execute(
            '''
            SELECT id, scenarioType, amount, category, name, note, createdAt
            FROM GoalScenarios
            ORDER BY createdAt DESC, id DESC
            '''
        )
        rows = self.cursor.fetchall()
        return json.dumps([
            {
                "id": row[0],
                "type": row[1],
                "amount": float(row[2]),
                "category": row[3],
                "name": row[4],
                "note": row[5] or "",
                "createdAt": int(row[6] or 0)
            }
            for row in rows
        ])
    @Slot(int)
    def delete_goal_scenario(self, scenario_id):
        self._unlock()
        self.cursor.execute(
            'DELETE FROM GoalScenarios WHERE id = ?',
            (scenario_id,)
        )
        self.con.commit()
    @Slot()
    def clear_goal_scenarios(self):
        self._unlock()
        self.cursor.execute('DELETE FROM GoalScenarios')
        self.con.commit()
    @Slot(str, str, result=float)
    def get_net_impact(self, scenarioType, category):
        self._unlock()
        self.cursor.execute('SELECT amount FROM GoalScenarios WHERE scenarioType=? AND category=?',(scenarioType,category))
        rows = self.cursor.fetchall()
        amount = 0.00
        for row in rows:
            amount += float(row[0] or 0.0)
        return amount


    @Slot(str)
    def set_password(self, password):
        # Unfortunately variables do not work on PRAGMA statements. Casting is a necessary flaw here.
        if not self.encrypted:
            self.cursor.execute("ATTACH DATABASE 'encrypted.db' AS encrypted KEY '"+password+"'")
            self.cursor.execute("SELECT sqlcipher_export('encrypted')")
            self.cursor.execute("DETACH DATABASE encrypted")
            self.con.commit()
            self.con.close()
            os.remove("plutus.db")
            os.rename("encrypted.db","plutus.db")
            self.con = sqlite.connect("plutus.db")
            self.cursor = self.con.cursor()
            self._unlock()
            self.cursor.execute("PRAGMA cipher_use_hmac=off")
            self.password = password
            self.encrypted = True
        else:
            self.cursor.execute("PRAGMA rekey = '"+password+"'")
        
    @Slot(result=bool)
    def disable_password_lock(self):
        connection_closed = False
        try:
            self._unlock()
            try:
                self.cursor.execute("DETACH DATABASE plaintext")
            except Exception:
                pass
            if os.path.exists("plaintext.db"):
                os.remove("plaintext.db")
            self.cursor.execute("ATTACH DATABASE 'plaintext.db' AS plaintext KEY ''")
            self.cursor.execute("SELECT sqlcipher_export('plaintext')")
            self.cursor.execute("DETACH DATABASE plaintext")
            self.con.commit()
            self.con.close()
            connection_closed = True
            os.remove("plutus.db")
            os.rename("plaintext.db","plutus.db")
            self.con = sqlite.connect("plutus.db")
            self.cursor = self.con.cursor()
            self.password = ""
            self.encrypted = False
            return True
        except Exception:
            try:
                self.cursor.execute("DETACH DATABASE plaintext")
            except Exception:
                pass
            if not connection_closed:
                try:
                    self.con.close()
                except Exception:
                    pass
            try:
                self.con = sqlite.connect("plutus.db")
                self.cursor = self.con.cursor()
                if self.encrypted and self.password:
                    self._unlock()
            except Exception:
                pass
            return False
    @Slot(str, result=bool)
    def check_password(self, password):
        self._db_watch_timer.stop()
        self.con.close()
        self.con = sqlite.connect("plutus.db")
        self.cursor = self.con.cursor()
        self.cursor.execute("PRAGMA key ='"+password+"'")
        try:
            self.cursor.execute("SELECT count(*) FROM sqlite_master;")
            return True
        except sqlite.Error:
            self._unlock()
            self._db_watch_timer.start()
            return False
    @Slot(str, result=bool)
    def verify_password(self, password):
        self.cursor.execute("PRAGMA key ='"+password+"'")
        try:
            self.cursor.execute("SELECT count(*) FROM sqlite_master;")
            #This tests if the password was actually correct
            self._check_external_db_changes()
            self._db_watch_timer = QTimer(self)
            self._db_watch_timer.setInterval(1000)
            self._db_watch_timer.timeout.connect(self._check_external_db_changes)
            self._db_watch_timer.start()
            self.password = password
            return True
        except sqlite.Error:
            return False

    @Slot(result=bool)
    def has_password(self):
        return self.encrypted
    @Slot(str,result=bool)
    def import_csv(self,path):
        # Usecols should be a list, then iterated over in a lambda function.
        columns = ['Date','date','Description','Category','categoryName','name','Amount','amount','recurring','frequency','endDate']
        df = pandas.read_csv(path, usecols = lambda x: x in columns)
        # Read csv and normalize column names
        if 'Date' in df.columns:
            # External banking csv. Rename columns and add missing.
            df = df.rename(columns={'Date':'date','Description':'name','Category':'categoryName','Amount':'amount'})
            df['date'] = pandas.to_datetime(df['date']).dt.strftime("%Y-%m-%d")
            df['amount'] = df['amount'].replace(r'[^.0-9\-]', '', regex=True).astype(float)
            expenses = df[df['amount']<0]
            income = df[df['amount']>=0]
            expenses['amount'] = expenses['amount'].apply(lambda x: x*-1)
            expenses = expenses.assign(categoryName="Imported Expenses",recurring=False,frequency=0,endDate=lambda x: x['date'])        
            income = income.assign(categoryName="Imported Income",recurring=False,frequency=0,endDate=lambda x: x['date'])        
        else:
            # Exported transactions. Column names and contents do not need to be modified
            df['date'] = pandas.to_datetime(df['date']).dt.strftime("%Y-%m-%d")
            df['amount'] = df['amount'].replace(r'[^.0-9\-]', '', regex=True).astype(float)
            expenses = df[dataframe['amount']<0]
            expenses['amount'] = expenses['amount'].apply(lambda x: x*-1)
            income = df[dataframe['amount']>=0]
        # Reordering expenses and income
        expenses = expenses[['date','name','categoryName','amount','recurring','frequency','endDate']]
        income = income[['date','name','categoryName','amount','recurring','frequency','endDate']]
        try:
            expenses.to_sql("Expenses", self.con, schema=None, if_exists='append', index=False, index_label=None, chunksize=None, dtype=None, method=None)
            income.to_sql("Income", self.con, schema=None, if_exists='append', index=False, index_label=None, chunksize=None, dtype=None, method=None)
            return True
        except sqlite.Error as e:
            return False

    @Slot(str,result=bool)
    def export_csv(self,path):
        db = pd.read_sql("SELECT * FROM Expenses UNION ALL SELECT * FROM Income", self.con)
        try:
            db.to_csv(path, index=False)
            return True
        except error:
            #Failure indicator to notify user to try again.
            return False




        
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        # Create a QWebEngineView widget
        self.browser = QWebEngineView()
        self.browser.settings().setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars,False)
        self.browser.channel = QWebChannel()
        self.browser.handler = CallHandler()
        self.browser.channel.registerObject('handler', self.browser.handler)
        self.browser.page().setWebChannel(self.browser.channel)
        self.browser.settings().setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        # Load html file
        if os.path.isdir('_internal'):
            # This conditional is necessary in order for the executable to load index.html properly. From there, everything else should load just fine.
            local_html = QUrl.fromLocalFile(QFileInfo("_internal/index.html").absoluteFilePath())
        else:
            local_html = QUrl.fromLocalFile(QFileInfo("index.html").absoluteFilePath())
        self.browser.setUrl(local_html)

        self.setCentralWidget(self.browser)
        self.showMaximized()
        self.setWindowTitle("Plutus Budget Tracker")

if __name__ == '__main__':
    if os.path.isfile("plutus.db") == False:
        con = sqlite.connect("plutus.db")
        cursor = con.cursor()
        # Initial DB setup
        cursor.execute('CREATE TABLE IF NOT EXISTS Budgets (date TEXT PRIMARY KEY, amount FLOAT)')
        cursor.execute('CREATE TABLE IF NOT EXISTS ExpenseCategories (name TEXT PRIMARY KEY, amount FLOAT, color TEXT)')
        cursor.execute('CREATE TABLE IF NOT EXISTS IncomeCategories (name TEXT PRIMARY KEY, amount FLOAT, color TEXT)')
        cursor.execute('CREATE TABLE IF NOT EXISTS Income (id INTEGER PRIMARY KEY, date TEXT, name TEXT, amount FLOAT, categoryName TEXT, recurring BOOL, frequency INTEGER, endDate TEXT, FOREIGN KEY (categoryNAME) REFERENCES IncomeCategories(name))')
        cursor.execute('CREATE TABLE IF NOT EXISTS Expenses (id INTEGER PRIMARY KEY, date TEXT, name TEXT, amount FLOAT, categoryName TEXT, recurring BOOL, frequency INTEGER, endDate TEXT, FOREIGN KEY (categoryName) REFERENCES ExpenseCategories(name))')
        # cursor.execute('CREATE TABLE IF NOT EXISTS Goals (id INTEGER PRIMARY KEY, name TEXT, totalBalance FLOAT, remBalance FLOAT, monthlyAmount FLOAT, paidOff BOOL)')
        
        # I (Ethan) added this
        cursor.execute('CREATE TABLE IF NOT EXISTS BudgetAllocations (date TEXT, category TEXT, limitAmount FLOAT, PRIMARY KEY (date, category))')
        cursor.execute('CREATE TABLE IF NOT EXISTS Goals (id INTEGER PRIMARY KEY AUTOINCREMENT, scenarioType TEXT, amount FLOAT, category TEXT, name TEXT, note TEXT, createdAt INTEGER)')
        cursor.execute('CREATE TABLE IF NOT EXISTS GoalScenarios (id INTEGER PRIMARY KEY AUTOINCREMENT, scenarioType, amount, category, name, note, createdAt)')
        # Default categories
        cursor.execute('INSERT INTO ExpenseCategories (name, amount, color) VALUES ("Bills", 0.00, "#fc0519");')
        cursor.execute('INSERT INTO ExpenseCategories (name, amount, color) VALUES ("Groceries", 0.00, "#0765fc");')
        cursor.execute('INSERT INTO ExpenseCategories (name, amount, color) VALUES ("Subscriptions", 0.00, "#fce307");')
        cursor.execute('INSERT INTO IncomeCategories (name, amount, color) VALUES ("Paycheck", 0.00, "#10f900")')
        con.commit()
        con.close()
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
