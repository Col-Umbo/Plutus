import { createDiv } from "../functions/create.js";

class Test {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    this.homeContent.appendChild(outerContainer);
  }
}

const testPage = new Test();

export default testPage;
