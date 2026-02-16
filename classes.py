# Basic class definitions. These will be expanded upon and given methods later
class Transaction():
    date =""
    amount = 0.00
    type = ""
    category = ""

class Expense(Transaction):
    credit = False

class Budget():
    expenses = [Transaction()]
    income = [Transaction()]

class Category():
    name = ""
    amount = 0.00

class Goal():
    purpose = ""
    balance = 0.00