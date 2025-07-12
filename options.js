/* global browser */
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof browser === 'undefined') {
    window.browser = chrome;
  }

  // Load existing settings
  const result = await browser.storage.sync.get(['customBlockedDomains', 'customKeywords']);
  document.getElementById('customDomains').value = (result.customBlockedDomains || []).join('\n');
  document.getElementById('customKeywords').value = (result.customKeywords || []).join('\n');

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', async () => {
    const customDomains = document.getElementById('customDomains').value.split('\n').filter(d => d.trim());
    const customKeywords = document.getElementById('customKeywords').value.split('\n').filter(k => k.trim());
    await browser.storage.sync.set({
      customBlockedDomains: customDomains,
      customKeywords: customKeywords
    });
    alert('Settings saved! Reload the extension or restart Firefox for changes to take effect.');
  });
});