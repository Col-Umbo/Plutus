import sys
from PySide6.QtCore import QUrl
from PySide6.QtCore import QObject, Slot, QJsonValue
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtCore import QFileInfo
import json
class CallHandler(QObject):

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