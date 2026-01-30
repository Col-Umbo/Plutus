import { createDiv } from "../functions/create.js";

class Goal {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    this.homeContent.appendChild(outerContainer);
  }
}

const goalPage = new Goal();

export default goalPage;
