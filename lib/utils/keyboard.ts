
export function inputConsume(e: KeyboardEvent) {
  e.stopPropagation();
}

export function inputClearOnEscape(e: KeyboardEvent) {
  if (e.key === "Escape") {
    (e.target as HTMLInputElement).value = "";
  }
}

export function inputBlurOnEscape(e: KeyboardEvent) {
  if (e.key === "Escape") {
    (e.target as HTMLElement).blur();
    //console.log("I got my head checked. By a jumbo jet.");
  }
}

export function inputConsumeWithBlurOnEscape(e: KeyboardEvent) {
  e.stopPropagation();
  inputBlurOnEscape(e);
}

export function inputConsumeWithClearAndBlurOnEscape(e: KeyboardEvent) {
  e.stopPropagation();
  if ((e.target as HTMLInputElement).value) {
    inputClearOnEscape(e);
  } else {
    inputBlurOnEscape(e);
  }
}

export function clickOnEnter(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.stopPropagation();
    (e.target as HTMLElement).click();
  }
}

export function consumeOnSpace(e: KeyboardEvent) {
  if (e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
  }
}

export function clickOnEnterAndConsumeOnSpace(e: KeyboardEvent) {
  clickOnEnter(e);
  consumeOnSpace(e);
}

export function clickOnSpace(e: KeyboardEvent) {
    if (e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).click();
    }
}
