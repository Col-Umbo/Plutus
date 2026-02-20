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
    # Open sqlite connection
    con = sqlite.connect("plutus.db")
    cursor = con.cursor()
    expenses =[]
    income = []
    budget : classes.Budget
    expenseCategories = []
    incomeCategories = []
    def __init__(self):
        super().__init__()
        # Please note that the database expects all dates to follow the below format. Uncomment and test it if you're unsure what this means.
        # print(datetime.date.today().strftime('%m-%y'))
        self.cursor.execute('CREATE TABLE IF NOT EXISTS Budgets (date TEXT PRIMARY KEY, amount FLOAT, difference FLOAT, over BOOL)')
        try:
            self.cursor.execute('INSERT INTO Budgets (date, amount, difference, over) VALUES ("'+datetime.date.today().strftime('%m-%y')+'", 0.00, 0.00, False)')
        except sqlite.IntegrityError as e:
            print("Budget entry already exists. Skipping.")
        self.cursor.execute('CREATE TABLE IF NOT EXISTS ExpenseCategories (name TEXT PRIMARY KEY, amount FLOAT, color TEXT)')
        self.cursor.execute('CREATE TABLE IF NOT EXISTS IncomeCategories (name TEXT PRIMARY KEY, amount FLOAT, color TEXT)')
        self.cursor.execute('CREATE TABLE IF NOT EXISTS Income (id INTEGER PRIMARY KEY, date TEXT, amount FLOAT, categoryName TEXT, recurring BOOL, frequency INTEGER, endDate TEXT, FOREIGN KEY (categoryNAME) REFERENCES IncomeCategories(name))')
        self.cursor.execute('CREATE TABLE IF NOT EXISTS Expenses (id INTEGER PRIMARY KEY, date TEXT, amount FLOAT, categoryName TEXT, recurring BOOL, frequency INTEGER, endDate TEXT, credit BOOL, FOREIGN KEY (categoryName) REFERENCES ExpenseCategories(name))')
        self.cursor.execute('CREATE TABLE IF NOT EXISTS Goals (id INTEGER PRIMARY KEY, name TEXT, totalBalance FLOAT, remBalance FLOAT, monthlyAmount FLOAT, paidOff BOOL)')
        self.con.commit()
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
            self.expenseCategories.append(classes.Category(*row))
        categoryTable = self.cursor.execute('SELECT * FROM IncomeCategories')
        for row in categoryTable:
            # Split and parameterize DB entries
            self.incomeCategories.append(classes.Category(*row))
    
    
    # take an argument from javascript
    @Slot(float, str, bool, int, str, bool)
    def log_expense(self, amount, category, recurring, frequency, endDate, credit):
        self.cursor.execute('INSERT INTO Expenses (date, amount, categoryName, recurring, frequency, endDate, credit) VALUES ("'+datetime.date.today().strftime('%d-%m-%y')+'", '+str(amount)+', "'+category+'", '+str(recurring)+', '+str(frequency)+', "'+endDate+'",'+str(credit)+')')
        self.con.commit()
        self.expenses.append(classes.Expense(self.expenses[-1].id+1,datetime.date.today().strftime('%d-%m-%y'), amount, category, recurring, frequency, endDate, credit))
        test = self.cursor.execute('SELECT * FROM Expenses')
    @Slot(str, result=str)
    def get_expenses(self, month):
        return json.dumps([expense.__dict__ for expense in self.expenses])
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
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())