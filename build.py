#!/usr/bin/env python3 
from PyInstaller import __main__ as pyinstaller
import os
command = ['main.py', '--clean']
for root, dirs, files in os.walk("."):
    if files:
        for file in files:
            if (os.path.splitext(file)[1] == '.js' or os.path.splitext(file)[1]== '.html' or os.path.splitext(file)[1]=='.css'):
                command.append('--add-data='+os.path.join(root,file)+os.pathsep+root)
pyinstaller.run(command)
