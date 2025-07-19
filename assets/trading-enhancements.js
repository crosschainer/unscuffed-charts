/* Trading View Enhancements */

document.addEventListener('DOMContentLoaded', function() {
  // Add active class to trade tabs
  const tradeTabs = [
    document.getElementById('tbBuy'),
    document.getElementById('tbSell'),
    document.getElementById('tbLiquidity')
  ];
  
  // Set Buy as active by default
  if (tradeTabs[0]) {
    tradeTabs[0].classList.add('active');
  }
  
  // Add click handlers for tabs
  tradeTabs.forEach(tab => {
    if (tab) {
      tab.addEventListener('click', function() {
        tradeTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      });
    }
  });
  
  // Add positive/negative classes to delta values
  function updateDeltaClasses() {
    const deltaElements = [
      document.getElementById('delta'),
      document.getElementById('deltaM')
    ];
    
    deltaElements.forEach(el => {
      if (el && el.textContent) {
        const value = parseFloat(el.textContent);
        if (!isNaN(value)) {
          el.classList.remove('positive', 'negative');
          if (value > 0) {
            el.classList.add('positive');
          } else if (value < 0) {
            el.classList.add('negative');
          }
        }
      }
    });
  }
  
  // Run initially and set interval to check periodically
  updateDeltaClasses();
  setInterval(updateDeltaClasses, 5000);
  
  // Add side classes to trade list
  function updateTradeClasses() {
    const tradesList = document.getElementById('tradesList');
    if (tradesList) {
      const rows = tradesList.querySelectorAll('tr');
      rows.forEach(row => {
        const sideCell = row.querySelector('td:first-child');
        if (sideCell) {
          const text = sideCell.textContent.trim().toLowerCase();
          sideCell.classList.remove('side-buy', 'side-sell');
          if (text.includes('buy')) {
            sideCell.classList.add('side-buy');
            sideCell.style.color = '#10b981';
          } else if (text.includes('sell')) {
            sideCell.classList.add('side-sell');
            sideCell.style.color = '#ef4444';
          }
        }
      });
    }
  }
  
  // Run initially and set interval to check periodically
  setTimeout(updateTradeClasses, 500);
  setInterval(updateTradeClasses, 2000);
  
  // Apply active class to timeframe buttons
  function updateTimeframeButtons() {
    const buttons = document.querySelectorAll('#tfToolbar button');
    buttons.forEach(button => {
      if (button.classList.contains('active')) {
        button.style.background = 'rgba(8, 251, 214, 0.15)';
        button.style.borderColor = 'rgba(8, 251, 214, 0.3)';
        button.style.color = '#08FBD6';
      }
    });
  }
  
  setTimeout(updateTimeframeButtons, 500);
});