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
from PySide6.QtWebEngineCore import QWebEnginePage
from PySide6.QtGui import QShortcut, QKeySequence
from PySide6.QtCore import Qt

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

        # Create the main web view ONCE
        self.browser = QWebEngineView(self)

        from PySide6.QtWidgets import QDockWidget

        # Enable DevTools (attach to the SAME page)
        self.dev_tools = QWebEngineView(self)
        self.browser.page().setDevToolsPage(self.dev_tools.page())

        # Create dock widget
        self.dev_dock = QDockWidget("DevTools", self)
        self.dev_dock.setWidget(self.dev_tools)
        self.dev_dock.setVisible(False)

        self.dev_dock.setFeatures(
            QDockWidget.DockWidgetMovable |
            QDockWidget.DockWidgetFloatable |
            QDockWidget.DockWidgetClosable
        )

        self.addDockWidget(Qt.BottomDockWidgetArea, self.dev_dock)

        # WebChannel setup
        self.channel = QWebChannel(self.browser.page())
        self.handler = CallHandler()
        self.channel.registerObject("handler", self.handler)
        self.browser.page().setWebChannel(self.channel)

        # Settings
        self.browser.settings().setAttribute(
            QWebEngineSettings.LocalContentCanAccessRemoteUrls, True
        )

        # Load local HTML
        if os.path.isdir("_internal"):
            local_html = QUrl.fromLocalFile(QFileInfo(os.path.join("_internal", "index.html")).absoluteFilePath())
        else:
            local_html = QUrl.fromLocalFile(QFileInfo("index.html").absoluteFilePath())

        self.browser.setUrl(local_html)

        # UI
        self.setCentralWidget(self.browser)
        self.showMaximized()
        self.setWindowTitle("Plutus Budget Tracker")

        # F12 shortcut
        QShortcut(QKeySequence("F12"), self, activated=self.open_devtools)

    def open_devtools(self):
        self.dev_dock.setVisible(not self.dev_dock.isVisible())
        self.dev_dock.setFeatures(
            QDockWidget.DockWidgetMovable |
            QDockWidget.DockWidgetFloatable |
            QDockWidget.DockWidgetClosable
        )
if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())