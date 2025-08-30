/* assets/macros.js - DeFi Macro System
 * Allows users to create, save, and execute sequences of DeFi operations
 */

// Import necessary modules if we're in a module context
let allPairs = [];
let TOKEN_CACHE = {};

// Function to access global state
function accessGlobalState() {
  try {
    // Access state from the main application
    if (window.state && window.state.allPairs) {
      allPairs = window.state.allPairs;
      console.log('Successfully imported allPairs from state');
    }
    
    // Access TOKEN_CACHE from the main application
    if (window.api && window.api.TOKEN_CACHE) {
      TOKEN_CACHE = window.api.TOKEN_CACHE;
      console.log('Successfully imported TOKEN_CACHE from api');
    }
  } catch (err) {
    console.error('Error accessing main application state:', err);
  }
}

// Function to initialize the macro system
function initMacroSystem() {
  // Access global state
  accessGlobalState();
  
  // Initialize the macro UI
  initMacros();
}

// Available macro step types and their configurations
const MACRO_STEP_TYPES = {
  CLAIM_REWARDS: {
    name: 'Claim LP Rewards',
    description: 'Claim rewards from a liquidity pool',
    params: [
      { id: 'farmId', name: 'Farm ID', type: 'select', options: 'farms' }
    ]
  },
  SWAP: {
    name: 'Swap Tokens',
    description: 'Swap one token for another',
    params: [
      { id: 'fromToken', name: 'From Token', type: 'select', options: 'tokens' },
      { id: 'toToken', name: 'To Token', type: 'select', options: 'tokens' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 50%)' },
      { id: 'slippage', name: 'Slippage %', type: 'number', default: '1.0' }
    ]
  },
  ADD_LIQUIDITY: {
    name: 'Add Liquidity',
    description: 'Add liquidity to a pool',
    params: [
      { id: 'pairId', name: 'Pair ID', type: 'select', options: 'pairs' },
      { id: 'amount0', name: 'Token 0 Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' },
      { id: 'amount1', name: 'Token 1 Amount', type: 'text', placeholder: 'Amount or leave empty for auto' }
    ]
  },
  REMOVE_LIQUIDITY: {
    name: 'Remove Liquidity',
    description: 'Remove liquidity from a pool',
    params: [
      { id: 'pairId', name: 'Pair ID', type: 'select', options: 'pairs' },
      { id: 'percentage', name: 'Percentage to Remove', type: 'number', default: '100' }
    ]
  },
  ADD_TO_FARM: {
    name: 'Add to Farm',
    description: 'Stake LP tokens in a farm',
    params: [
      { id: 'farmId', name: 'Farm ID', type: 'select', options: 'farms' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' }
    ]
  },
  REMOVE_FROM_FARM: {
    name: 'Remove from Farm',
    description: 'Unstake LP tokens from a farm',
    params: [
      { id: 'farmId', name: 'Farm ID', type: 'select', options: 'farms' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' }
    ]
  },
  STAKE: {
    name: 'Stake Tokens',
    description: 'Stake tokens in a staking contract',
    params: [
      { id: 'stakingContract', name: 'Staking Contract', type: 'select', options: 'tokens' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' }
    ]
  },
  UNSTAKE: {
    name: 'Unstake Tokens',
    description: 'Unstake tokens from a staking contract',
    params: [
      { id: 'stakingContract', name: 'Staking Contract', type: 'select', options: 'tokens' },
      { id: 'amount', name: 'Amount', type: 'text', placeholder: 'Amount or % (e.g. 100%)' }
    ]
  },
  CLAIM_STAKING_REWARDS: {
    name: 'Claim Staking Rewards',
    description: 'Claim rewards from a staking contract',
    params: [
      { id: 'stakingContract', name: 'Staking Contract', type: 'select', options: 'tokens' }
    ]
  }
};

// Helper function to get liquidity for a pair
async function getLiq(contract, pairId, address) {
  try {
    const response = await fetch(`https://api.snaklytics.com/pairs/${pairId}/liquidity/${address}`);
    const data = await response.json();
    return data.userLP || 0;
  } catch (error) {
    console.error('Error fetching liquidity:', error);
    return 0;
  }
}

// DOM Elements
const macroNameInput = document.getElementById('macroName');
const macroStepsContainer = document.getElementById('macroSteps');
const addStepBtn = document.getElementById('addStepBtn');
const saveMacroBtn = document.getElementById('saveMacroBtn');
const clearMacroBtn = document.getElementById('clearMacroBtn');
const savedMacrosContainer = document.getElementById('savedMacros');
const shareLinkInput = document.getElementById('shareLink');
const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
const importLinkInput = document.getElementById('importLink');
const importMacroBtn = document.getElementById('importMacroBtn');
const executeMacroSelect = document.getElementById('executeMacroSelect');
const executeMacroBtn = document.getElementById('executeMacroBtn');
const executionStatus = document.getElementById('executionStatus');
const executionSteps = document.getElementById('executionSteps');

// State
let currentMacro = {
  name: '',
  steps: []
};

let savedMacros = [];
let availableFarms = [];
let availablePairs = [];
let availableTokens = [];

// Initialize the macros system
// Add custom styles for dropdowns to fix styling issues
function addDropdownStyles() {
  // Check if styles already exist
  if (document.getElementById('macro-dropdown-styles')) {
    return;
  }
  
  // Create style element
  const style = document.createElement('style');
  style.id = 'macro-dropdown-styles';
  style.textContent = `
    /* Fix dropdown styling */
    select {
      color: #fff !important;
      background-color: #1a1a1a !important;
    }
    
    select option {
      color: #fff !important;
      background-color: #1a1a1a !important;
    }
    
    /* Improve dropdown hover state */
    select option:hover, select option:focus, select option:active, select option:checked {
      background-color: #333 !important;
      color: #fff !important;
    }
  `;
  
  // Add to document head
  document.head.appendChild(style);
}

function initMacros() {
  // Access global state first
  accessGlobalState();
  
  // Load available options (farms, pairs, tokens)
  loadAvailableOptions().then(() => {
    console.log('Available options loaded');
  }).catch(err => {
    console.error('Failed to load available options:', err);
  });
  
  // Load saved macros from localStorage
  loadSavedMacros();
  
  // Add dropdown styling to fix light text on light background
  addDropdownStyles();
  
  // Set up event listeners
  addStepBtn.addEventListener('click', showAddStepModal);
  saveMacroBtn.addEventListener('click', saveMacro);
  clearMacroBtn.addEventListener('click', clearMacro);
  copyShareLinkBtn.addEventListener('click', copyShareLink);
  importMacroBtn.addEventListener('click', importMacro);
  executeMacroBtn.addEventListener('click', executeMacro);
  
  // Create the add step modal
  createAddStepModal();
}

// Load saved macros from localStorage
function loadSavedMacros() {
  try {
    const saved = localStorage.getItem('xianDexMacros');
    if (saved) {
      savedMacros = JSON.parse(saved);
      renderSavedMacros();
      updateExecuteMacroSelect();
    }
  } catch (err) {
    console.error('Failed to load saved macros:', err);
    savedMacros = [];
  }
}

// Save macros to localStorage
function saveMacrosToStorage() {
  try {
    localStorage.setItem('xianDexMacros', JSON.stringify(savedMacros));
  } catch (err) {
    console.error('Failed to save macros to localStorage:', err);
    showToast('Failed to save macros', 'error');
  }
}

// Render the list of saved macros
function renderSavedMacros() {
  savedMacrosContainer.innerHTML = '';
  
  if (savedMacros.length === 0) {
    savedMacrosContainer.innerHTML = '<div class="text-sm text-gray-400 italic">No saved macros yet</div>';
    return;
  }
  
  savedMacros.forEach((macro, index) => {
    const macroEl = document.createElement('div');
    macroEl.className = 'bg-white/5 rounded p-3 relative';
    
    macroEl.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-medium">${macro.name}</h3>
        <div class="flex gap-1">
          <button class="edit-macro-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button class="delete-macro-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div class="text-xs text-gray-400 mb-2">${macro.steps.length} step${macro.steps.length !== 1 ? 's' : ''}</div>
      <div class="text-xs space-y-1">
        ${macro.steps.map(step => `<div class="bg-white/5 px-2 py-1 rounded">${MACRO_STEP_TYPES[step.type].name}</div>`).join('')}
      </div>
    `;
    
    // Add event listeners
    savedMacrosContainer.appendChild(macroEl);
  });
  
  // Add event listeners for edit and delete buttons
  document.querySelectorAll('.edit-macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      editMacro(index);
    });
  });
  
  document.querySelectorAll('.delete-macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      deleteMacro(index);
    });
  });
}

// Update the execute macro select dropdown
function updateExecuteMacroSelect() {
  executeMacroSelect.innerHTML = '<option value="">-- Select a macro --</option>';
  
  savedMacros.forEach((macro, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = macro.name;
    executeMacroSelect.appendChild(option);
  });
}

// Load available options for selects (farms, pairs, tokens)
async function loadAvailableOptions() {
  // Import necessary modules
  try {
    // Use existing data from the main application if available
    if (window.allPairs && window.allPairs.length > 0) {
      console.log('Using existing pairs data from main application');
      availablePairs = window.allPairs.map(pair => ({
        id: pair.pair,
        name: `${pair.token0Symbol || pair.token0}-${pair.token1Symbol || pair.token1}`,
        token0: pair.token0,
        token1: pair.token1,
        token0Symbol: pair.token0Symbol,
        token1Symbol: pair.token1Symbol,
        reserve0: pair.reserve0,
        reserve1: pair.reserve1
      }));
    } else {
      // Load farms from farms.txt
      try {
        const farmsText = await fetch('farms.txt').then(r => r.text());
        availableFarms = farmsText.trim().split('\n').map(line => {
          const parts = line.split(';');
          const [pairIdx, title, reward, farm, token0, token1] = parts;
          return {
            id: farm, // Use the actual farm contract
            name: title,
            pairIdx: pairIdx,
            token0: token0 || 'currency',
            token1: token1 || 'con_usdc',
            reward: reward || 'XIAN'
          };
        });
      } catch (err) {
        console.error('Failed to load farms:', err);
        availableFarms = [];
      }
      
      // Load pairs from the API
      try {
        // Define API base URL
        const API_BASE = 'https://api.snaklytics.com';
        
        // First try to get pairs from the API
        const response = await fetch(`${API_BASE}/pairs?limit=100`);
        const data = await response.json();
        
        if (data && data.pairs && data.pairs.length > 0) {
          availablePairs = data.pairs.map(pair => ({
            id: pair.id.toString(),
            name: `${pair.token0.symbol}-${pair.token1.symbol}`,
            token0: pair.token0.contract,
            token1: pair.token1.contract,
            token0Symbol: pair.token0.symbol,
            token1Symbol: pair.token1.symbol,
            token0Decimals: pair.token0.decimals || 18,
            token1Decimals: pair.token1.decimals || 18,
            reserve0: pair.reserve0,
            reserve1: pair.reserve1
          }));
        } else {
          // Fallback to farms data
          availablePairs = availableFarms.map(farm => {
            return {
              id: farm.pairIdx,
              name: farm.name,
              token0: farm.token0,
              token1: farm.token1
            };
          });
          
          // Add default pairs if no farms
          if (availablePairs.length === 0) {
            availablePairs = [
              { id: '1', name: 'XIAN-USDC', token0: 'currency', token1: 'con_usdc' },
              { id: '21', name: 'SSS-XIAN', token0: 'con_slither', token1: 'currency' }
            ];
          }
        }
      } catch (err) {
        console.error('Failed to load pairs:', err);
        
        // Fallback to farms data
        availablePairs = availableFarms.map(farm => {
          return {
            id: farm.pairIdx,
            name: farm.name,
            token0: farm.token0,
            token1: farm.token1
          };
        });
        
        // Add default pairs if no farms
        if (availablePairs.length === 0) {
          availablePairs = [
            { id: '1', name: 'XIAN-USDC', token0: 'currency', token1: 'con_usdc' },
            { id: '21', name: 'SSS-XIAN', token0: 'con_slither', token1: 'currency' }
          ];
        }
      }
    }
    
    // Load tokens from TOKEN_CACHE if available
    if (window.TOKEN_CACHE && Object.keys(window.TOKEN_CACHE).length > 0) {
      console.log('Using existing token data from TOKEN_CACHE');
      availableTokens = Object.entries(window.TOKEN_CACHE)
        .filter(([contract, meta]) => meta && meta.symbol)
        .map(([contract, meta]) => ({
          id: contract,
          name: meta.symbol,
          decimals: meta.decimals || 18
        }));
    } else {
      // Standard tokens in the system
      availableTokens = [
        { id: 'currency', name: 'XIAN', decimals: 18 },
        { id: 'con_usdc', name: 'USDC', decimals: 6 },
        { id: 'con_eth', name: 'ETH', decimals: 18 },
        { id: 'con_slither', name: 'SSS', decimals: 18 }
      ];
    }
    
    // Add staking contracts
    const stakingContracts = [
      { id: 'con_staking_xian', name: 'XIAN Staking', decimals: 18 },
      { id: 'con_staking_sss', name: 'SSS Staking', decimals: 18 }
    ];
    
    // Add staking contracts if they're not already in the tokens list
    for (const contract of stakingContracts) {
      if (!availableTokens.some(t => t.id === contract.id)) {
        availableTokens.push(contract);
      }
    }
    
    // Load farms from farms.txt if not already loaded
    if (availableFarms.length === 0) {
      try {
        const farmsText = await fetch('farms.txt').then(r => r.text());
        availableFarms = farmsText.trim().split('\n').map(line => {
          const parts = line.split(';');
          const [pairIdx, title, reward, farm, token0, token1] = parts;
          return {
            id: farm, // Use the actual farm contract
            name: title,
            pairIdx: pairIdx,
            token0: token0 || 'currency',
            token1: token1 || 'con_usdc',
            reward: reward || 'XIAN'
          };
        });
      } catch (err) {
        console.error('Failed to load farms:', err);
        availableFarms = [];
      }
    }
    
    console.log('Loaded options:', {
      pairs: availablePairs.length,
      tokens: availableTokens.length,
      farms: availableFarms.length
    });
  } catch (err) {
    console.error('Failed to load available options:', err);
    
    // Fallback to basic data
    availablePairs = [
      { id: '1', name: 'XIAN-USDC', token0: 'currency', token1: 'con_usdc' },
      { id: '21', name: 'SSS-XIAN', token0: 'con_slither', token1: 'currency' }
    ];
    
    availableTokens = [
      { id: 'currency', name: 'XIAN', decimals: 18 },
      { id: 'con_usdc', name: 'USDC', decimals: 6 },
      { id: 'con_eth', name: 'ETH', decimals: 18 },
      { id: 'con_slither', name: 'SSS', decimals: 18 },
      { id: 'con_staking_xian', name: 'XIAN Staking', decimals: 18 },
      { id: 'con_staking_sss', name: 'SSS Staking', decimals: 18 }
    ];
    
    availableFarms = [];
  }
}

// Create the modal for adding steps
function createAddStepModal() {
  const modal = document.createElement('div');
  modal.id = 'addStepModal';
  modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 hidden';
  
  modal.innerHTML = `
    <div class="bg-brand-card rounded-lg p-4 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Add Macro Step</h3>
        <button id="closeStepModal" class="p-1 hover:bg-white/10 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-400 mb-1">Step Type</label>
        <select id="stepTypeSelect" class="w-full rounded bg-white/5 px-3 py-2 
                focus:outline-none focus:ring-2 focus:ring-brand-cyan">
          <option value="">-- Select step type --</option>
          ${Object.entries(MACRO_STEP_TYPES).map(([type, config]) => 
            `<option value="${type}">${config.name}</option>`
          ).join('')}
        </select>
      </div>
      
      <div id="stepParamsContainer" class="space-y-3">
        <!-- Parameters will be added here dynamically -->
      </div>
      
      <div class="flex justify-end mt-4">
        <button id="addStepToMacroBtn" class="px-4 py-2 font-medium rounded-md
                 bg-brand-cyan text-black
                 hover:bg-brand-cyan/90 active:bg-brand-cyan/80
                 focus:outline-none focus:ring-2 focus:ring-brand-cyan
                 transition">
          Add Step
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('closeStepModal').addEventListener('click', hideAddStepModal);
  document.getElementById('stepTypeSelect').addEventListener('change', updateStepParams);
  document.getElementById('addStepToMacroBtn').addEventListener('click', addStepToMacro);
}

// Show the add step modal
function showAddStepModal() {
  const modal = document.getElementById('addStepModal');
  modal.classList.remove('hidden');
  document.getElementById('stepTypeSelect').value = '';
  document.getElementById('stepParamsContainer').innerHTML = '';
}

// Hide the add step modal
function hideAddStepModal() {
  const modal = document.getElementById('addStepModal');
  modal.classList.add('hidden');
}

// Update the step parameters based on the selected step type
function updateStepParams() {
  const stepType = document.getElementById('stepTypeSelect').value;
  const paramsContainer = document.getElementById('stepParamsContainer');
  
  paramsContainer.innerHTML = '';
  
  if (!stepType || !MACRO_STEP_TYPES[stepType]) {
    return;
  }
  
  const stepConfig = MACRO_STEP_TYPES[stepType];
  
  stepConfig.params.forEach(param => {
    const paramEl = document.createElement('div');
    
    let inputHtml = '';
    
    if (param.type === 'select') {
      let options = [];
      
      if (param.options === 'farms') {
        options = availableFarms.map(farm => `<option value="${farm.id}">${farm.name}</option>`);
      } else if (param.options === 'pairs') {
        options = availablePairs.map(pair => `<option value="${pair.id}">${pair.name}</option>`);
      } else if (param.options === 'tokens') {
        options = availableTokens.map(token => `<option value="${token.id}">${token.name}</option>`);
      }
      
      inputHtml = `
        <select id="param_${param.id}" class="w-full rounded bg-white/5 px-3 py-2 
                focus:outline-none focus:ring-2 focus:ring-brand-cyan">
          <option value="">-- Select ${param.name} --</option>
          ${options.join('')}
        </select>
      `;
    } else if (param.type === 'number') {
      inputHtml = `
        <input type="number" id="param_${param.id}" 
               class="w-full rounded bg-white/5 px-3 py-2 
               focus:outline-none focus:ring-2 focus:ring-brand-cyan"
               value="${param.default || ''}" step="0.1" min="0">
      `;
    } else {
      inputHtml = `
        <input type="text" id="param_${param.id}" 
               class="w-full rounded bg-white/5 px-3 py-2 
               focus:outline-none focus:ring-2 focus:ring-brand-cyan"
               placeholder="${param.placeholder || ''}" value="${param.default || ''}">
      `;
    }
    
    paramEl.innerHTML = `
      <label class="block text-sm font-medium text-gray-400 mb-1">${param.name}</label>
      ${inputHtml}
    `;
    
    paramsContainer.appendChild(paramEl);
  });
}

// Add a step to the current macro
function addStepToMacro() {
  const stepType = document.getElementById('stepTypeSelect').value;
  
  if (!stepType || !MACRO_STEP_TYPES[stepType]) {
    showToast('Please select a step type', 'error');
    return;
  }
  
  const stepConfig = MACRO_STEP_TYPES[stepType];
  const params = {};
  
  // Validate and collect parameters
  let isValid = true;
  
  stepConfig.params.forEach(param => {
    const paramEl = document.getElementById(`param_${param.id}`);
    const value = paramEl.value.trim();
    
    if (!value && param.required !== false) {
      isValid = false;
      paramEl.classList.add('ring-2', 'ring-red-500');
    } else {
      paramEl.classList.remove('ring-2', 'ring-red-500');
      params[param.id] = value;
    }
  });
  
  if (!isValid) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  // Check if we're editing an existing step
  const addBtn = document.getElementById('addStepToMacroBtn');
  const editIndex = addBtn.dataset.editIndex;
  
  if (editIndex !== undefined) {
    // Update existing step
    currentMacro.steps[editIndex] = {
      type: stepType,
      params
    };
    
    // Reset the button
    addBtn.textContent = 'Add Step';
    delete addBtn.dataset.editIndex;
    
    showToast('Step updated successfully', 'success');
  } else {
    // Add new step
    currentMacro.steps.push({
      type: stepType,
      params
    });
    
    showToast('Step added successfully', 'success');
  }
  
  // Render the updated steps
  renderMacroSteps();
  
  // Hide the modal
  hideAddStepModal();
  
  // Update share link
  updateShareLink();
}

// Render the current macro steps
function renderMacroSteps() {
  macroStepsContainer.innerHTML = '';
  
  if (currentMacro.steps.length === 0) {
    // Empty state is handled by CSS
    return;
  }
  
  currentMacro.steps.forEach((step, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'macro-step-card relative';
    
    const stepConfig = MACRO_STEP_TYPES[step.type];
    if (!stepConfig) {
      console.error(`Unknown step type: ${step.type}`);
      return;
    }
    
    // Add step number badge
    const stepNumberBadge = document.createElement('div');
    stepNumberBadge.className = 'absolute -left-2 -top-2 bg-brand-base border border-white/10 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold';
    stepNumberBadge.textContent = index + 1;
    stepEl.appendChild(stepNumberBadge);
    
    // Choose icon based on step type
    let iconSvg = '';
    switch(step.type) {
      case 'CLAIM_REWARDS':
        iconSvg = '<path d="M10.75 6.75a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" /><path fill-rule="evenodd" d="M8 1a.75.75 0 01.75.75V3a.75.75 0 01-1.5 0V1.75A.75.75 0 018 1zm0 14a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 15zM1.75 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H2.5A.75.75 0 011.75 8zm14 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />';
        break;
      case 'SWAP':
        iconSvg = '<path fill-rule="evenodd" d="M15.97 2.47a.75.75 0 011.06 0l1.5 1.5a.75.75 0 010 1.06l-1.5 1.5a.75.75 0 11-1.06-1.06l.219-.22H4.75a.75.75 0 010-1.5h11.439l-.22-.22a.75.75 0 010-1.06zm-15 8.5a.75.75 0 011.06 0l.22.22h11.44a.75.75 0 010 1.5H2.25l.22.22a.75.75 0 11-1.06 1.06l-1.5-1.5a.75.75 0 010-1.06l1.5-1.5a.75.75 0 011.06 0z" clip-rule="evenodd" />';
        break;
      case 'ADD_LIQUIDITY':
        iconSvg = '<path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.202.592.037.051.08.102.128.152z" /><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-6a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.33.744.74.925 1.2a.75.75 0 01-1.395.55 1.35 1.35 0 00-.447-.563 2.187 2.187 0 00-.736-.363V9.3c.698.093 1.383.32 1.959.696.787.514 1.29 1.27 1.29 2.13 0 .86-.504 1.616-1.29 2.13-.576.377-1.261.603-1.96.696v.299a.75.75 0 11-1.5 0v-.3c-.697-.092-1.382-.318-1.958-.695-.482-.315-.857-.717-1.078-1.188a.75.75 0 111.359-.636c.08.173.245.376.54.569.313.205.706.353 1.138.432v-2.748a3.782 3.782 0 01-1.653-.713C6.9 9.433 6.5 8.681 6.5 7.875c0-.805.4-1.558 1.097-2.096a3.78 3.78 0 011.653-.713V4.75A.75.75 0 0110 4z" clip-rule="evenodd" />';
        break;
      case 'REMOVE_LIQUIDITY':
        iconSvg = '<path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.202.592.037.051.08.102.128.152z" /><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-6a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.33.744.74.925 1.2a.75.75 0 01-1.395.55 1.35 1.35 0 00-.447-.563 2.187 2.187 0 00-.736-.363V9.3c.698.093 1.383.32 1.959.696.787.514 1.29 1.27 1.29 2.13 0 .86-.504 1.616-1.29 2.13-.576.377-1.261.603-1.96.696v.299a.75.75 0 11-1.5 0v-.3c-.697-.092-1.382-.318-1.958-.695-.482-.315-.857-.717-1.078-1.188a.75.75 0 111.359-.636c.08.173.245.376.54.569.313.205.706.353 1.138.432v-2.748a3.782 3.782 0 01-1.653-.713C6.9 9.433 6.5 8.681 6.5 7.875c0-.805.4-1.558 1.097-2.096a3.78 3.78 0 011.653-.713V4.75A.75.75 0 0110 4z" clip-rule="evenodd" />';
        break;
      case 'ADD_TO_FARM':
        iconSvg = '<path d="M13.75 7h-3V3.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L6.2 4.74a.75.75 0 001.1 1.02l1.95-2.1V7h-3A2.25 2.25 0 004 9.25v7.5A2.25 2.25 0 006.25 19h7.5A2.25 2.25 0 0016 16.75v-7.5A2.25 2.25 0 0013.75 7zm-3 0h-1.5v5.25a.75.75 0 001.5 0V7z" />';
        break;
      default:
        iconSvg = '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" />';
    }
    
    let paramsHtml = '';
    
    Object.entries(step.params).forEach(([key, value]) => {
      const paramConfig = stepConfig.params.find(p => p.id === key);
      if (!paramConfig) return;
      
      let displayValue = value;
      
      // Format display values for selects
      if (paramConfig.type === 'select') {
        if (paramConfig.options === 'farms') {
          const farm = availableFarms.find(f => f.id === value);
          if (farm) displayValue = farm.name;
        } else if (paramConfig.options === 'pairs') {
          const pair = availablePairs.find(p => p.id === value);
          if (pair) displayValue = pair.name;
        } else if (paramConfig.options === 'tokens') {
          const token = availableTokens.find(t => t.id === value);
          if (token) displayValue = token.name;
        }
      }
      
      paramsHtml += `
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-400">${paramConfig.name}:</span>
          <span class="font-medium">${displayValue || 'Not set'}</span>
        </div>
      `;
    });
    
    stepEl.innerHTML += `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-medium flex items-center">
          <span class="text-brand-cyan mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              ${iconSvg}
            </svg>
          </span>
          ${stepConfig.name}
        </h3>
        <div class="flex gap-1">
          <button class="move-step-up-btn p-1 text-xs rounded hover:bg-white/10 ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}" 
                  data-index="${index}" ${index === 0 ? 'disabled' : ''} title="Move step up">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="move-step-down-btn p-1 text-xs rounded hover:bg-white/10 ${index === currentMacro.steps.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}" 
                  data-index="${index}" ${index === currentMacro.steps.length - 1 ? 'disabled' : ''} title="Move step down">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="edit-step-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}" title="Edit step">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button class="delete-step-btn p-1 text-xs rounded hover:bg-white/10" data-index="${index}" title="Delete step">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div class="text-xs text-gray-400 mb-2">${stepConfig.description}</div>
      ${paramsHtml}
    `;
    
    macroStepsContainer.appendChild(stepEl);
  });
  
  // Add event listeners for step buttons
  document.querySelectorAll('.move-step-up-btn').forEach(btn => {
    if (btn.disabled) return;
    
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      moveStepUp(index);
    });
  });
  
  document.querySelectorAll('.move-step-down-btn').forEach(btn => {
    if (btn.disabled) return;
    
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      moveStepDown(index);
    });
  });
  
  document.querySelectorAll('.delete-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      deleteStep(index);
    });
  });
  
  document.querySelectorAll('.edit-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      editStep(index);
    });
  });
}

// Move a step up in the macro
function moveStepUp(index) {
  if (index <= 0 || index >= currentMacro.steps.length) return;
  
  const temp = currentMacro.steps[index];
  currentMacro.steps[index] = currentMacro.steps[index - 1];
  currentMacro.steps[index - 1] = temp;
  
  renderMacroSteps();
  updateShareLink();
}

// Move a step down in the macro
function moveStepDown(index) {
  if (index < 0 || index >= currentMacro.steps.length - 1) return;
  
  const temp = currentMacro.steps[index];
  currentMacro.steps[index] = currentMacro.steps[index + 1];
  currentMacro.steps[index + 1] = temp;
  
  renderMacroSteps();
  updateShareLink();
}

// Delete a step from the macro
function deleteStep(index) {
  if (index < 0 || index >= currentMacro.steps.length) return;
  
  currentMacro.steps.splice(index, 1);
  
  renderMacroSteps();
  updateShareLink();
}

// Edit an existing step
function editStep(index) {
  if (index < 0 || index >= currentMacro.steps.length) return;
  
  const step = currentMacro.steps[index];
  
  // Show the add step modal
  showAddStepModal();
  
  // Set the step type
  const stepTypeSelect = document.getElementById('stepTypeSelect');
  stepTypeSelect.value = step.type;
  
  // Trigger the change event to load parameters
  const event = new Event('change');
  stepTypeSelect.dispatchEvent(event);
  
  // Set the parameter values
  setTimeout(() => {
    Object.entries(step.params).forEach(([key, value]) => {
      const input = document.getElementById(`param_${key}`);
      if (input) {
        input.value = value;
      }
    });
    
    // Change the add button to update
    const addBtn = document.getElementById('addStepToMacroBtn');
    addBtn.textContent = 'Update Step';
    addBtn.dataset.editIndex = index;
  }, 100);
}

// Save the current macro
function saveMacro() {
  const name = macroNameInput.value.trim();
  
  if (!name) {
    showToast('Please enter a macro name', 'error');
    macroNameInput.focus();
    return;
  }
  
  if (currentMacro.steps.length === 0) {
    showToast('Please add at least one step', 'error');
    return;
  }
  
  // Check if we're editing an existing macro
  const existingIndex = savedMacros.findIndex(m => m.id === currentMacro.id);
  
  if (existingIndex >= 0) {
    // Update existing macro
    savedMacros[existingIndex] = {
      ...currentMacro,
      name
    };
  } else {
    // Add new macro
    savedMacros.push({
      id: Date.now().toString(),
      name,
      steps: [...currentMacro.steps]
    });
  }
  
  // Save to localStorage
  saveMacrosToStorage();
  
  // Update UI
  renderSavedMacros();
  updateExecuteMacroSelect();
  
  // Show success message
  showToast('Macro saved successfully', 'success');
  
  // Clear the form
  clearMacro();
}

// Clear the current macro
function clearMacro() {
  currentMacro = {
    name: '',
    steps: []
  };
  
  macroNameInput.value = '';
  renderMacroSteps();
  updateShareLink();
}

// Edit an existing macro
function editMacro(index) {
  if (index < 0 || index >= savedMacros.length) return;
  
  const macro = savedMacros[index];
  
  currentMacro = {
    id: macro.id,
    name: macro.name,
    steps: [...macro.steps]
  };
  
  macroNameInput.value = macro.name;
  renderMacroSteps();
  updateShareLink();
  
  // Scroll to the top of the macros view
  document.getElementById('macrosView').scrollTo(0, 0);
}

// Delete a saved macro
function deleteMacro(index) {
  if (index < 0 || index >= savedMacros.length) return;
  
  if (!confirm(`Are you sure you want to delete the macro "${savedMacros[index].name}"?`)) {
    return;
  }
  
  savedMacros.splice(index, 1);
  
  // Save to localStorage
  saveMacrosToStorage();
  
  // Update UI
  renderSavedMacros();
  updateExecuteMacroSelect();
  
  // Show success message
  showToast('Macro deleted', 'info');
}

// Update the share link for the current macro
function updateShareLink() {
  if (currentMacro.steps.length === 0) {
    shareLinkInput.value = '';
    return;
  }
  
  const macroData = {
    name: macroNameInput.value.trim() || 'Unnamed Macro',
    steps: currentMacro.steps
  };
  
  const encoded = btoa(JSON.stringify(macroData));
  shareLinkInput.value = encoded;
}

// Copy the share link to clipboard
function copyShareLink() {
  const shareLink = shareLinkInput.value;
  
  if (!shareLink) {
    showToast('No macro to share', 'error');
    return;
  }
  
  navigator.clipboard.writeText(shareLink)
    .then(() => {
      showToast('Macro code copied to clipboard', 'success');
    })
    .catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy to clipboard', 'error');
    });
}

// Import a macro from a share link
function importMacro() {
  const importCode = importLinkInput.value.trim();
  
  if (!importCode) {
    showToast('Please enter a macro code', 'error');
    importLinkInput.focus();
    return;
  }
  
  try {
    const decoded = atob(importCode);
    const macroData = JSON.parse(decoded);
    
    if (!macroData.name || !Array.isArray(macroData.steps)) {
      throw new Error('Invalid macro format');
    }
    
    // Validate steps
    macroData.steps.forEach(step => {
      if (!step.type || !MACRO_STEP_TYPES[step.type]) {
        throw new Error(`Invalid step type: ${step.type}`);
      }
    });
    
    // Set as current macro
    currentMacro = {
      name: macroData.name,
      steps: macroData.steps
    };
    
    macroNameInput.value = macroData.name;
    renderMacroSteps();
    updateShareLink();
    
    // Clear import field
    importLinkInput.value = '';
    
    // Show success message
    showToast('Macro imported successfully', 'success');
    
  } catch (err) {
    console.error('Failed to import macro:', err);
    showToast('Invalid macro code', 'error');
  }
}

// Execute a macro
async function executeMacro() {
  const macroIndex = executeMacroSelect.value;
  
  if (!macroIndex) {
    showToast('Please select a macro to execute', 'error');
    return;
  }
  
  const macro = savedMacros[macroIndex];
  
  if (!macro || !macro.steps || macro.steps.length === 0) {
    showToast('Invalid macro', 'error');
    return;
  }
  
  // Check if wallet is connected
  try {
    const walletInfo = await XianWalletUtils.requestWalletInfo();
    if (!walletInfo || !walletInfo.address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
  } catch (err) {
    console.error('Failed to check wallet:', err);
    showToast('Please connect your wallet first', 'error');
    return;
  }
  
  // Show execution status
  executionStatus.classList.remove('hidden');
  executionSteps.innerHTML = '';
  
  // Disable execute button
  executeMacroBtn.disabled = true;
  executeMacroBtn.classList.add('opacity-50', 'cursor-not-allowed');
  
  // Execute each step sequentially
  for (let i = 0; i < macro.steps.length; i++) {
    const step = macro.steps[i];
    const stepConfig = MACRO_STEP_TYPES[step.type];
    
    // Add step to UI
    const stepEl = document.createElement('div');
    stepEl.className = 'flex items-center gap-2';
    stepEl.innerHTML = `
      <div class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
        <span class="text-xs">${i + 1}</span>
      </div>
      <div class="flex-1">
        <div class="font-medium">${stepConfig.name}</div>
        <div class="text-xs text-gray-400 step-status">Pending...</div>
      </div>
      <div class="step-indicator">
        <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-cyan"></div>
      </div>
    `;
    
    executionSteps.appendChild(stepEl);
    
    // Execute the step
    try {
      await executeStep(step);
      
      // Update UI to show success
      stepEl.querySelector('.step-status').textContent = 'Completed';
      stepEl.querySelector('.step-indicator').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
      `;
    } catch (err) {
      console.error(`Failed to execute step ${i + 1}:`, err);
      
      // Update UI to show error
      stepEl.querySelector('.step-status').textContent = `Error: ${err.message || 'Unknown error'}`;
      stepEl.querySelector('.step-indicator').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      `;
      
      // Stop execution
      break;
    }
  }
  
  // Re-enable execute button
  executeMacroBtn.disabled = false;
  executeMacroBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// Execute a single step of a macro
async function executeStep(step) {
  // Execute the step based on its type
  switch (step.type) {
    case 'CLAIM_REWARDS':
      return await claimRewards(step.params);
    case 'SWAP':
      return await swapTokens(step.params);
    case 'ADD_LIQUIDITY':
      return await addLiquidity(step.params);
    case 'REMOVE_LIQUIDITY':
      return await removeLiquidity(step.params);
    case 'ADD_TO_FARM':
      return await addToFarm(step.params);
    case 'REMOVE_FROM_FARM':
      return await removeFromFarm(step.params);
    case 'STAKE':
      return await stakeTokens(step.params);
    case 'UNSTAKE':
      return await unstakeTokens(step.params);
    case 'CLAIM_STAKING_REWARDS':
      return await claimStakingRewards(step.params);
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

// Claim rewards from a farm
async function claimRewards(params) {
  const { farmId } = params;
  
  try {
    // The farmId is already the contract name from our farms.txt
    const farmContract = farmId;
    
    // Call the withdrawRewards method on the farm contract (from farms.js)
    const result = await XianWalletUtils.sendTransaction(
      farmContract,
      'withdrawRewards',
      {
        amount: 0 // Withdraw all rewards
      }
    );
    
    console.log('Claim rewards result:', result);
    return result;
  } catch (err) {
    console.error('Failed to claim rewards:', err);
    throw new Error(`Failed to claim rewards: ${err.message || 'Unknown error'}`);
  }
}

// Swap tokens
async function swapTokens(params) {
  const { fromToken, toToken, amount, slippage } = params;
  
  try {
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get balance of fromToken
      const balance = await XianWalletUtils.getBalance(fromToken);
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // Find the pair that contains both tokens
    const pair = availablePairs.find(p => 
      (p.token0 === fromToken && p.token1 === toToken) || 
      (p.token0 === toToken && p.token1 === fromToken)
    );
    
    if (!pair) {
      throw new Error(`No trading pair found for ${fromToken} and ${toToken}`);
    }
    
    // Determine the side (buy or sell)
    const side = pair.token0 === fromToken ? 'sell' : 'buy';
    
    // Get the DEX contract - use the correct one from the repo
    const dexContract = 'con_dex_v2';
    
    // First approve the DEX to use our tokens
    await XianWalletUtils.sendTransaction(
      fromToken,
      'approve',
      { to: dexContract, amount: actualAmount }
    );
    
    // Calculate minimum amount out based on slippage
    const slippageMultiplier = (100 - parseFloat(slippage)) / 100;
    
    // Try to get expected output amount
    let expectedOut = 0;
    try {
      // Try to get the pair data from the API
      const API_BASE = 'https://api.snaklytics.com';
      const response = await fetch(`${API_BASE}/pairs/${pair.id}`);
      const pairData = await response.json();
      
      if (pairData && pairData.reserve0 && pairData.reserve1) {
        // Calculate expected output based on constant product formula
        const inputReserve = side === 'sell' ? parseFloat(pairData.reserve0) : parseFloat(pairData.reserve1);
        const outputReserve = side === 'sell' ? parseFloat(pairData.reserve1) : parseFloat(pairData.reserve0);
        
        // Calculate output with 0.3% fee
        const inputWithFee = parseFloat(actualAmount) * 0.997;
        expectedOut = (inputWithFee * outputReserve) / (inputReserve + inputWithFee);
      }
    } catch (err) {
      console.error('Error calculating expected output:', err);
    }
    
    // Apply slippage to get minimum output
    const minOut = expectedOut > 0 ? Math.floor(expectedOut * slippageMultiplier) : 0;
    
    // Deadline – 5 minutes from now
    const now = new Date();
    const deadline = new Date(now.getTime() + 5 * 60 * 1000);
    const datetimeArg = {
      '__time__': [
        deadline.getUTCFullYear(),
        deadline.getUTCMonth() + 1,
        deadline.getUTCDate(),
        deadline.getUTCHours(),
        deadline.getUTCMinutes()
      ]
    };
    
    // Call the swap method on the DEX contract
    const result = await XianWalletUtils.sendTransaction(
      dexContract,
      'swapExactTokenForTokenSupportingFeeOnTransferTokens',
      {
        amountIn: actualAmount,
        amountOutMin: minOut, // Use calculated minOut with slippage
        pair: parseInt(pair.id),
        src: fromToken,
        to: XianWalletUtils.getAddress(), // Current user's address
        deadline: datetimeArg
      }
    );
    
    console.log('Swap result:', result);
    return result;
  } catch (err) {
    console.error('Failed to swap tokens:', err);
    throw new Error(`Failed to swap tokens: ${err.message || 'Unknown error'}`);
  }
}

// Add liquidity to a pool
async function addLiquidity(params) {
  const { pairId, amount0, amount1 } = params;
  
  try {
    // Get pair info
    const pair = availablePairs.find(p => p.id === pairId);
    if (!pair) {
      throw new Error(`Pair with ID ${pairId} not found`);
    }
    
    // Get token contracts directly from the pair
    const token0 = pair.token0;
    const token1 = pair.token1;
    
    // Determine if amount0 is a percentage
    let actualAmount0;
    if (amount0.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount0) / 100;
      
      // Get balance of token0
      const balance = await XianWalletUtils.getBalance(token0);
      
      // Calculate amount based on percentage
      actualAmount0 = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount0 = amount0;
    }
    
    // Determine amount1 (if not provided, it will be calculated by the contract)
    let actualAmount1 = amount1;
    if (amount1 && amount1.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount1) / 100;
      
      // Get balance of token1
      const balance = await XianWalletUtils.getBalance(token1);
      
      // Calculate amount based on percentage
      actualAmount1 = Math.floor(parseFloat(balance) * percentage).toString();
    }
    
    // Get the DEX contract - use the correct one from the repo
    const dexContract = 'con_dex_v2';
    
    // Deadline – 5 minutes from now
    const now = new Date();
    const deadline = new Date(now.getTime() + 5 * 60 * 1000);
    const datetimeArg = {
      '__time__': [
        deadline.getUTCFullYear(),
        deadline.getUTCMonth() + 1,
        deadline.getUTCDate(),
        deadline.getUTCHours(),
        deadline.getUTCMinutes()
      ]
    };
    
    // First approve tokenA
    await XianWalletUtils.sendTransaction(
      token0,
      'approve',
      { to: dexContract, amount: actualAmount0 }
    );
    
    // Then approve tokenB
    await XianWalletUtils.sendTransaction(
      token1,
      'approve',
      { to: dexContract, amount: actualAmount1 }
    );
    
    // Call the addLiquidity method on the DEX contract
    const result = await XianWalletUtils.sendTransaction(
      dexContract,
      'addLiquidity',
      {
        tokenA: token0,
        tokenB: token1,
        amountADesired: actualAmount0,
        amountBDesired: actualAmount1,
        amountAMin: 0, // Accept any amount for simplicity
        amountBMin: 0, // Accept any amount for simplicity
        to: XianWalletUtils.getAddress(), // Current user's address
        deadline: datetimeArg
      }
    );
    
    console.log('Add liquidity result:', result);
    return result;
  } catch (err) {
    console.error('Failed to add liquidity:', err);
    throw new Error(`Failed to add liquidity: ${err.message || 'Unknown error'}`);
  }
}

// Remove liquidity from a pool
async function removeLiquidity(params) {
  const { pairId, percentage } = params;
  
  try {
    // Get pair info
    const pair = availablePairs.find(p => p.id === pairId);
    if (!pair) {
      throw new Error(`Pair with ID ${pairId} not found`);
    }
    
    // Get token contracts directly from the pair
    const token0 = pair.token0;
    const token1 = pair.token1;
    
    // Get the DEX contract
    const dexContract = 'con_dex_v2';
    
    // Get LP token balance from the pair
    const lpBalance = await getLiq("con_pairs", parseInt(pairId), XianWalletUtils.getAddress());
    
    // Calculate amount to remove based on percentage
    const percentageValue = parseFloat(percentage) / 100;
    const liquidityToRemove = Math.floor(parseFloat(lpBalance) * percentageValue).toString();
    
    // Deadline – 5 minutes from now
    const now = new Date();
    const deadline = new Date(now.getTime() + 5 * 60 * 1000);
    const datetimeArg = {
      '__time__': [
        deadline.getUTCFullYear(),
        deadline.getUTCMonth() + 1,
        deadline.getUTCDate(),
        deadline.getUTCHours(),
        deadline.getUTCMinutes()
      ]
    };
    
    // The smart contract sorts tokens: if(tokenB < tokenA): tokenA, tokenB = tokenB, tokenA
    // We need to use the same order as in addLiquidity
    let tokenA, tokenB;
    if (token1 < token0) {
      tokenA = token1;
      tokenB = token0;
    } else {
      tokenA = token0;
      tokenB = token1;
    }
    
    // First approve
    await XianWalletUtils.sendTransaction(
      'con_pairs',
      'liqApprove',
      { to: dexContract, amount: liquidityToRemove, pair: parseInt(pairId) }
    );
    
    // Call the removeLiquidity method on the DEX contract
    const result = await XianWalletUtils.sendTransaction(
      dexContract,
      'removeLiquidity',
      {
        tokenA: tokenA,
        tokenB: tokenB,
        liquidity: liquidityToRemove,
        amountAMin: 0, // Accept any amount for simplicity
        amountBMin: 0, // Accept any amount for simplicity
        to: XianWalletUtils.getAddress(), // Current user's address
        deadline: datetimeArg
      }
    );
    
    console.log('Remove liquidity result:', result);
    return result;
  } catch (err) {
    console.error('Failed to remove liquidity:', err);
    throw new Error(`Failed to remove liquidity: ${err.message || 'Unknown error'}`);
  }
}

// Add LP tokens to a farm
async function addToFarm(params) {
  const { farmId, amount } = params;
  
  try {
    // The farmId is already the contract name from our farms.txt
    const farmContract = farmId;
    
    // Get farm info to determine LP token
    const farm = availableFarms.find(f => f.id === farmId);
    if (!farm) {
      throw new Error(`Farm with ID ${farmId} not found`);
    }
    
    // Get the pair ID from the farm
    const pairId = farm.pairIdx;
    
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get balance of LP token for this pair
      const balance = await getLiq("con_pairs", parseInt(pairId), XianWalletUtils.getAddress());
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // First approve the farm to use our LP tokens
    await XianWalletUtils.sendTransaction(
      "con_pairs",
      'liqApprove',
      {
        pair: parseInt(pairId),
        amount: actualAmount,
        to: farmContract
      }
    );
    
    // Call the deposit method on the farm contract (from farms.js)
    const result = await XianWalletUtils.sendTransaction(
      farmContract,
      'deposit',
      {
        amount: actualAmount
      }
    );
    
    console.log('Add to farm result:', result);
    return result;
  } catch (err) {
    console.error('Failed to add to farm:', err);
    throw new Error(`Failed to add to farm: ${err.message || 'Unknown error'}`);
  }
}

// Remove LP tokens from a farm
async function removeFromFarm(params) {
  const { farmId, amount } = params;
  
  try {
    // The farmId is already the contract name from our farms.txt
    const farmContract = farmId;
    
    // Get farm info to determine LP token
    const farm = availableFarms.find(f => f.id === farmId);
    if (!farm) {
      throw new Error(`Farm with ID ${farmId} not found`);
    }
    
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get staked balance in the farm
      const stakedBalance = await XianWalletUtils.sendTransaction(
        farmContract,
        'getUserStaked',
        {
          address: XianWalletUtils.getAddress()
        }
      );
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(stakedBalance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // Call the withdraw method on the farm contract
    const result = await XianWalletUtils.sendTransaction(
      farmContract,
      'withdraw',
      {
        amount: actualAmount
      }
    );
    
    console.log('Remove from farm result:', result);
    return result;
  } catch (err) {
    console.error('Failed to remove from farm:', err);
    throw new Error(`Failed to remove from farm: ${err.message || 'Unknown error'}`);
  }
}

// Stake tokens in a staking contract
async function stakeTokens(params) {
  const { stakingContract, amount } = params;
  
  try {
    // Get token info
    const token = availableTokens.find(t => t.id === stakingContract);
    if (!token) {
      throw new Error(`Token with ID ${stakingContract} not found`);
    }
    
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get balance of token
      const balance = await XianWalletUtils.getBalance(token.id);
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(balance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // First approve the staking contract to use our tokens
    await XianWalletUtils.sendTransaction(
      token.id,
      'approve',
      {
        amount: actualAmount,
        to: 'con_staking'
      }
    );
    
    // Call the stake method on the staking contract
    const result = await XianWalletUtils.sendTransaction(
      'con_staking',
      'stake',
      {
        token: token.id,
        amount: actualAmount
      }
    );
    
    console.log('Stake tokens result:', result);
    return result;
  } catch (err) {
    console.error('Failed to stake tokens:', err);
    throw new Error(`Failed to stake tokens: ${err.message || 'Unknown error'}`);
  }
}

// Unstake tokens from a staking contract
async function unstakeTokens(params) {
  const { stakingContract, amount } = params;
  
  try {
    // Get token info
    const token = availableTokens.find(t => t.id === stakingContract);
    if (!token) {
      throw new Error(`Token with ID ${stakingContract} not found`);
    }
    
    // Determine if amount is a percentage
    let actualAmount;
    if (amount.endsWith('%')) {
      // Get percentage value
      const percentage = parseFloat(amount) / 100;
      
      // Get staked balance
      const stakedBalance = await XianWalletUtils.sendTransaction(
        'con_staking',
        'getUserStaked',
        {
          token: token.id,
          address: XianWalletUtils.getAddress()
        }
      );
      
      // Calculate amount based on percentage
      actualAmount = Math.floor(parseFloat(stakedBalance) * percentage).toString();
    } else {
      actualAmount = amount;
    }
    
    // Call the unstake method on the staking contract
    const result = await XianWalletUtils.sendTransaction(
      'con_staking',
      'unstake',
      {
        token: token.id,
        amount: actualAmount
      }
    );
    
    console.log('Unstake tokens result:', result);
    return result;
  } catch (err) {
    console.error('Failed to unstake tokens:', err);
    throw new Error(`Failed to unstake tokens: ${err.message || 'Unknown error'}`);
  }
}

// Claim rewards from a staking contract
async function claimStakingRewards(params) {
  const { stakingContract } = params;
  
  try {
    // Get token info
    const token = availableTokens.find(t => t.id === stakingContract);
    if (!token) {
      throw new Error(`Token with ID ${stakingContract} not found`);
    }
    
    // Call the claimRewards method on the staking contract
    const result = await XianWalletUtils.sendTransaction(
      'con_staking',
      'claimRewards',
      {
        token: token.id
      }
    );
    
    console.log('Claim staking rewards result:', result);
    return result;
  } catch (err) {
    console.error('Failed to claim staking rewards:', err);
    throw new Error(`Failed to claim staking rewards: ${err.message || 'Unknown error'}`);
  }
}

// Show a toast notification
function showToast(message, type = 'info') {
  // Create toast element if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = 'px-4 py-2 rounded-md text-sm font-medium shadow-lg transform transition-all duration-300 translate-y-2 opacity-0';
  
  // Set color based on type
  if (type === 'success') {
    toast.classList.add('bg-green-500', 'text-white');
  } else if (type === 'error') {
    toast.classList.add('bg-red-500', 'text-white');
  } else if (type === 'warning') {
    toast.classList.add('bg-yellow-500', 'text-white');
  } else {
    toast.classList.add('bg-brand-cyan', 'text-black');
  }
  
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Check if the current hash is #macros
function isMacrosHashLocal() {
  return location.hash === '#macros';
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (isMacrosHashLocal()) {
    initMacroSystem();
  }
});

// Initialize when the hash changes to #macros
window.addEventListener('hashchange', () => {
  if (isMacrosHashLocal()) {
    initMacroSystem();
  }
});

// Reload options when wallet connects
document.addEventListener('walletConnected', () => {
  if (isMacrosHashLocal()) {
    loadAvailableOptions();
    showToast('Connected to wallet. Token data updated.', 'success');
  }
});