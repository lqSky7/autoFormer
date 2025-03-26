document.addEventListener('DOMContentLoaded', function() {
  const fillButton = document.getElementById('fillForm');
  const statsDiv = document.getElementById('stats');
  const messageDiv = document.getElementById('message');
  

  const radioCount = document.getElementById('radioCount');
  const checkboxCount = document.getElementById('checkboxCount');
  const dropdownCount = document.getElementById('dropdownCount');
  const totalCount = document.getElementById('totalCount');
  
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
        totalCount.textContent = stats.total;
        

        statsDiv.classList.remove('hidden');
        messageDiv.classList.add('hidden');
      }, 500); 
      
    } catch (error) {
      messageDiv.textContent = 'Error: ' + error.message;
    }
  });
});
