/* global browser */
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.init();
  }
  
  async init() {
    // Load WebExtension polyfill for cross-browser compatibility
    if (typeof browser === 'undefined') {
      window.browser = chrome;
    }
    
    // Get current tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tabs[0];
    
    // Update UI
    this.updateCurrentSite();
    this.loadStats();
    this.setupEventListeners();
    this.checkProtectionStatus();
  }
  
  async updateCurrentSite() {
    const siteInfo = document.getElementById('currentSite');
    const siteStatus = document.getElementById('siteStatus');
    
    if (this.currentTab && this.currentTab.url) {
      try {
        const url = new URL(this.currentTab.url);
        const domain = url.hostname;
        
        siteInfo.textContent = domain;
        
        // Check if site is blocked
        const status = await this.checkSiteStatus(domain);
        siteStatus.textContent = status.text;
        siteStatus.className = `site-status ${status.class}`;
        
      } catch (error) {
        console.error('Error updating current site:', error);
        siteInfo.textContent = 'Invalid URL';
        siteStatus.textContent = 'Unknown';
        siteStatus.className = 'site-status warning';
      }
    } else {
      siteInfo.textContent = 'No active tab';
      siteStatus.textContent = 'Unknown';
      siteStatus.className = 'site-status warning';
    }
  }
  
  async checkSiteStatus(domain) {
    // Check against known blocked domains
    const blockedDomains = [
      'pornhub.com', 'xvideos.com', 'xhamster.com', 
      'redtube.com', 'youporn.com', 'sex.com'
    ];
    
    const suspiciousKeywords = [
      'xxx', 'porn', 'sex', 'adult', 'nude', 'naked',
      'nsfw', 'explicit', 'mature', 'erotic'
    ];
    
    // Check if domain is blocked
    const isBlocked = blockedDomains.some(blocked => 
      domain.includes(blocked) || domain.endsWith('.' + blocked)
    );
    
    if (isBlocked) {
      return { text: 'Blocked', class: 'blocked' };
    }
    
    // Check for suspicious keywords
    const hasSuspiciousKeywords = suspiciousKeywords.some(keyword => 
      domain.toLowerCase().includes(keyword)
    );
    
    if (hasSuspiciousKeywords) {
      return { text: 'Warning', class: 'warning' };
    }
    
    return { text: 'Safe', class: 'safe' };
  }
  
  async loadStats() {
    try {
      // Get today's date
      const today = new Date().toDateString();
      
      // Load blocked log
      const result = await browser.storage.local.get(['blockedLog', 'dailyStats']);
      const blockedLog = result.blockedLog || [];
      const dailyStats = result.dailyStats || {};
      
      // Filter today's blocks
      const todayBlocks = blockedLog.filter(entry => {
        const entryDate = new Date(entry.timestamp).toDateString();
        return entryDate === today;
      });
      
      // Get today's stats
      const todayStats = dailyStats[today] || {
        sites: 0,
        images: 0,
        forms: 0
      };
      
      // Update UI
      document.getElementById('blockedCount').textContent = todayBlocks.length;
      document.getElementById('imageCount').textContent = todayStats.images || 0;
      document.getElementById('formCount').textContent = todayStats.forms || 0;
      document.getElementById('totalCount').textContent = 
        todayBlocks.length + (todayStats.images || 0) + (todayStats.forms || 0);
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }
  
  setupEventListeners() {
    // Protection toggle
    const protectionToggle = document.getElementById('protectionToggle');
    protectionToggle.addEventListener('change', (e) => {
      this.toggleProtection(e.target.checked);
    });
    
    // Whitelist button
    const whitelistBtn = document.getElementById('whitelistBtn');
    whitelistBtn.addEventListener('click', () => {
      this.whitelistCurrentSite();
    });
    
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
    });
  }
  
  async checkProtectionStatus() {
    try {
      const result = await browser.storage.sync.get(['protectionEnabled']);
      const isEnabled = result.protectionEnabled !== false; // Default to true
      const protectionToggle = document.getElementById('protectionToggle');
      const statusDiv = document.getElementById('status');
      
      protectionToggle.checked = isEnabled;
      statusDiv.className = `status ${isEnabled ? 'active' : 'inactive'}`;
      statusDiv.querySelector('.status-text').textContent = 
        `Protection ${isEnabled ? 'Enabled' : 'Disabled'}`;
      
    } catch (error) {
      console.error('Error checking protection status:', error);
    }
  }
  
  async toggleProtection(enabled) {
    try {
      await browser.storage.sync.set({ protectionEnabled: enabled });
      
      // Update UI
      const statusDiv = document.getElementById('status');
      statusDiv.className = `status ${enabled ? 'active' : 'inactive'}`;
      statusDiv.querySelector('.status-text').textContent = 
        `Protection ${enabled ? 'Enabled' : 'Disabled'}`;
      
      // Notify background script
      await browser.runtime.sendMessage({
        action: 'toggleProtection',
        enabled: enabled
      });
      
      // Create notification
      await browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Content Blocker',
        message: `Protection ${enabled ? 'enabled' : 'disabled'}`
      });
      
    } catch (error) {
      console.error('Error toggling protection:', error);
    }
  }
  
  async whitelistCurrentSite() {
    if (!this.currentTab || !this.currentTab.url) return;
    
    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      // Confirm with user
      if (!confirm(`Are you sure you want to whitelist ${domain}?`)) {
        return;
      }
      
      // Update storage
      const result = await browser.storage.sync.get(['whitelistedDomains']);
      const whitelistedDomains = result.whitelistedDomains || [];
      
      if (!whitelistedDomains.includes(domain)) {
        whitelistedDomains.push(domain);
        await browser.storage.sync.set({ whitelistedDomains });
        
        // Notify background script
        await browser.runtime.sendMessage({
          action: 'whitelistDomain',
          domain: domain
        });
        
        // Update UI
        await this.updateCurrentSite();
        
        // Create notification
        await browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Site Whitelisted',
          message: `${domain} has been added to the whitelist`
        });
      }
      
    } catch (error) {
      console.error('Error whitelisting site:', error);
      await browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Error',
        message: 'Failed to whitelist site'
      });
    }
  }
}

// Initialize popup manager
const popupManager = new PopupManager();