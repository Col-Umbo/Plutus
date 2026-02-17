import sys
import os
import classes
import datetime
from PySide6.QtCore import QUrl
from PySide6.QtCore import QObject, Slot, QJsonValue
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
    # print(datetime.date.today().strftime('%m-%y'))
    cursor.execute('CREATE TABLE IF NOT EXISTS Categories (categoryName TEXT PRIMARY KEY, type TEXT, amount FLOAT, icon TEXT)')
    cursor.execute('CREATE TABLE IF NOT EXISTS Transactions (id INTEGER PRIMARY KEY, type TEXT, date TEXT, amount FLOAT, categoryName TEXT, recurring BOOL, frequency INTEGER, endDate TEXT, FOREIGN KEY(categoryName) REFERENCES Categories(categoryName))')
    cursor.execute('CREATE TABLE IF NOT EXISTS Goals (id INTEGER PRIMARY KEY, name TEXT, totalBalance FLOAT, remBalance FLOAT, monthlyAmount FLOAT, paidOff BOOL)')
    # cursor.execute('INSERT INTO Categories (categoryName, type, amount, icon) VALUES ("Rent", "Expense", 1199.99, "House")')
    con.commit()
    # # Sample password setting
    # cursor.execute("PRAGMA key = 'password'")
    
    # take an argument from javascript - JS:  handler.send_to_server('hello!')
    @Slot(QJsonValue)
    def send_to_server(self, *args):
        print('i got')
        print(args)
        for arg in args:
            print(arg.toString())
    @Slot(int,result=int)
    def int_test(self, v):
        print("number recieved")
        print(v)
        return v+1

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
        # In order to allow relative paths to work across different systems, follow the below example
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