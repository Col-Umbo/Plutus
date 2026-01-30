import { createDiv } from "../functions/create.js";

class WhatIf {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    this.homeContent.appendChild(outerContainer);
  }
}

const whatIfPage = new WhatIf();

export default whatIfPage;
