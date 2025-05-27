document.addEventListener('DOMContentLoaded', function() {
  const fillButton = document.getElementById('fillForm');
  const apiFillButton = document.getElementById('apiFill');
  const statsDiv = document.getElementById('stats');
  const messageDiv = document.getElementById('message');
  const progressDiv = document.getElementById('progress');
  
  const radioCount = document.getElementById('radioCount');
  const checkboxCount = document.getElementById('checkboxCount');
  const dropdownCount = document.getElementById('dropdownCount');
  const textCount = document.getElementById('textCount');
  const totalCount = document.getElementById('totalCount');
  
  // Progress tracking elements
  const currentSubmissionSpan = document.getElementById('currentSubmission');
  const totalSubmissionsSpan = document.getElementById('totalSubmissions');
  const progressBar = document.getElementById('progressBar');
  const successCount = document.getElementById('successCount');
  const failCount = document.getElementById('failCount');
  
  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show the corresponding tab content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Basic fill functionality
  fillButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('docs.google.com/forms')) {
      messageDiv.textContent = 'This is not a Google Form!';
      messageDiv.classList.remove('hidden');
      return;
    }
    
    messageDiv.textContent = 'Filling form...';
    messageDiv.classList.remove('hidden');
    statsDiv.classList.add('hidden');
    
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['fillFirst.js']
      });
      
      setTimeout(async () => {
        const [statsResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return window.formFillStats || { 
              radioSelected: 0, 
              checkboxSelected: 0, 
              dropdownSelected: 0, 
              total: 0 
            };
          }
        });
        
        const stats = statsResult.result;
        radioCount.textContent = stats.radioSelected;
        checkboxCount.textContent = stats.checkboxSelected;
        dropdownCount.textContent = stats.dropdownSelected;
        textCount.textContent = stats.textSelected || 0;
        totalCount.textContent = stats.total;
        
        statsDiv.classList.remove('hidden');
        messageDiv.classList.add('hidden');
      }, 500); 
      
    } catch (error) {
      messageDiv.textContent = 'Error: ' + error.message;
    }
  });
  
  // API fill functionality
  apiFillButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('docs.google.com/forms')) {
      messageDiv.textContent = 'This is not a Google Form!';
      messageDiv.classList.remove('hidden');
      return;
    }
    
    const onlyRequired = document.getElementById('onlyRequired').checked;
    const fillCount = parseInt(document.getElementById('fillCount').value) || 1;
    
    // Hide the message and stats, show progress
    messageDiv.classList.add('hidden');
    statsDiv.classList.add('hidden');
    
    // Setup progress tracking
    totalSubmissionsSpan.textContent = fillCount;
    currentSubmissionSpan.textContent = '0';
    progressBar.style.width = '0%';
    successCount.textContent = '0';
    failCount.textContent = '0';
    progressDiv.classList.remove('hidden');
    
    try {
      // First inject the API fill script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['apifill/apiFill.js']
      });
      
      // Create a custom function that will update progress
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (url, onlyReq, count) => {
          // This function will run in the context of the web page
          // We'll track progress and report back
          try {
            const GoogleFormAutofill = window.GoogleFormAutofill;
            
            if (!GoogleFormAutofill) {
              throw new Error("GoogleFormAutofill API not available");
            }
            
            console.log(`Processing form: ${url} (${count} submissions)`);
            
            let successful = 0;
            let failed = 0;
            
            // We'll create our own implementation to track progress
            for (let i = 0; i < count; i++) {
              // Report progress back to extension
              window.postMessage({
                type: 'FORM_FILL_PROGRESS',
                current: i + 1,
                total: count,
                successful,
                failed
              }, '*');
              
              console.log(`Submission ${i+1}/${count}`);
              const payload = await GoogleFormAutofill.generateRequestBody(url, onlyReq);
              console.log("Form data ready");
              
              const result = await GoogleFormAutofill.submit(url, payload);
              if (result) {
                successful++;
                console.log(`Submission ${i+1}: Success!`);
              } else {
                failed++;
                console.log(`Submission ${i+1}: Failed!`);
              }
              
              // Add a small delay between submissions if multiple
              if (count > 1 && i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            console.log(`Completed ${count} submissions. Success: ${successful}, Failed: ${failed}`);
            return {
              total: count,
              successful,
              failed
            };
          } catch (err) {
            console.error("Form fill error:", err);
            return { error: err.message };
          }
        },
        args: [tab.url, onlyRequired, fillCount]
      });
      
      // Results are now available in result.result
      if (result.result) {
        if (result.result.error) {
          messageDiv.textContent = `Error: ${result.result.error}`;
          messageDiv.classList.remove('hidden');
          progressDiv.classList.add('hidden');
        } else {
          const stats = result.result;
          messageDiv.textContent = `Completed ${stats.total} submission(s). Success: ${stats.successful}, Failed: ${stats.failed}`;
          messageDiv.classList.remove('hidden');
          setTimeout(() => {
            progressDiv.classList.add('hidden');
          }, 1500);
        }
      }
    } catch (error) {
      messageDiv.textContent = 'Error: ' + error.message;
      messageDiv.classList.remove('hidden');
      progressDiv.classList.add('hidden');
      console.error(error);
    }
  });
  
  // Listen for progress updates from the page script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FORM_FILL_PROGRESS') {
      const { current, total, successful, failed } = message;
      
      // Update progress UI
      currentSubmissionSpan.textContent = current;
      progressBar.style.width = `${(current / total) * 100}%`;
      successCount.textContent = successful;
      failCount.textContent = failed;
    }
    return true;
  });

  // Star button functionality
  const starButton = document.getElementById('starButton');
  starButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/lqSky7/autoformer' });
  });
});
