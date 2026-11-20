const lullabies = document.querySelectorAll('.tunes details');

for (const lullaby of lullabies) {
  const player = lullaby.querySelector('audio');

  lullaby.addEventListener('toggle', () => {
    if (!lullaby.open) player.pause();
  });

  player.addEventListener('play', () => {
    for (const other of lullabies) {
      if (other !== lullaby) other.querySelector('audio').pause();
    }
  });
}
