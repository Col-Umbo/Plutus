import sys
from PySide6.QtCore import QUrl
from PySide6.QtWidgets import QApplication, QMainWindow
from PySide6.QtWebEngineWidgets import QWebEngineView

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        # Create a QWebEngineView widget
        self.browser = QWebEngineView()

        # Load a local HTML file or remote URL
        # For a local file, ensure the URL is properly formatted:
        # e.g., QUrl.fromLocalFile("/absolute/path/to/your/index.html")
        local_html = QUrl.fromLocalFile("/home/icefirefish/test.html")
        print(local_html)
        self.browser.setUrl(local_html)
        
        # Alternatively, to load a remote URL:
        # self.browser.setUrl(QUrl("https://www.google.com"))

        self.setCentralWidget(self.browser)
        self.setWindowTitle("PySide6 HTML UI Example")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())