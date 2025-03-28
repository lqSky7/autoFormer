// This script listens for progress events from the page and relays them to the extension

// Listen for postMessage events from the page script
window.addEventListener('message', function(event) {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  // Check if this is our progress message
  if (event.data.type === 'FORM_FILL_PROGRESS') {
    // Forward to extension background script
    chrome.runtime.sendMessage(event.data);
  }
});

// Let the popup know the content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
