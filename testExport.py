import sys
import os
import classes
import datetime
import pandas as pd
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

con = sqlite.connect("plutus.db")
cursor = con.cursor()
path = "Test.csv"
db = pd.read_sql("SELECT * FROM Expenses UNION ALL SELECT * FROM Income", con)
db.to_csv(path, index=False)