import { createDiv } from "../functions/create.js";

class HomePage {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    const header = createDiv("header");
    header.textContent = "Home";

    outerContainer.append(header);

    this.homeContent.append(outerContainer);
  }
}

const homePage = new HomePage();

export default homePage;
