(() => {
  const section = document.querySelector('#game');
  const field = section.querySelector('#game-field');
  const start = section.querySelector('#game-start');
  const jump = section.querySelector('#game-jump');
  const status = section.querySelector('#game-status');
  const hearts = section.querySelector('#game-hearts');
  const score = section.querySelector('#game-score');
  const character = section.querySelector('.game-character');
  const berry = section.querySelector('.game-berry');
  const drop = section.querySelector('.game-drop');

  const ground = 23;
  const goal = 5;
  const items = [];
  let running = false;
  let paused = false;
  let lives = 3;
  let points = 0;
  let height = 0;
  let velocity = 0;
  let untilItem = 0;
  let nextBerry = true;
  let previousTime = 0;
  let frame = 0;

  function showScore() {
    hearts.textContent = Array.from({ length: 3 }, (_, i) => i < lives ? '♥' : '♡').join(' ');
    hearts.setAttribute('aria-label', lives === 1 ? '1 heart' : lives + ' hearts');
    score.textContent = 'Score ' + points;
  }

  function showCharacter() {
    character.style.transform = 'translateY(' + -height + 'px)';
  }

  function finish(message) {
    running = false;
    paused = false;
    jump.hidden = true;
    start.textContent = 'Play again';
    start.focus();
    status.textContent = message;
  }

  function spawnItem() {
    const node = (nextBerry ? berry : drop).cloneNode();
    node.hidden = false;
    const bottom = nextBerry ? 81 : 24;
    node.style.left = '0';
    node.style.bottom = bottom + 'px';
    field.append(node);
    items.push({ node, x: field.clientWidth, bottom, berry: nextBerry });
    nextBerry = !nextBerry;
  }

  function overlaps(item) {
    const characterLeft = character.offsetLeft + 7;
    const characterRight = character.offsetLeft + character.offsetWidth - 7;
    const characterBottom = ground + height + 6;
    const characterTop = ground + height + character.offsetHeight - 6;
    return item.x + item.node.offsetWidth - 4 > characterLeft &&
      item.x + 4 < characterRight &&
      item.bottom + item.node.offsetHeight - 4 > characterBottom &&
      item.bottom + 4 < characterTop;
  }

  function update(time) {
    if (!running || paused) return;
    const seconds = previousTime ? Math.min((time - previousTime) / 1000, 0.035) : 0;
    previousTime = time;
    height = Math.max(0, height + velocity * seconds);
    velocity = height ? velocity - 980 * seconds : 0;
    showCharacter();

    untilItem -= seconds;
    if (untilItem <= 0) {
      spawnItem();
      untilItem = 1.65;
    }

    const speed = Math.max(155, field.clientWidth * 0.49);
    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      item.x -= speed * seconds;
      item.node.style.transform = 'translateX(' + item.x + 'px)';
      const hit = overlaps(item);
      if (hit || item.x < -item.node.offsetWidth) {
        item.node.remove();
        items.splice(index, 1);
      }
      if (!hit) continue;

      if (item.berry) {
        points++;
        status.textContent = 'Strawberry! ' + points + ' of ' + goal + '.';
      } else {
        lives--;
        status.textContent = lives === 1 ? 'Splash! One heart left.' : 'Splash! ' + lives + ' hearts left.';
      }
      showScore();
      if (points === goal) return finish('You picked five strawberries!');
      if (lives === 0) return finish('Out of hearts. Want to try again?');
    }
    frame = requestAnimationFrame(update);
  }

  function hop() {
    if (running && !paused && height === 0 && velocity === 0) {
      height = 0.01;
      velocity = 385;
    }
  }

  function begin() {
    for (const item of items) item.node.remove();
    items.length = 0;
    berry.hidden = drop.hidden = true;
    lives = 3;
    points = height = velocity = previousTime = 0;
    nextBerry = true;
    untilItem = 0.2;
    running = true;
    paused = false;
    showScore();
    showCharacter();
    status.textContent = 'Catch ' + goal + ' strawberries.';
    start.textContent = 'Pause';
    jump.hidden = false;
    jump.focus();
    frame = requestAnimationFrame(update);
  }

  function pause() {
    cancelAnimationFrame(frame);
    paused = true;
    start.textContent = 'Resume';
    status.textContent = 'Game paused.';
    jump.hidden = true;
    if (document.activeElement === jump) start.focus();
  }

  start.addEventListener('click', () => {
    if (!running) return begin();
    if (!paused) return pause();
    paused = false;
    previousTime = 0;
    start.textContent = 'Pause';
    status.textContent = 'Ready to hop!';
    jump.hidden = false;
    jump.focus();
    frame = requestAnimationFrame(update);
  });
  field.addEventListener('pointerdown', hop);
  jump.addEventListener('click', hop);
  section.addEventListener('keydown', event => {
    if (event.code === 'Space' && running && !paused && event.target !== start) {
      event.preventDefault();
      hop();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) pause();
  });
  start.hidden = status.hidden = false;
  status.textContent = 'Ready to hop?';
})();
