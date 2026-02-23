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
        income = self.cursor.execute('SELECT * FROM Income')
        for row in income:
            self.income.append(classes.Income(*row))
        expenses = self.cursor.execute('SELECT * FROM Expenses')
        for row in expenses:
            self.expenses.append(classes.Expense(*row))
        self.budget = classes.Budget(self.income, self.expenses)
        categoryTable = self.cursor.execute('SELECT * FROM ExpenseCategories')
        for row in categoryTable:
            # Split and parameterize DB entries
            name, amount, color = row
            self.expenseCategories.append(classes.ExpenseCategory(name, color, float(amount)))
        categoryTable = self.cursor.execute('SELECT * FROM IncomeCategories')
        for row in categoryTable:
            # Split and parameterize DB entries
            name, amount, color = row
            self.incomeCategories.append(classes.IncomeCategory(name, color, float(amount)))
    
    
    # take an argument from javascript. These only work with @Slot defining the accepted and returned parameter types
    # --- Transactions ---
    # Keep the original slots for compatibility (they default to "today").
    @Slot(str, float, str, bool, int, str, bool)
    def log_expense(self, name, amount, category, recurring, frequency, endDate, credit):
        date = datetime.date.today().strftime('%d-%m-%y')
        self.log_expense_with_date(date, name, amount, category, recurring, frequency, endDate, credit)

    @Slot(str, float, str, bool, int, str)
    def log_income(self, name, amount, category, recurring, frequency, endDate):
        date = datetime.date.today().strftime('%d-%m-%y')
        self.log_income_with_date(date, name, amount, category, recurring, frequency, endDate)

    # "date-aware" slots. date must be 'DD-MM-YY' (to match your existing DB convention).
    @Slot(str, str, float, str, bool, int, str, bool)
    def log_expense_with_date(self, date, name, amount, category, recurring, frequency, endDate, credit):
        self.cursor.execute(
            "INSERT INTO Expenses (date, name, amount, categoryName, recurring, frequency, endDate, credit) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (date, name, float(amount), category, int(bool(recurring)), int(frequency), endDate, int(bool(credit)))
        )
        self.con.commit()

    @Slot(str, str, float, str, bool, int, str)
    def log_income_with_date(self, date, name, amount, category, recurring, frequency, endDate):
        self.cursor.execute(
            "INSERT INTO Income (date, name, amount, categoryName, recurring, frequency, endDate) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (date, name, float(amount), category, int(bool(recurring)), int(frequency), endDate)
        )
        self.con.commit()
   
    # --- Delete transactions (kind-of works...) ---
    @Slot(int)
    def delete_expense(self, expense_id):
        self.cursor.execute("DELETE FROM Expenses WHERE id = ?", (int(expense_id),))
        self.con.commit()

    @Slot(int)
    def delete_income(self, income_id):
        self.cursor.execute("DELETE FROM Income WHERE id = ?", (int(income_id),))
        self.con.commit()
    
    # --- Queries (DB-backed) ---
    @Slot(str, result=str)
    def get_expenses(self, month):
        rows = self.cursor.execute('SELECT * FROM Expenses').fetchall()
        expenses = [classes.Expense(*row).__dict__ for row in rows]
        return json.dumps(expenses)

    @Slot(str, result=str)
    def get_income(self, month):
        rows = self.cursor.execute('SELECT * FROM Income').fetchall()
        income = [classes.Income(*row).__dict__ for row in rows]
        return json.dumps(income)

    @Slot(result=str)
    def get_expense_categories(self):
        rows = self.cursor.execute('SELECT * FROM ExpenseCategories').fetchall()
        cats = [classes.ExpenseCategory(name, color, float(amount)).__dict__ for (name, amount, color) in rows]
        return json.dumps(cats)

    @Slot(result=str)
    def get_income_categories(self):
        rows = self.cursor.execute('SELECT * FROM IncomeCategories').fetchall()
        cats = [classes.IncomeCategory(name, color, float(amount)).__dict__ for (name, amount, color) in rows]
        return json.dumps(cats)

    # --- Categories ---
    @Slot(bool, str, float, str)
    def add_category(self, categoryType, name, amount, color):
        if categoryType == False:
            self.cursor.execute(
                'INSERT INTO ExpenseCategories (name, amount, color) VALUES (?, ?, ?)',
                (name, float(amount), color)
            )
            # classes.ExpenseCategory expects (name, color, amount) in that order, so made changes here.
            self.expenseCategories.append(classes.ExpenseCategory(name, color, float(amount)))
        elif categoryType == True:
            self.cursor.execute(
                'INSERT INTO IncomeCategories (name, amount, color) VALUES (?, ?, ?)',
                (name, float(amount), color)
            )
            self.incomeCategories.append(classes.IncomeCategory(name, color, float(amount)))
        self.con.commit()

    @Slot(bool, str)
    def delete_category(self, is_income, name):
        table = "IncomeCategories" if bool(is_income) else "ExpenseCategories"
        self.cursor.execute(f"DELETE FROM {table} WHERE name = ?", (name,))
        self.con.commit()

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
        cursor.execute('CREATE TABLE IF NOT EXISTS Goals (id INTEGER PRIMARY KEY, name TEXT, totalBalance FLOAT, remBalance FLOAT, monthlyAmount FLOAT, paidOff BOOL)')
        # Default categories
        cursor.execute('INSERT INTO ExpenseCategories (name, amount, color) VALUES ("Bills", 0.00, "#ffffff"), ("Groceries", 0.00, "#ffffff"), ("Subscriptions", 0.00, "#ffffff");')
        cursor.execute('INSERT INTO IncomeCategories (name, amount, color) VALUES ("Paycheck", 0.00, "#ffffff")')
        con.commit()
        con.close()
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())