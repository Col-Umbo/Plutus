# Basic class definitions. These will be expanded upon and given methods later
class Transaction():
    id : int
    date : str
    name: str
    amount : float
    transactionType : str
    category : str
    recurring : bool
    frequency : int
    endDate : str
    def getDate():
        return self.date
    def getAmount():
        return self.amount
    def getCategory():
        return self.category

class Expense(Transaction):
    credit : bool
    def __init__(self, id:int,date:str,amount:float,category:str,recurring:bool,frequency:int,endDate:str,credit:bool):
        self.id = id
        self.date = date
        self.amount = amount
        self.category = category
        self.recurring = recurring
        self.frequency = frequency
        self.endDate = endDate
        self.credit = credit
        self.transactionType = "Expense"
    def getCredit():
        return self.credit
class Income(Transaction):
    def __init__(self,id:int,date:str,amount:float,category:str,recurring:bool,frequency:int,endDate:str):
        self.id = id
        self.date = date
        self.amount = amount
        self.category = category
        self.recurring = recurring
        self.frequency = frequency
        self.endDate = endDate
        self.transactionType = "Income"
class Budget():
    # Currently unused. Will replace ClassHandler's expenses and income later.
    expenses = [Expense]
    income = [Income]
    def __init__(self):
        self.expenses = []
        self.incom = []
    def __init__(self,expenses:[Expense],income:[Income]):
        self.expenses = expenses
        self.income = income

class Category():
    name : str
    amount : float
    color : str
    def getAmount():
        return self.amount

class ExpenseCategory(Category):
    def __init__(self, name:str, color:str, amount=0.00):
        self.name = name
        self.amount = amount
        self.color = color
        
class IncomeCategory(Category):
    def __init__(self, name:str, color:str, amount=0.00):
        self.name = name
        self.amount = amount
        self.color = color
class Goal():
    purpose : str
    balance : float
    remBalance : float
    term : int
    monthlyAmount : float
    def __init__(self, purpose:str, balance:float, term:int, remBalance=0.00, monthlyAmount=0.00):
        self.purpose = purpose
        self.balance = balance
        self.term = term
        self.remBalance = balance
        self.monthlyAmount = remBalance/term

    def setMonthlyAmount(amount:float):
        self.amount=amount