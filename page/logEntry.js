import { createBtn, createDiv } from "../functions/create.js";

class LogEntry {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    const headerDiv = createDiv("header_div");

    // Page Name
    const headerName = createDiv("header_div");
    headerName.textContent = "LogEntry";

    // Income && Expense Buttons
    const incomeBtn = createBtn("income_button");
    const expenseBtn = createBtn("expense_button");
    incomeBtn.textContent = "Add Income";
    expenseBtn.textContent = "Add Expense";

    headerDiv.append(headerName, incomeBtn, expenseBtn);

    outerContainer.appendChild(headerDiv);

    this.homeContent.appendChild(outerContainer);
  }
}

const logEntryPage = new LogEntry();

export default logEntryPage;
