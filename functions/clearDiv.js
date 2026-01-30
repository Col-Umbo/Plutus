class clearContentDiv {
  constructor() {
    this.homeContent = document.querySelector("#content");
  }

  unrender() {
    const children = Array.from(this.homeContent.children);
    for (let child of children) {
      if (!child.classList.contains("transition-door")) {
        this.homeContent.removeChild(child);
      }
    }
  }
}

const clearDiv = new clearContentDiv();

export default clearDiv;
