(() => {
  const section = document.querySelector('#game');
  const field = section.querySelector('#game-field');
  const intro = section.querySelector('.game-intro');
  const stage = section.querySelector('.game-stage');
  const controls = section.querySelector('.game-controls');
  const start = section.querySelector('#game-start');
  const back = section.querySelector('#game-back');
  const pauseButton = section.querySelector('#game-pause');
  const pausedNote = section.querySelector('.game-paused-note');
  const jump = section.querySelector('#game-jump');
  const soundButton = section.querySelector('#game-sound');
  const audio = window.createChickGameAudio?.();
  const status = section.querySelector('#game-status');
  const hearts = section.querySelector('#game-hearts');
  const score = section.querySelector('#game-score');
  const basket = section.querySelector('.game-basket');
  const character = section.querySelector('.game-character');
  const characterArt = character.querySelector('.game-character-art');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const fruit = section.querySelector('.game-fruit');
  const mushroom = section.querySelector('.game-mushroom');
  const rock = section.querySelector('.game-rock');
  const result = section.querySelector('#game-result');
  const resultHeading = section.querySelector('#game-result-heading');
  const resultSymbol = section.querySelector('#game-result-symbol');
  const resultCopy = section.querySelector('#game-result-copy');
  const starReward = section.querySelector('#game-star-reward');
  const replay = section.querySelector('#game-replay');
  const replayLabel = section.querySelector('#game-replay-label');

  const fruits = [['Strawberry', '🍓'], ['Banana', '🍌'], ['Kiwi', '🥝'], ['Orange', '🍊'], ['Apple', '🍎']];
  const goal = 15;
  const items = [];
  let fruitBag = [];
  let rockBag = [];
  let running = false;
  let paused = false;
  let lives = 3;
  let points = 0;
  let height = 0;
  let velocity = 0;
  let jumpsUsed = 0;
  let untilItem = 0;
  let nextFruit = true;
  let nextObstacle = mushroom;
  let previousTime = 0;
  let frame = 0;
  let runnerX = 0;
  let cameraX = 0;
  let soundEnabled = true;
  try { soundEnabled = localStorage.getItem('chick-game-sound') !== 'off'; } catch {}
  audio?.setEnabled(soundEnabled);
  soundButton.hidden = !audio;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));

  function showScore() {
    hearts.textContent = Array.from({ length: 3 }, (_, i) => i < lives ? '♥' : '♡').join(' ');
    hearts.setAttribute('aria-label', lives === 1 ? '1 heart' : lives + ' hearts');
    score.textContent = points + ' / ' + goal;
    basket.style.setProperty('--basket-fill', (points / goal * 100) + '%');
  }

  function showCharacter() {
    character.style.transform = 'translateY(' + -height + 'px)';
    character.style.setProperty('--jump-height', height + 'px');
    character.style.setProperty('--shadow-strength', Math.max(.18, .62 - height / 240));
    character.classList.toggle('is-airborne', height > 0);
  }

  function showStillFeathers() {
    characterArt.style.removeProperty('--feather-lean');
  }

  function moveFeathers(seconds) {
    if (reducedMotion.matches) return;
    const lean = height > 0 ? Math.max(-8, Math.min(8, velocity / 50)) : 0;
    characterArt.style.setProperty('--feather-lean', lean + 'deg');
  }

  reducedMotion.addEventListener('change', showStillFeathers);

  function finish(won) {
    audio?.stopMusic();
    audio?.play(won ? 'win' : 'loss');
    running = false;
    paused = false;
    height = velocity = jumpsUsed = 0;
    showCharacter();
    showStillFeathers();
    field.classList.add('is-paused');
    controls.hidden = true;
    status.textContent = '';
    result.classList.toggle('is-loss', !won);
    resultHeading.textContent = won ? 'Basket full!' : 'Game over';
    resultSymbol.textContent = won ? '🧺' : '';
    resultCopy.textContent = won ? 'You picked ' + goal + ' fruits for your picnic.' : 'Out of hearts. Try again!';
    replayLabel.textContent = won ? 'Play again' : 'Start over';
    result.hidden = false;
    if (won) document.dispatchEvent(new Event('chick:picnic-win'));
    replay.focus({ preventScroll: true });
  }

  function spawnItem(fieldWidth, speed) {
    const node = (nextFruit ? fruit : nextObstacle).cloneNode(true);
    let fruitName = '';
    if (nextFruit) {
      if (!fruitBag.length) fruitBag = fruits.slice();
      const [[name, emoji]] = fruitBag.splice(Math.floor(Math.random() * fruitBag.length), 1);
      fruitName = name;
      node.textContent = emoji;
    } else {
      if (nextObstacle === rock) {
        if (!rockBag.length) rockBag = [false, false, true];
        const [doubleRock] = rockBag.splice(Math.floor(Math.random() * rockBag.length), 1);
        node.classList.toggle('is-double', doubleRock);
      }
      nextObstacle = nextObstacle === mushroom ? rock : mushroom;
    }
    node.hidden = false;
    node.style.left = '0';
    field.append(node);
    const drift = node.classList.contains('game-mushroom') ? speed * .20 : 0;
    const lead = fieldWidth * .86;
    items.push({
      node, worldX: runnerX + lead * (1 + drift / speed), drift, fruitName,
      width: node.offsetWidth, height: node.offsetHeight,
      bottom: field.clientHeight - node.offsetTop - node.offsetHeight,
    });
    nextFruit = !nextFruit;
  }

  function overlaps(item, player) {
    // Use the center of each obstacle so brushing its edge is forgiving.
    const sideInset = item.fruitName ? 4 : Math.min(17, item.width * 0.34);
    const topInset = item.fruitName ? 4 : item.height * 0.28;
    return item.x + item.width - sideInset > player.left &&
      item.x + sideInset < player.right &&
      item.bottom + item.height - topInset > player.bottom &&
      item.bottom + 4 < player.top;
  }

  function landsOnObstacle(item, player, previousBottom, step) {
    const surface = item.bottom + item.height * .72;
    if (previousBottom <= player.bottom || previousBottom < surface || player.bottom > surface) return false;
    const crossingX = item.x + step * (surface - player.bottom) / (previousBottom - player.bottom);
    const inset = Math.min(17, item.width * .34);
    return crossingX + item.width - inset > player.left && crossingX + inset < player.right;
  }

  function scatterObstacle(item, isRock = false) {
    const burst = document.createElement('span');
    burst.className = 'game-burst';
    burst.classList.toggle('is-rock', isRock);
    burst.style.setProperty('--impact-x', item.worldX + item.width / 2 + 'px');
    burst.style.bottom = item.bottom + item.height * .32 + 'px';
    for (let i = 0; i < 5; i++) burst.append(document.createElement('span'));
    burst.addEventListener('animationend', () => burst.remove(), { once: true });
    field.append(burst);
  }

  function showGardenEffect(kind, worldX, bottom) {
    if (reducedMotion.matches) return;
    const effect = document.createElement('span');
    effect.className = 'game-effect game-effect--' + kind;
    effect.setAttribute('aria-hidden', 'true');
    effect.style.setProperty('--effect-x', worldX + 'px');
    effect.style.bottom = bottom + 'px';
    effect.addEventListener('animationend', () => effect.remove(), { once: true });
    field.append(effect);
  }

  function update(time) {
    if (!running || paused) return;
    const seconds = previousTime ? Math.min((time - previousTime) / 1000, 0.035) : 0;
    previousTime = time;
    const previousHeight = height;
    height = Math.max(0, height + velocity * seconds);
    velocity = height ? velocity - 640 * seconds : 0;
    if (!height) {
      jumpsUsed = 0;
      if (previousHeight > 0) showGardenEffect('landing', runnerX + character.offsetWidth * .48, 23);
    }

    const fieldWidth = field.clientWidth;
    const speed = Math.max(93, Math.min(fieldWidth, 525) * .29);
    const step = speed * seconds;
    runnerX += step;
    // Let Chick cross the first part of the frame before the camera follows.
    // Catch up gradually, without ever making him move backwards on screen.
    const leadInFrame = Math.min(.45, .29 + runnerX / (fieldWidth * 100));
    const followDistance = runnerX - cameraX - fieldWidth * leadInFrame;
    cameraX += Math.min(step, Math.max(0, followDistance * 4) * seconds);
    cameraX = Math.max(cameraX, runnerX - fieldWidth * .52);
    const characterLeft = runnerX - cameraX;
    character.style.left = characterLeft + 'px';
    field.style.setProperty('--camera-x', cameraX + 'px');
    const characterBottom = field.clientHeight - character.offsetTop - character.offsetHeight + height;
    const player = {
      left: characterLeft + character.offsetWidth * 0.22,
      right: characterLeft + character.offsetWidth * 0.83,
      top: characterBottom + character.offsetHeight - 9,
      bottom: characterBottom + 5,
    };

    untilItem -= seconds;
    if (untilItem <= 0) {
      spawnItem(fieldWidth, speed);
      untilItem = 1.9;
    }
    showCharacter();
    moveFeathers(seconds);

    for (let index = items.length - 1; index >= 0; index--) {
      const item = items[index];
      item.worldX -= item.drift * seconds;
      item.x = item.worldX - cameraX;
      item.node.style.transform = 'translateX(' + item.x + 'px)';
      const isMushroom = item.node.classList.contains('game-mushroom');
      const stomped = !item.fruitName && landsOnObstacle(item, player, player.bottom + previousHeight - height, step + item.drift * seconds);
      const hit = stomped || overlaps(item, player);
      if (hit || item.x < -item.width) {
        item.node.remove();
        items.splice(index, 1);
      }
      if (!hit) continue;

      if (isMushroom || stomped) scatterObstacle(item, !isMushroom);
      if (stomped) {
        if (isMushroom) {
          height = Math.max(height, item.bottom + item.height * .72 - (player.bottom - height));
          velocity = 260;
          jumpsUsed = 0;
          showCharacter();
        }
        audio?.play(isMushroom ? 'bounce' : 'crumble');
        status.textContent = isMushroom ? 'Boing! You bounced off a mushroom.' : 'Crack! The rock crumbled.';
        continue;
      }
      if (item.fruitName) {
        audio?.play('munch');
        showGardenEffect('fruit', item.worldX + item.width / 2, item.bottom + item.height / 2);
        points++;
        status.textContent = item.fruitName + '! ' + points + ' of ' + goal + '.';
        if (points === Math.ceil(goal / 2) && lives < 3) {
          lives++;
          status.textContent = 'Halfway there! You found a heart.';
        }
      } else {
        lives--;
        audio?.play('bump');
        const reaction = isMushroom ? 'Oops!' : 'Bump!';
        status.textContent = reaction + (lives === 1 ? ' One heart left.' : ' ' + lives + ' hearts left.');
      }
      showScore();
      if (points === goal) return finish(true);
      if (lives === 0) return finish(false);
    }
    frame = requestAnimationFrame(update);
  }

  function hop() {
    if (!running || paused || jumpsUsed >= 2) return;
    height = Math.max(height, 0.01);
    velocity = jumpsUsed === 0 ? 313 : Math.max(250, velocity + 65);
    jumpsUsed++;
    audio?.play('jump');
  }

  function resetBoard() {
    for (const item of items) item.node.remove();
    for (const effect of field.querySelectorAll('.game-burst, .game-effect')) effect.remove();
    items.length = 0;
    result.hidden = true;
    starReward.hidden = true;
    document.dispatchEvent(new Event('chick:picnic-reset'));
    fruitBag = [];
    rockBag = [];
    lives = 3;
    points = height = velocity = jumpsUsed = previousTime = 0;
    runnerX = cameraX = 0;
    showStillFeathers();
    character.style.removeProperty('left');
    field.style.removeProperty('--camera-x');
    nextFruit = true;
    nextObstacle = mushroom;
    untilItem = 0.2;
    showScore();
    showCharacter();
    showPaused(false);
  }

  function begin() {
    audio?.setEnabled(soundEnabled);
    audio?.unlock();
    audio?.reset();
    audio?.playMusic();
    const firstStart = !intro.hidden;
    intro.hidden = true;
    back.hidden = false;
    section.classList.add('is-playing');
    resetBoard();
    runnerX = field.clientWidth * .10;
    fruit.hidden = mushroom.hidden = true;
    running = true;
    document.dispatchEvent(new Event('chick:picnic-start'));
    paused = false;
    field.classList.add('is-running');
    field.classList.remove('is-paused');
    status.textContent = 'Find ' + goal + ' fruits to fill your basket.';
    controls.hidden = false;
    if (firstStart) stage.scrollIntoView({ block: 'center' });
    jump.focus({ preventScroll: true });
    frame = requestAnimationFrame(update);
  }

  function leave() {
    audio?.setEnabled(false);
    cancelAnimationFrame(frame);
    running = paused = false;
    field.classList.remove('is-running', 'is-paused');
    resetBoard();
    fruit.hidden = mushroom.hidden = false;
    controls.hidden = back.hidden = true;
    intro.hidden = false;
    section.classList.remove('is-playing');
    status.textContent = 'Ready to hop? You have three hearts.';
    start.focus({ preventScroll: true });
    section.scrollIntoView({ block: 'nearest' });
  }

  function showPaused(isPaused) {
    pauseButton.classList.toggle('is-resume', isPaused);
    pauseButton.setAttribute('aria-label', isPaused ? 'Resume game' : 'Pause game');
    pausedNote.hidden = !isPaused;
    jump.disabled = isPaused;
  }

  function pause() {
    audio?.stopMusic();
    audio?.stopChewing();
    cancelAnimationFrame(frame);
    paused = true;
    field.classList.add('is-paused');
    status.textContent = 'Game paused.';
    if (document.activeElement === jump) pauseButton.focus({ preventScroll: true });
    showPaused(true);
  }

  start.addEventListener('click', begin);
  back.addEventListener('click', leave);
  pauseButton.addEventListener('click', () => {
    if (!running) return;
    if (!paused) return pause();
    paused = false;
    audio?.unlock();
    audio?.playMusic();
    field.classList.remove('is-paused');
    previousTime = 0;
    status.textContent = 'Ready to hop!';
    showPaused(false);
    jump.focus({ preventScroll: true });
    frame = requestAnimationFrame(update);
  });
  replay.addEventListener('click', begin);
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    try { localStorage.setItem('chick-game-sound', soundEnabled ? 'on' : 'off'); } catch {}
    audio?.setEnabled(soundEnabled);
    if (soundEnabled && running && !paused) {
      audio?.unlock();
      audio?.playMusic();
    }
  });
  field.addEventListener('pointerdown', hop);
  jump.addEventListener('click', hop);
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !back.hidden) {
      event.preventDefault();
      leave();
      return;
    }
    if (event.code === 'Space' && running && !paused && (!event.target.closest('button') || event.target === jump)) {
      event.preventDefault();
      if (!event.repeat) hop();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) pause();
  });
  document.addEventListener('chick:account-open', () => {
    if (running && !paused) pause();
  });
  new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio < 0.35 && running && !paused) pause();
  }, { threshold: 0.35 }).observe(field);
  start.hidden = status.hidden = false;
  showScore();
  status.textContent = 'Ready to hop? You have three hearts.';
})();
