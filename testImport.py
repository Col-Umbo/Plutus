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
# Usecols should be a list, then iterated over in a lambda function.
columns = ['Date','date','Description','Category','categoryName','name','Amount','amount','recurring','frequency','endDate']
df = pd.read_csv(path, usecols = lambda x: x in columns)
# Read csv and normalize column names
if 'Date' in df.columns:
    # External banking csv. Rename columns and add missing.
    df = df.rename(columns={'Date':'date','Description':'name','Category':'categoryName','Amount':'amount'})
    df['date'] = pd.to_datetime(df['date']).dt.strftime("%Y-%m-%d")
    df['amount'] = df['amount'].replace(r'[^.0-9\-]', '', regex=True).astype(float)
    expenses = df[df['amount']<0]
    income = df[df['amount']>=0]
    expenses['amount'] = expenses['amount'].apply(lambda x: x*-1)
    expenses = expenses.assign(categoryName="Imported Expenses",recurring=False,frequency=0,endDate=lambda x: x['date'])        
    income = income.assign(categoryName="Imported Income",recurring=False,frequency=0,endDate=lambda x: x['date'])        
else:
    # Exported transactions. Column names and contents do not need to be modified
    df['date'] = pd.to_datetime(df['date']).dt.strftime("%Y-%m-%d")
    df['amount'] = df['amount'].replace(r'[^.0-9\-]', '', regex=True).astype(float)
    expenses = df[df['amount']<0]
    expenses['amount'] = expenses['amount'].apply(lambda x: x*-1)
    income = df[df['amount']>=0]
# Reordering expenses and income
expenses = expenses[['date','name','categoryName','amount','recurring','frequency','endDate']]
income = income[['date','name','categoryName','amount','recurring','frequency','endDate']]
try:
    expenses.to_sql("Expenses", con, schema=None, if_exists='append', index=False, index_label=None, chunksize=None, dtype=None, method=None)
    income.to_sql("Income", con, schema=None, if_exists='append', index=False, index_label=None, chunksize=None, dtype=None, method=None)
    print("Passed")
except sqlite.Error as e:
    print(e)