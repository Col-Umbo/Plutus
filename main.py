import sys
import os
import classes
import datetime
from PySide6.QtCore import QUrl
from PySide6.QtCore import QObject, Slot, QJsonValue, QJsonArray
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QFileInfo
from PySide6.QtWebEngineCore import QWebEngineSettings
import sqlite3
from sqlcipher3 import dbapi2 as sqlite
import json
class CallHandler(QObject):
    # Define class structures
    con : sqlite.Connection
    cursor : sqlite.Cursor
    expenses =[]
    income = []
    budget : classes.Budget
    expenseCategories = []
    incomeCategories = []
    def __init__(self):
        super().__init__()
        # Open connection
        self.con = sqlite.connect("plutus.db")
        self.cursor = self.con.cursor()
        # Please note that the database expects all dates to follow the below format. Uncomment and test it if you're unsure what this means.
        # print(datetime.date.today().strftime('%m-%y'))
        self.cursor.execute('INSERT OR IGNORE INTO Budgets (date, amount) VALUES ("'+datetime.date.today().strftime('%m-%y')+'", 0.00)')
        self.con.commit()
        #
        self.cursor.execute('SELECT * FROM Income')
        income = self.cursor.fetchall()
        for row in income:
            self.income.append(classes.Income(*row))
        self.cursor.execute('SELECT * FROM Expenses')
        expenses = self.cursor.fetchall()
        for row in expenses:
            self.expenses.append(classes.Expense(*row))
        self.cursor.execute('SELECT amount FROM Budgets WHERE date="'+datetime.date.today().strftime('%m-%y')+'"')
        budget = self.cursor.fetchall()
        for row in budget:
            self.budget = classes.Budget(self.income, self.expenses, *row)
        self.cursor.execute('SELECT * FROM ExpenseCategories')
        categoryTable = self.cursor.fetchall()
        for row in categoryTable:
            # Split and parameterize DB entries
            self.expenseCategories.append(classes.ExpenseCategory(row[0], row[2], row[1]))
            expenses = self.cursor.execute('SELECT * FROM Expenses WHERE categoryName="'+row[0]+'"')
            for expense in expenses:
                self.expenseCategories[-1].transactions.append(classes.Expense(*expense))
        self.cursor.execute('SELECT * FROM IncomeCategories')
        categoryTable = self.cursor.fetchall()
        for row in categoryTable:
            # Split and parameterize DB entries
            self.incomeCategories.append(classes.IncomeCategory(row[0], row[2], row[1]))
            income = self.cursor.execute('SELECT * FROM Income WHERE categoryName="'+row[0]+'"')
            for incomeItem in income:
                self.incomeCategories[-1].transactions.append(classes.Income(*incomeItem))
    
    # time identifier / time keys (more for Budget and Goals pages)    
    def current_month_key(self):
        return datetime.date.today().strftime('%m-%y')

    def current_timestamp_ms(self):
        return int(datetime.datetime.now().timestamp() * 1000)

    # take an argument from javascript. These only work with @Slot defining the accepted and returned parameter types
    @Slot(str, float, str, bool, int, str, bool)
    def log_expense(self, name, amount, category, recurring, frequency, endDate, credit):
        today = datetime.date.today().strftime('%d-%m-%y')
        self.cursor.execute(
        '''
        INSERT INTO Expenses (date, name, amount, categoryName, recurring, frequency, endDate, credit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (today, name, amount, category, recurring, frequency, endDate, credit)
    )
        self.con.commit()
        new_id = self.cursor.lastrowid
        expense = classes.Expense(new_id, today, name, amount, category, recurring, frequency, endDate, credit)
        self.expenses.append(expense)

    @Slot(str, float, str, bool, int, str)
    def log_income(self, name, amount, category, recurring, frequency, endDate):
        today = datetime.date.today().strftime('%d-%m-%y')
        self.cursor.execute(
            '''
            INSERT INTO Income (date, name, amount, categoryName, recurring, frequency, endDate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (today, name, amount, category, recurring, frequency, endDate)
        )
        self.con.commit()
        new_id = self.cursor.lastrowid
        income = classes.Income(new_id, today, name, amount, category, recurring, frequency, endDate)
        self.income.append(income)

    @Slot(str, result=str)
    def get_expenses(self, month):
        return json.dumps([expense.__dict__ for expense in self.expenses],default=vars)
    @Slot(str, result=str)
    def get_income(self, month):
        return json.dumps([income.__dict__ for income in self.income],default=vars)
    @Slot(int)
    def delete_expense(self, id):
        self.cursor.execute("DELETE FROM Expenses WHERE id=?",(id,))
        self.con.commit()
        for expense in self.budget.expenses:
            if expense.id == id:
                self.budget.expenses.remove(expense)
                break
    @Slot(int)
    def delete_income(self, id):
        self.cursor.execute("DELETE FROM Income WHERE id=?",(id,))
        self.con.commit()
        for income in self.budget.income:
            if income.id == id:
                self.budget.income.remove(income)
                break
    @Slot(result=str)
    def get_expense_categories(self):
        return json.dumps([category.__dict__ for category in self.expenseCategories],default=vars)
    @Slot(result=str)
    def get_income_categories(self):
        return json.dumps([category.__dict__ for category in self.incomeCategories],default=vars)
    @Slot(str)
    def delete_expense_category(self, name):
        self.cursor.execute("DELETE FROM ExpenseCategories WHERE name=?",(name,))
        self.con.commit()
        for category in self.expenseCategories:
            if category.name == name:
                self.expenseCategories.remove(category)
                break
    @Slot(str)
    def delete_income_category(self, name):
        self.cursor.execute("DELETE FROM IncomeCategories WHERE name=?",(name,))
        self.con.commit()
        for category in self.incomeCategories:
            if category.name == name:
                self.incomeCategories.remove(category)
                break
    @Slot(bool, str, float, str)
    def add_category(self, categoryType, name, amount, color):
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
        self.cursor.execute(
            'DELETE FROM GoalScenarios WHERE id = ?',
            (scenario_id,)
        )
        self.con.commit()
    @Slot()
    def clear_goal_scenarios(self):
        self.cursor.execute('DELETE FROM GoalScenarios')
        self.con.commit()
    @Slot(str, str, result=float)
    def get_net_impact(self, scenarioType, category):
        self.cursor.execute('SELECT amount FROM GoalScenarios WHERE scenarioType=? AND category=?',(scenarioType,category))
        rows = self.cursor.fetchall()
        amount = 0.00
        for row in rows:
            amount+=row
        return amount
    # end of items added
    
    @Slot(str)
    def delete_expense_category(self, name):
        self.cursor.execute('DELETE FROM ExpenseCategories WHERE name=?',(name,))
    @Slot(str)
    def delete_income_category(self, name):
        self.cursor.execute('DELETE FROM IncomeCategories WHERE name=?',(name,))

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        # Create a QWebEngineView widget
        self.browser = QWebEngineView()
        self.browser.channel = QWebChannel()
        self.browser.handler = CallHandler()
        self.browser.channel.registerObject('handler', self.browser.handler)
        self.browser.page().setWebChannel(self.browser.channel)
        self.browser.settings().setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        # Load html file
        if os.path.isdir('_internal'):
            # This conditional is necessary in order for the executable to load index.html properly. From there, everything else should load just fine.
            local_html = QUrl.fromLocalFile(QFileInfo("_internal"+os.pathsep+"index.html").absoluteFilePath())
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
        cursor.execute('CREATE TABLE IF NOT EXISTS Expenses (id INTEGER PRIMARY KEY, date TEXT, name TEXT, amount FLOAT, categoryName TEXT, recurring BOOL, frequency INTEGER, endDate TEXT, credit BOOL, FOREIGN KEY (categoryName) REFERENCES ExpenseCategories(name))')
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