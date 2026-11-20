const storybook = document.querySelector('.storybook');
const cover = storybook.querySelector('.story-cover');
const pages = [...storybook.querySelectorAll('.story-spread:not(.story-cover)')];
const storyOpen = cover.querySelector('.story-open');
const storyControls = storybook.querySelector('.story-controls');
const storyBack = storybook.querySelector('.story-back');
const storyNext = storybook.querySelector('.story-next');
const storyNextLabel = storyNext.querySelector('.story-next-label');
const storyNextArrow = storyNext.querySelector('.story-next-arrow');
const storyCounter = storybook.querySelector('.story-counter');
let currentPage = -1;

function showStoryPage(index, moveFocus = false) {
  currentPage = index;
  const onCover = index === -1;
  cover.hidden = !onCover;
  storyControls.hidden = onCover;
  pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== index; });
  storyBack.setAttribute('aria-label', index === 0 ? 'Back to cover' : 'Back to previous page');
  const lastPage = index === pages.length - 1;
  storyNextLabel.textContent = lastPage ? 'Read again' : 'Next';
  storyNextArrow.textContent = lastPage ? '↻' : '→';
  storyCounter.textContent = onCover ? '' : 'Page ' + (index + 1) + ' of ' + pages.length;
  if (moveFocus) {
    const spread = onCover ? cover : pages[index];
    spread.querySelector('h3').focus({ preventScroll: true });
    spread.scrollIntoView({ block: 'start' });
  }
}

storyOpen.addEventListener('click', () => showStoryPage(0, true));
storyBack.addEventListener('click', () => {
  if (currentPage >= 0) showStoryPage(currentPage - 1, true);
});
storyNext.addEventListener('click', () => showStoryPage((currentPage + 1) % pages.length, true));
showStoryPage(-1);
