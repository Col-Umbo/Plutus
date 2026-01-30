function createDiv(name) {
  let div = "";
  if (name !== "") {
    div = document.createElement("div");
    div.classList.add(name);
  } else {
    div = document.createElement("div");
  }

  return div;
}

function createBtn(name, extra) {
  const btn = document.createElement("btn");
  btn.classList.add(name);
  btn.classList.add(extra);
  return btn;
}

function createImg(name, source, id, height, width) {
  const img = document.createElement("img");
  img.classList.add(name);
  img.src = source;
  img.id = id;

  if (height != null && width != null) {
    img.style.height = `${height}px`;
    img.style.width = `${width}px`;
  }
  return img;
}

export { createDiv, createBtn, createImg };
