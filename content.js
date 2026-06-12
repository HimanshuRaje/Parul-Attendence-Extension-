// === Parul Attendance Automation ===

// Listen for automation trigger from popup
window.addEventListener('PU_AUTOMATE', (e) => {
  const { user, pass } = e.detail;
  chrome.storage.local.remove(['pu_login_submitted'], () => {
    startFlow(user, pass);
  });
});

// Auto-continue flow after page reloads (e.g. after radio button postback or login redirect)
// Run immediately since content script runs at document_idle (page is already loaded)
chrome.storage.local.get(['pu_autoflow', 'pu_user', 'pu_pass', 'pu_login_submitted'], (data) => {
  if (!data.pu_autoflow) return;

  const url = window.location.href;
  if (url.includes('Login.aspx') && data.pu_login_submitted) {
    console.warn('[PU] Login already attempted. Stopping autoflow to prevent infinite loop.');
    chrome.storage.local.remove(['pu_autoflow', 'pu_login_submitted']);
    return;
  }

  console.log('[PU] Autoflow detected, continuing...');
  startFlow(data.pu_user, data.pu_pass);
});

function startFlow(user, pass) {
  const url = window.location.href;

  // Check attendance page FIRST (most specific) to stop the flow
  if (url.includes('TTM_Attendance')) {
    console.log('[PU] On attendance page. Done!');
    chrome.storage.local.remove(['pu_autoflow', 'pu_login_submitted']);
  } else if (url.includes('Login.aspx')) {
    handleLogin(user, pass);
  } else if (url.includes('StudentPanel') || url.includes('Dashboard') || url.includes('Home') || url.includes('default') || url.includes('Default')) {
    goToAttendance();
  } else {
    window.location.href = 'https://ums.paruluniversity.ac.in/Login.aspx';
  }
}

function handleLogin(user, pass) {
  console.log('[PU] On login page...');

  // Save autoflow state so we continue after any page reload
  chrome.storage.local.set({ pu_autoflow: true, pu_user: user, pu_pass: pass });

  const studentRadioSelector = 'input#rblRole_1, input[name="rblRole"][value="Student"]';

  waitForElement(studentRadioSelector).then((studentRadio) => {
    if (!studentRadio.checked) {
      // Student radio not selected yet — click it.
      // This triggers ASP.NET's __doPostBack which fully reloads the page.
      // After reload, this script runs again and autoflow continues.
      console.log('[PU] Clicking Student radio (page will reload via postback)...');
      studentRadio.click();
      return; // Stop here — page is about to reload
    }

    console.log('[PU] Student radio is selected, filling credentials...');
    fillAndSubmit(user, pass);
  });
}

function fillAndSubmit(user, pass) {
  // Find fields using exact UMS element IDs
  waitForElements(['#txtUsername', '#txtPassword']).then(([userField, passField]) => {
    // Set values directly — NO event dispatching to avoid interfering with ASP.NET state
    userField.value = user;
    passField.value = pass;

    // Make sure password field type is correct (the page has a "Show Password" toggle)
    passField.type = 'password';

    console.log('[PU] Credentials filled. Submitting...');

    waitForElement('#btnLogin').then((loginBtn) => {
      chrome.storage.local.set({ pu_login_submitted: true }, () => {
        loginBtn.click();
      });
    });
  });
}

function goToAttendance() {
  console.log('[PU] On dashboard, navigating to Attendance...');
  // Clear autoflow BEFORE navigating to prevent reload loops
  chrome.storage.local.remove(['pu_autoflow', 'pu_login_submitted']);
  window.location.href = 'https://ums.paruluniversity.ac.in/StudentPanel/TTM_Attendance/TTM_Attendance_StudentAttendance.aspx';
}

// === Helper Functions for Element-Based Waiting ===

function waitForElement(selector) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      }
    }, 100);
  });
}

function waitForElements(selectors) {
  return new Promise((resolve) => {
    const check = () => {
      const elements = selectors.map(s => document.querySelector(s));
      if (elements.every(el => el !== null)) {
        resolve(elements);
        return true;
      }
      return false;
    };
    if (check()) return;
    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
      }
    }, 100);
  });
}

