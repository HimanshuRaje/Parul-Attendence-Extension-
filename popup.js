const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const saveBtn = document.getElementById('saveBtn');
const goBtn = document.getElementById('goBtn');
const statusEl = document.getElementById('status');
const savedBadge = document.getElementById('savedBadge');
const clearBtn = document.getElementById('clearBtn');

function setStatus(msg, type = '') {
  statusEl.innerHTML = msg;
  statusEl.className = 'status ' + type;
}

// Load saved credentials on open
chrome.storage.local.get(['pu_user', 'pu_pass'], (data) => {
  if (data.pu_user) {
    usernameInput.value = data.pu_user;
    savedBadge.style.display = 'inline-block';
  }
  if (data.pu_pass) {
    passwordInput.value = data.pu_pass;
  }
});

// Save credentials
saveBtn.addEventListener('click', () => {
  const user = usernameInput.value.trim();
  const pass = passwordInput.value;

  if (!user || !pass) {
    setStatus('Please enter both fields.', 'error');
    return;
  }

  chrome.storage.local.set({ pu_user: user, pu_pass: pass }, () => {
    savedBadge.style.display = 'inline-block';
    setStatus('Credentials saved!', 'success');
    setTimeout(() => setStatus(''), 1500);
  });
});

// Clear credentials
clearBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['pu_user', 'pu_pass'], () => {
    usernameInput.value = '';
    passwordInput.value = '';
    savedBadge.style.display = 'none';
    setStatus('Credential history cleared.', 'success');
    setTimeout(() => setStatus(''), 1500);
  });
});

// Main button — open/find tab and run automation
goBtn.addEventListener('click', async () => {
  const user = usernameInput.value.trim();
  const pass = passwordInput.value;

  if (!user || !pass) {
    setStatus('Enter your credentials first.', 'error');
    return;
  }

  goBtn.disabled = true;
  setStatus('Opening UMS...', 'info');

  // Save latest credentials
  chrome.storage.local.set({ pu_user: user, pu_pass: pass });

  const originalBtnContent = goBtn.innerHTML;
  let fallbackTimeout;
  let tabListener;

  const triggerSuccess = () => {
    if (fallbackTimeout) clearTimeout(fallbackTimeout);
    goBtn.disabled = false;
    goBtn.innerHTML = originalBtnContent;
    setStatus('');

    // Show full-screen success overlay
    const successOverlay = document.getElementById('successOverlay');
    if (successOverlay) {
      successOverlay.classList.add('active');
    }

    // Fade out body and close window
    setTimeout(() => {
      document.body.classList.add('fade-out');
      setTimeout(() => {
        window.close();
      }, 400); // Wait for the fade-out transition (0.4s) to complete
    }, 2000); // Show overlay for 2s
  };

  // Get current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      setStatus('No active tab found.', 'error');
      goBtn.disabled = false;
      return;
    }

    const activeTab = tabs[0];

    // Listen for tab load completion
    tabListener = (tabId, info) => {
      if (tabId === activeTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(tabListener);
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: startAutomation,
          args: [user, pass]
        }, () => {
          triggerSuccess();
        });
      }
    };
    chrome.tabs.onUpdated.addListener(tabListener);

    // Fallback timeout in case page fails to load or script injection is blocked
    fallbackTimeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(tabListener);
      goBtn.disabled = false;
      goBtn.innerHTML = originalBtnContent;
      setStatus('Connection timed out. Please try again.', 'error');
    }, 10000);

    // Redirect active tab to UMS login page
    chrome.tabs.update(activeTab.id, { url: 'https://ums.paruluniversity.ac.in/Login.aspx' });
  });

  setStatus('Automating... DON\'T LEAVE THE TAB!!!', 'info');
});

// This function runs inside the UMS tab
function startAutomation(user, pass) {
  // Send message to content script
  window.dispatchEvent(new CustomEvent('PU_AUTOMATE', {
    detail: { user, pass }
  }));
}

// Password Visibility Toggle (UI Enhancement)
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const eyeIcon = document.getElementById('eyeIcon');
if (togglePasswordBtn && eyeIcon) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    passwordInput.classList.toggle('pw-visible', isPassword);

    if (isPassword) {
      // Switch to eye-off SVG icon
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
    } else {
      // Switch back to eye SVG icon
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    }
  });
}
