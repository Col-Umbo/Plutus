import { createDiv } from "../functions/create.js";

class Budget {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    const header = createDiv("budget");
    header.textContent = "Budget";

    outerContainer.append(header);

    this.homeContent.appendChild(outerContainer);
  }
}

const budgetPage = new Budget();

export default budgetPage;
