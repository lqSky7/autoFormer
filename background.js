chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
});

// Listen for messages from content scripts and forward to popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORM_FILL_PROGRESS') {
    // Forward the progress update to the popup
    chrome.runtime.sendMessage(message);
  }
  return true;
});