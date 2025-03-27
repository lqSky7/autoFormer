(function() {

    let stats = {
      radioSelected: 0,
      checkboxSelected: 0,
      dropdownSelected: 0,
      total: 0
    };
    
    const radioGroups = document.querySelectorAll('div[role="radiogroup"]');
    radioGroups.forEach(group => {
      const firstOption = group.querySelector('div[role="radio"]');
      if (firstOption && firstOption.getAttribute('aria-checked') !== 'true') {
        firstOption.click();
        stats.radioSelected++;
        stats.total++;
      }
    });
    
    const checkboxGroups = document.querySelectorAll('div[role="list"][aria-labelledby]');
    checkboxGroups.forEach(group => {
      const firstOption = group.querySelector('div[role="checkbox"]');
      if (firstOption && firstOption.getAttribute('aria-checked') !== 'true') {
        firstOption.click();
        stats.checkboxSelected++;
        stats.total++;
      }
    });
    
    const dropdowns = document.querySelectorAll('div[role="listbox"]');
    dropdowns.forEach(dropdown => {
      dropdown.click();
      setTimeout(() => {
        const firstOption = document.querySelector('div[role="option"]');
        if (firstOption) {
          firstOption.click();
          stats.dropdownSelected++;
          stats.total++;
        }
      }, 100);
    });

    // Expose stats to the page so the popup can access it
    window.formFillStats = stats;
    return stats;
  })();