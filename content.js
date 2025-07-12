// Content script for analyzing page content
class ContentAnalyzer {
  constructor() {
    this.suspiciousKeywords = [
      'xxx', 'porn', 'sex', 'adult', 'nude', 'naked',
      'nsfw', 'explicit', 'mature', 'erotic', 'webcam',
      'escort', 'dating', 'hookup', 'singles'
    ];
    
    this.init();
  }
  
  init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.analyzePage();
      });
    } else {
      this.analyzePage();
    }
    
    // Monitor for dynamic content changes
    this.observeChanges();
  }
  
  analyzePage() {
    try {
      const content = this.extractContent();
      
      // Send content to background script for analysis
      chrome.runtime.sendMessage({
        action: 'checkContent',
        content: content
      });
      
      // Check for suspicious images
      this.checkImages();
      
      // Check for suspicious forms
      this.checkForms();
      
    } catch (error) {
      console.error('Content analysis error:', error);
    }
  }
  
  extractContent() {
    const content = {
      text: '',
      images: 0,
      suspiciousLinks: 0,
      title: document.title || '',
      meta: {}
    };
    
    // Extract text content
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a');
    let textContent = '';
    
    textElements.forEach(element => {
      const text = element.textContent || element.innerText || '';
      textContent += text + ' ';
    });
    
    content.text = textContent.toLowerCase();
    
    // Count images
    content.images = document.querySelectorAll('img').length;
    
    // Check for suspicious links
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.href.toLowerCase();
      const text = link.textContent.toLowerCase();
      
      if (this.containsSuspiciousKeywords(href) || 
          this.containsSuspiciousKeywords(text)) {
        content.suspiciousLinks++;
      }
    });
    
    // Extract meta information
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content_attr = meta.getAttribute('content');
      
      if (name && content_attr) {
        content.meta[name] = content_attr;
      }
    });
    
    return content;
  }
  
  containsSuspiciousKeywords(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return this.suspiciousKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
  }
  
  checkImages() {
    const images = document.querySelectorAll('img');
    let suspiciousImageCount = 0;
    
    images.forEach(img => {
      // Check image alt text and src
      const alt = (img.alt || '').toLowerCase();
      const src = (img.src || '').toLowerCase();
      const title = (img.title || '').toLowerCase();
      
      if (this.containsSuspiciousKeywords(alt) || 
          this.containsSuspiciousKeywords(src) || 
          this.containsSuspiciousKeywords(title)) {
        suspiciousImageCount++;
        
        // Blur suspicious images
        img.style.filter = 'blur(20px)';
        img.style.cursor = 'pointer';
        img.title = 'Potentially inappropriate content (click to reveal)';
        
        // Add click handler to reveal
        img.addEventListener('click', (e) => {
          if (confirm('This image may contain inappropriate content. Do you want to reveal it?')) {
            e.target.style.filter = 'none';
          }
        });
      }
    });
    
    if (suspiciousImageCount > 3) {
      chrome.runtime.sendMessage({
        action: 'reportBlock',
        url: window.location.href,
        reason: `Multiple suspicious images detected (${suspiciousImageCount})`
      });
    }
  }
  
  checkForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
      const formText = form.textContent.toLowerCase();
      const action = (form.action || '').toLowerCase();
      
      if (this.containsSuspiciousKeywords(formText) || 
          this.containsSuspiciousKeywords(action)) {
        
        // Hide suspicious forms
        form.style.display = 'none';
        
        // Add warning message
        const warning = document.createElement('div');
        warning.style.cssText = `
          background: #ffeb3b;
          border: 2px solid #f57c00;
          padding: 15px;
          margin: 10px 0;
          border-radius: 5px;
          font-family: Arial, sans-serif;
          color: #e65100;
        `;
        warning.innerHTML = `
          <strong>⚠️ Warning:</strong> A potentially inappropriate form has been hidden for your protection.
          <button onclick="this.parentElement.nextElementSibling.style.display='block'; this.parentElement.remove();" 
                  style="margin-left: 10px; padding: 5px 10px; background: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer;">
            Show Form
          </button>
        `;
        
        form.parentNode.insertBefore(warning, form);
      }
    });
  }
  
  observeChanges() {
    // Monitor for dynamically added content
    const observer = new MutationObserver((mutations) => {
      let shouldReanalyze = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if new content contains suspicious elements
              const text = node.textContent || '';
              if (this.containsSuspiciousKeywords(text)) {
                shouldReanalyze = true;
              }
            }
          });
        }
      });
      
      if (shouldReanalyze) {
        // Debounce reanalysis
        clearTimeout(this.reanalysisTimer);
        this.reanalysisTimer = setTimeout(() => {
          this.analyzePage();
        }, 1000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Method to add custom blocking for specific elements
  blockElement(element, reason) {
    element.style.display = 'none';
    
    const warning = document.createElement('div');
    warning.style.cssText = `
      background: #f44336;
      color: white;
      padding: 10px;
      border-radius: 5px;
      margin: 5px 0;
      font-family: Arial, sans-serif;
    `;
    warning.innerHTML = `🛡️ Content blocked: ${reason}`;
    
    element.parentNode.insertBefore(warning, element);
  }
}

// Initialize content analyzer
const contentAnalyzer = new ContentAnalyzer();