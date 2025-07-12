/* global browser */
class ContentBlocker {
  constructor() {
    this.blockedDomains = new Set([
      'pornhub.com',
      'xvideos.com',
      'sex.com',
      'xhamster.com',
      'redtube.com',
      'youporn.com',
      'xnxx.com',
      'spankbang.com',
      'pornhd.com',
      'tube8.com'
    ]);
    
    this.suspiciousKeywords = [
      'xxx', 'porn', 'sex', 'adult', 'nude', 'naked',
      'nsfw', 'explicit', 'mature', 'erotic', 'webcam',
      'escort', 'dating', 'hookup', 'singles'
    ];
    
    this.whitelistedDomains = new Set();
    this.isProtectionEnabled = true;
    this.blockPageUrl = null;
    
    this.init();
  }
  
  async init() {
    // Cross-browser compatibility
    if (typeof browser === 'undefined') {
      window.browser = chrome;
    }
    
    // Create block page URL
    this.blockPageUrl = browser.runtime.getURL('block.html');
    
    // Use webRequest API for better cross-browser support
    if (browser.webRequest) {
      browser.webRequest.onBeforeRequest.addListener(
        (details) => this.handleRequest(details),
        { urls: ["<all_urls>"] },
        ["blocking"]
      );
    }
    
    // Fallback: Monitor tab updates
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'loading' && tab.url && this.isProtectionEnabled) {
        this.checkUrlAndBlock(tab.url, tabId);
      }
    });
    
    // Monitor tab activation
    browser.tabs.onActivated.addListener(async (activeInfo) => {
      if (!this.isProtectionEnabled) return;
      try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        if (tab.url) {
          this.checkUrlAndBlock(tab.url, activeInfo.tabId);
        }
      } catch (error) {
        console.error('Error checking activated tab:', error);
      }
    });
    
    // Handle messages from content scripts and popup
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
    
    await this.loadSettings();
  }
  
  handleRequest(details) {
    if (!this.isProtectionEnabled) return {};
    
    try {
      const url = new URL(details.url);
      const domain = url.hostname.toLowerCase();
      
      // Skip whitelisted domains
      if (this.whitelistedDomains.has(domain)) {
        return {};
      }
      
      // Check if domain should be blocked
      if (this.isBlocked(domain) || this.containsSuspiciousKeywords(details.url)) {
        console.log('Blocking URL:', details.url);
        return { redirectUrl: this.blockPageUrl + '?blocked=' + encodeURIComponent(details.url) };
      }
      
    } catch (error) {
      console.error('Error in request handler:', error);
    }
    
    return {};
  }
  
  async checkUrlAndBlock(url, tabId) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Skip whitelisted domains
      if (this.whitelistedDomains.has(domain)) {
        return;
      }
      
      // Check if should be blocked
      if (this.isBlocked(domain) || this.containsSuspiciousKeywords(url)) {
        await this.blockPage(tabId, url, 'Blocked domain or suspicious content');
      }
      
    } catch (error) {
      console.error('Error checking URL:', error);
    }
  }
  
  isBlocked(domain) {
    // Direct domain match
    if (this.blockedDomains.has(domain)) {
      return true;
    }
    
    // Subdomain match
    for (const blocked of this.blockedDomains) {
      if (domain.endsWith('.' + blocked)) {
        return true;
      }
    }
    
    return false;
  }
  
  containsSuspiciousKeywords(text) {
    const lowerText = text.toLowerCase();
    return this.suspiciousKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
  }
  
  async blockPage(tabId, url, reason) {
    try {
      const blockUrl = this.blockPageUrl + '?blocked=' + encodeURIComponent(url) + '&reason=' + encodeURIComponent(reason);
      
      // Try to update the tab
      await browser.tabs.update(tabId, { url: blockUrl });
      
      // Log the blocked content
      await this.logBlockedContent(url, reason);
      
    } catch (error) {
      console.error('Error blocking page:', error);
      
      // Fallback: Try to inject blocking content
      try {
        await browser.tabs.executeScript(tabId, {
          code: `
            document.documentElement.innerHTML = \`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Content Blocked</title>
                <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8ff; }
                  .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                  h1 { color: #2c3e50; }
                  .motivational { color: #27ae60; font-weight: bold; font-size: 1.2em; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>🛡️ Content Blocked</h1>
                  <p>This page has been blocked for your protection.</p>
                  <p class="motivational">Stay Strong, You've Got This!</p>
                  <button onclick="history.back()">Go Back</button>
                </div>
              </body>
              </html>
            \`;
          `
        });
      } catch (scriptError) {
        console.error('Script injection also failed:', scriptError);
      }
    }
  }
  
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'checkContent':
          if (this.isProtectionEnabled) {
            await this.analyzeContent(request.content, sender.tab.id);
          }
          break;
          
        case 'reportBlock':
          await this.logBlockedContent(request.url, request.reason);
          break;
          
        case 'toggleProtection':
          this.isProtectionEnabled = request.enabled;
          await browser.storage.sync.set({ protectionEnabled: request.enabled });
          break;
          
        case 'whitelistDomain':
          this.whitelistedDomains.add(request.domain.toLowerCase());
          await browser.storage.sync.set({ 
            whitelistedDomains: Array.from(this.whitelistedDomains) 
          });
          break;
          
        case 'getBlockedUrl':
          sendResponse({ url: sender.tab.url });
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  async analyzeContent(content, tabId) {
    const textContent = content.text || '';
    const imageCount = content.images || 0;
    const linkCount = content.suspiciousLinks || 0;
    
    let score = 0;
    
    if (this.containsSuspiciousKeywords(textContent)) {
      score += 30;
    }
    
    if (imageCount > 20) {
      score += 20;
    }
    
    if (linkCount > 5) {
      score += 25;
    }
    
    if (score >= 50) {
      try {
        const tab = await browser.tabs.get(tabId);
        await this.blockPage(tabId, tab.url, 'Suspicious content detected');
      } catch (error) {
        console.error('Error blocking suspicious content:', error);
      }
    }
  }
  
  async logBlockedContent(url, reason) {
    try {
      const result = await browser.storage.local.get(['blockedLog']);
      const log = result.blockedLog || [];
      
      log.push({
        url: url,
        reason: reason,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 1000 entries
      if (log.length > 1000) {
        log.splice(0, log.length - 1000);
      }
      
      await browser.storage.local.set({ blockedLog: log });
      
    } catch (error) {
      console.error('Error logging blocked content:', error);
    }
  }
  
  async loadSettings() {
    try {
      const result = await browser.storage.sync.get([
        'customBlockedDomains', 
        'customKeywords', 
        'whitelistedDomains',
        'protectionEnabled'
      ]);
      
      if (result.customBlockedDomains) {
        result.customBlockedDomains.forEach(domain => {
          this.blockedDomains.add(domain.toLowerCase());
        });
      }
      
      if (result.customKeywords) {
        this.suspiciousKeywords.push(...result.customKeywords);
      }
      
      if (result.whitelistedDomains) {
        this.whitelistedDomains = new Set(result.whitelistedDomains.map(d => d.toLowerCase()));
      }
      
      if (result.protectionEnabled !== undefined) {
        this.isProtectionEnabled = result.protectionEnabled;
      }
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
}

// Initialize content blocker
const contentBlocker = new ContentBlocker();