// === Parul Attendance Automation ===

// Listen for automation trigger from popup
window.addEventListener('PU_AUTOMATE', (e) => {
  const { user, pass } = e.detail;
  startFlow(user, pass);
});

// Auto-continue flow after page reloads (e.g. after radio button postback or login redirect)
// Run immediately since content script runs at document_idle (page is already loaded)
chrome.storage.local.get(['pu_autoflow', 'pu_user', 'pu_pass'], (data) => {
  if (!data.pu_autoflow) return;
  console.log('[PU] Autoflow detected, continuing...');
  startFlow(data.pu_user, data.pu_pass);
});

function startFlow(user, pass) {
  const url = window.location.href;

  // Check attendance page FIRST (most specific) to stop the flow
  if (url.includes('TTM_Attendance')) {
    console.log('[PU] On attendance page. Done!');
    chrome.storage.local.remove(['pu_autoflow']);
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

  // Find the Student radio button
  const studentRadio = document.querySelector('input#rblRole_1') ||
    document.querySelector('input[name="rblRole"][value="Student"]');

  if (studentRadio && !studentRadio.checked) {
    // Student radio not selected yet — click it.
    // This triggers ASP.NET's __doPostBack which fully reloads the page.
    // After reload, this script runs again and autoflow continues.
    console.log('[PU] Clicking Student radio (page will reload via postback)...');
    studentRadio.click();
    return; // Stop here — page is about to reload
  }

  console.log('[PU] Student radio is selected, filling credentials...');

  // Wait a bit for any ASP.NET scripts to finish initializing
  setTimeout(() => fillAndSubmit(user, pass), 800);
}

function fillAndSubmit(user, pass) {
  // Find fields using exact UMS element IDs
  const userField = document.getElementById('txtUsername');
  const passField = document.getElementById('txtPassword');
  const loginBtn = document.getElementById('btnLogin');

  if (!userField || !passField) {
    console.warn('[PU] Could not find login fields. txtUsername:', !!userField, 'txtPassword:', !!passField);
    return;
  }

  // Set values directly — NO event dispatching to avoid interfering with ASP.NET state
  userField.value = user;
  passField.value = pass;

  // Make sure password field type is correct (the page has a "Show Password" toggle)
  passField.type = 'password';

  console.log('[PU] Credentials filled. Submitting...');

  if (loginBtn) {
    // Small delay then click login
    setTimeout(() => {
      loginBtn.click();
    }, 300);
  } else {
    console.warn('[PU] Login button not found, trying form submit...');
    const form = document.getElementById('form1');
    if (form) form.submit();
  }
}

function goToAttendance() {
  console.log('[PU] On dashboard, navigating to Attendance...');
  // Clear autoflow BEFORE navigating to prevent reload loops
  chrome.storage.local.remove(['pu_autoflow']);
  window.location.href = 'https://ums.paruluniversity.ac.in/StudentPanel/TTM_Attendance/TTM_Attendance_StudentAttendance.aspx';
}
