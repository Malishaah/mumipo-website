(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId('account-dialog');
  const open = byId('account-open');
  const reward = byId('game-star-reward');
  const message = byId('account-message');
  const emailForm = byId('account-form');
  const codeForm = byId('account-code-form');
  const demoForm = byId('account-preview-form');
  const nameForm = byId('account-name-form');
  const nameInput = byId('account-name');
  const editName = byId('account-edit-name');
  const retryAccount = byId('account-retry');
  const isDemo = new URLSearchParams(location.search).get('account') === 'preview';
  const storageKey = 'chick-family-preview';
  let account = null;
  let pendingEmail = '';
  let guestStars = 0;
  let editingName = false;
  let currentRound = null;
  let pendingSave = Promise.resolve();

  async function api(path, data) {
    let response;
    try {
      response = await fetch('/api/account' + path, data === undefined ? undefined : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
    } catch { throw new Error('Could not connect to the sign-in service. Please try again in a moment.'); }
    let value;
    try { value = await response.json(); }
    catch { throw new Error('Could not reach the sign-in service. Please try again in a moment.'); }
    if (!response.ok) throw new Error(value.message || 'Please try again in a moment.');
    return value;
  }

  function readDemo() {
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { return {}; }
  }

  function saveDemo(profile) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(profile));
      return true;
    } catch { return false; }
  }

  function render() {
    byId('account-title').textContent = account?.name ? 'Hi, ' + account.name + '!' : 'Grown-up account';
    byId('account-signed-out').hidden = !!account;
    byId('account-signed-in').hidden = !account;
    nameForm.hidden = !account || !editingName;
    editName.setAttribute('aria-expanded', String(editingName));
    editName.textContent = account?.name ? 'Edit name' : 'Add name';
    byId('account-email-detail').hidden = !account?.email;
    byId('account-profile-email').textContent = account?.email || '';
    byId('account-stars-hint').textContent = isDemo ? 'Demo stars stay on this device.' : 'Fill the picnic basket to earn a star.';
    byId('account-trigger-label').textContent = account ? String(account.stars) : 'Account';
    open.setAttribute('aria-label', account ? 'Grown-up account, ' + account.stars + ' stars' : 'Grown-up account');
    byId('account-stars').textContent = account?.stars === 1 ? '1 star' : (account?.stars ?? 0) + ' stars';
    open.hidden = false;
  }

  function showNameEditor(show) {
    editingName = show;
    message.textContent = '';
    if (show) nameInput.value = account?.name || '';
    render();
    (show ? nameInput : editName).focus();
  }

  function bindForm(form, submit) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      message.textContent = '';
      try { await submit(); }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; form.removeAttribute('aria-busy'); }
    });
  }

  open.addEventListener('click', () => {
    document.dispatchEvent(new Event('chick:account-open'));
    dialog.showModal();
  });
  byId('account-close').addEventListener('click', () => dialog.close());
  byId('account-shop-link').addEventListener('click', () => {
    dialog.close();
    const shopTitle = byId('shop-title');
    shopTitle.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => shopTitle.focus({ preventScroll: true }));
  });
  dialog.addEventListener('close', () => {
    editingName = false;
    message.textContent = '';
    render();
    open.focus();
  });
  editName.addEventListener('click', () => showNameEditor(!editingName));
  byId('account-cancel-name').addEventListener('click', () => showNameEditor(false));
  bindForm(nameForm, async () => {
    const name = nameInput.value.trim();
    if (!name) throw new Error('Enter a first name.');
    if (isDemo) {
      if (!saveDemo({ ...account, name, signedIn: true })) throw new Error('Could not save your name.');
      account = { ...account, name };
    } else {
      const editingAccount = account;
      const updated = (await api('/name', { name })).account;
      if (account !== editingAccount) return;
      account.name = updated.name;
    }
    showNameEditor(false);
    message.textContent = 'Name saved.';
  });

  if (isDemo) {
    byId('account-preview').hidden = false;
    byId('account-intro').textContent = 'Try a grown-up account and collect demo stars on this device.';
    emailForm.hidden = true;
    demoForm.hidden = false;
    const saved = readDemo();
    if (saved.signedIn) account = { name: saved.name, stars: saved.stars };
    render();
    bindForm(demoForm, () => {
      const name = byId('account-preview-name').value.trim();
      if (!name) throw new Error('Enter a first name to continue.');
      const saved = readDemo();
      account = { name, stars: (saved.name === name ? saved.stars || 0 : 0) + guestStars };
      guestStars = 0;
      saveDemo({ ...account, signedIn: true });
      demoForm.reset();
      render();
      byId('account-sign-out').focus();
    });
  } else {
    async function loadAccount() {
      const restoreFocus = document.activeElement === retryAccount;
      emailForm.hidden = true;
      retryAccount.hidden = true;
      retryAccount.disabled = true;
      byId('account-intro').textContent = 'Loading your account…';
      try {
        const profile = await api('');
        account = profile.account;
        emailForm.hidden = !account && !profile.emailReady;
        byId('account-intro').textContent = profile.emailReady
          ? 'Sign up or sign in with your email. Anyone can play as a guest.'
          : 'Email sign-in is still being set up. You can play as a guest.';
      } catch {
        byId('account-intro').textContent = 'We couldn’t load your account. You can try again or keep playing as a guest.';
        retryAccount.hidden = false;
      } finally {
        retryAccount.disabled = false;
        render();
        if (restoreFocus) {
          if (account) editName.focus();
          else if (!emailForm.hidden) byId('account-email').focus();
          else if (!retryAccount.hidden) retryAccount.focus();
        }
      }
    }
    render();
    loadAccount();
    retryAccount.addEventListener('click', loadAccount);
    bindForm(emailForm, async () => {
      pendingEmail = byId('account-email').value.trim();
      await api('/send', { email: pendingEmail });
      emailForm.hidden = true;
      codeForm.hidden = false;
      message.textContent = 'Check your inbox for your code.';
      byId('account-code').focus();
    });
    bindForm(codeForm, async () => {
      account = (await api('/verify', { email: pendingEmail, code: byId('account-code').value })).account;
      pendingEmail = '';
      codeForm.reset();
      codeForm.hidden = true;
      emailForm.reset();
      emailForm.hidden = false;
      render();
      if (!account.name) showNameEditor(true);
      else editName.focus();
    });
    byId('account-change-email').addEventListener('click', () => {
      pendingEmail = '';
      codeForm.reset();
      codeForm.hidden = true;
      emailForm.hidden = false;
      message.textContent = '';
      byId('account-email').focus();
    });
  }

  byId('account-sign-out').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (isDemo) {
        if (!saveDemo({ ...account, signedIn: false })) throw new Error('Could not save your demo sign-out.');
      } else await api('/sign-out', {});
      account = null;
      editingName = false;
      currentRound = null;
      message.textContent = '';
      render();
      (isDemo ? byId('account-preview-name') : byId('account-email')).focus();
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });

  document.addEventListener('chick:picnic-reset', () => { currentRound = null; });
  document.addEventListener('chick:picnic-start', () => {
    if (isDemo || !account) return;
    currentRound = pendingSave.then(() => api('/picnic/start', {})).catch(() => null);
  });

  document.addEventListener('chick:picnic-win', () => {
    if (open.hidden) return;
    reward.hidden = false;
    if (isDemo) {
      if (account) {
        account.stars++;
        const saved = saveDemo({ ...account, signedIn: true });
        reward.textContent = saved ? '★ +1 demo star' : '★ +1 star for this visit';
        render();
      } else {
        guestStars++;
        reward.textContent = '★ +1 demo star';
      }
      return;
    }
    if (!account || !currentRound) {
      reward.textContent = '★ Picnic complete!';
      return;
    }
    const earningAccount = account;
    const roundRequest = currentRound;
    reward.textContent = 'Saving your star…';
    pendingSave = roundRequest.then(async started => {
      if (!started) throw new Error('Round unavailable');
      let saved;
      try { saved = await api('/picnic/finish', { round: started.round }); }
      catch { saved = await api('/picnic/finish', { round: started.round }); }
      if (account === earningAccount) {
        account.stars = saved.stars;
        render();
      }
      if (currentRound === roundRequest) reward.textContent = '★ +1 star saved';
    }).catch(() => {
      if (currentRound === roundRequest) reward.textContent = 'Picnic complete. Your star couldn’t be saved.';
    });
  });
})();
