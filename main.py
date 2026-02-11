import sys
import os
from PySide6.QtCore import QUrl
from PySide6.QtCore import QObject, Slot, QJsonValue
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QFileInfo
import sqlite3
from sqlcipher3 import dbapi2 as sqlite
import json
class CallHandler(QObject):
    # Open sqlite connection
    con = sqlite.connect("plutus.db")
    cursor = con.cursor()
    # Sample password setting
    cursor.execute("PRAGMA key = 'password'")
    # Sample conditional table creation. Important.
    cursor.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)')
    # Sample table insertion
    cursor.execute("INSERT INTO users (name) VALUES ('John Doe')")
    # All changed are staged for commit. Must commit once finished.
    con.commit()
    # Sample database pull
    test = cursor.execute("SELECT id, name FROM users")
    for row in test:
        print(row)
    cursor.execute("DROP TABLE users")
    con.commit()
    con.close()
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
        # In order to allow relative paths to work across different systems, follow the below example
        if os.path.isdir('_internal'):
            local_html = QUrl.fromLocalFile(QFileInfo("_internal/index.html").absoluteFilePath())
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