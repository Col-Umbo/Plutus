import { createDiv } from "../functions/create.js";

class LogEntry {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  render() {
    // Contain everything
    const outerContainer = createDiv("outer-container");

    this.homeContent.appendChild(outerContainer);
  }
}

const logEntryPage = new LogEntry();

export default logEntryPage;
