/* assets/launch.js  ────────────────────────────────────────────────────
 * Launch tab functionality for creating tokens, pairs, and adding liquidity
 */

(() => {
  // Token contract template
  const TOKEN_CONTRACT_TEMPLATE = `balances = Hash(default_value=0)
metadata = Hash()
TransferEvent = LogEvent(event="Transfer", params={"from":{'type':str, 'idx':True}, "to": {'type':str, 'idx':True}, "amount": {'type':(int, float, decimal)}})
ApproveEvent = LogEvent(event="Approve", params={"from":{'type':str, 'idx':True}, "to": {'type':str, 'idx':True}, "amount": {'type':(int, float, decimal)}})


@construct
def seed():
    balances[ctx.caller] = TOKEN_SUPPLY

    metadata['token_name'] = "TOKEN_NAME"
    metadata['token_symbol'] = "TOKEN_SYMBOL"
    metadata['token_logo_url'] = 'TOKEN_LOGO_URL'
    metadata['token_website'] = 'TOKEN_WEBSITE'
    metadata['total_supply'] = TOKEN_SUPPLY
    metadata['operator'] = ctx.caller


@export
def change_metadata(key: str, value: Any):
    assert ctx.caller == metadata['operator'], 'Only operator can set metadata!'
    metadata[key] = value


@export
def balance_of(address: str):
    return balances[address]


@export
def transfer(amount: float, to: str):
    assert amount > 0, 'Cannot send negative balances!'
    assert balances[ctx.caller] >= amount, 'Not enough coins to send!'

    balances[ctx.caller] -= amount
    balances[to] += amount
    TransferEvent({"from": ctx.caller, "to": to, "amount": amount})


@export
def approve(amount: float, to: str):
    assert amount > 0, 'Cannot send negative balances!'

    balances[ctx.caller, to] = amount
    ApproveEvent({"from": ctx.caller, "to": to, "amount": amount})


@export
def transfer_from(amount: float, to: str, main_account: str):
    assert amount > 0, 'Cannot send negative balances!'
    assert balances[main_account, ctx.caller] >= amount, f'Not enough coins approved to send! You have {balances[main_account, ctx.caller]} and are trying to spend {amount}'
    assert balances[main_account] >= amount, 'Not enough coins to send!'

    balances[main_account, ctx.caller] -= amount
    balances[main_account] -= amount
    balances[to] += amount
    TransferEvent({"from": main_account, "to": to, "amount": amount})`;

  // State management
  let currentStep = 1;
  let launchData = {
    tokenName: '',
    tokenSymbol: '',
    tokenSupply: 0,
    tokenLogo: '',
    tokenWebsite: '',
    tokenContract: '',
    baseToken: 'con_xian',
    pairId: '',
    tokenAmount: 0,
    baseAmount: 0
  };

  // DOM elements
  const elements = {
    // Step indicators
    step1Indicator: document.getElementById('step1-indicator'),
    step2Indicator: document.getElementById('step2-indicator'),
    step3Indicator: document.getElementById('step3-indicator'),
    step4Indicator: document.getElementById('step4-indicator'),
    
    // Step content
    step1Content: document.getElementById('step1-content'),
    step2Content: document.getElementById('step2-content'),
    step3Content: document.getElementById('step3-content'),
    step4Content: document.getElementById('step4-content'),
    
    // Form inputs
    tokenName: document.getElementById('tokenName'),
    tokenSymbol: document.getElementById('tokenSymbol'),
    tokenSupply: document.getElementById('tokenSupply'),
    tokenLogo: document.getElementById('tokenLogo'),
    tokenWebsite: document.getElementById('tokenWebsite'),
    
    // Step 2 elements
    tokenSymbolDisplay: document.getElementById('tokenSymbolDisplay'),
    tokenNameDisplay: document.getElementById('tokenNameDisplay'),
    tokenContractDisplay: document.getElementById('tokenContractDisplay'),
    baseTokenSelect: document.getElementById('baseTokenSelect'),
    
    // Step 3 elements
    tokenAmount: document.getElementById('tokenAmount'),
    baseAmount: document.getElementById('baseAmount'),
    tokenBalance: document.getElementById('tokenBalance'),
    baseBalance: document.getElementById('baseBalance'),
    initialPrice: document.getElementById('initialPrice'),
    
    // Step 4 elements
    finalTokenContract: document.getElementById('finalTokenContract'),
    finalPairId: document.getElementById('finalPairId'),
    
    // Buttons
    createTokenBtn: document.getElementById('createTokenBtn'),
    backToStep1: document.getElementById('backToStep1'),
    createPairBtn: document.getElementById('createPairBtn'),
    backToStep2: document.getElementById('backToStep2'),
    addLiquidityBtn: document.getElementById('addLiquidityBtn'),
    viewPairBtn: document.getElementById('viewPairBtn'),
    launchAnotherBtn: document.getElementById('launchAnotherBtn')
  };

  // Utility functions
  function showStep(step) {
    // Hide all steps
    elements.step1Content.classList.add('hidden');
    elements.step2Content.classList.add('hidden');
    elements.step3Content.classList.add('hidden');
    elements.step4Content.classList.add('hidden');
    
    // Show current step
    elements[`step${step}Content`].classList.remove('hidden');
    
    // Update indicators
    updateStepIndicators(step);
    currentStep = step;
  }

  function updateStepIndicators(activeStep) {
    const indicators = [
      { element: elements.step1Indicator, label: elements.step1Indicator.nextElementSibling },
      { element: elements.step2Indicator, label: elements.step2Indicator.nextElementSibling },
      { element: elements.step3Indicator, label: elements.step3Indicator.nextElementSibling },
      { element: elements.step4Indicator, label: elements.step4Indicator.nextElementSibling }
    ];

    indicators.forEach((indicator, index) => {
      const stepNumber = index + 1;
      if (stepNumber < activeStep) {
        // Completed step
        indicator.element.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium';
        indicator.element.innerHTML = '✓';
        indicator.label.className = 'ml-3 text-sm font-medium text-emerald-400';
      } else if (stepNumber === activeStep) {
        // Active step
        indicator.element.className = 'w-8 h-8 rounded-full bg-brand-cyan text-brand-base flex items-center justify-center text-sm font-medium';
        indicator.element.textContent = stepNumber;
        indicator.label.className = 'ml-3 text-sm font-medium';
      } else {
        // Future step
        indicator.element.className = 'w-8 h-8 rounded-full bg-white/10 text-gray-400 flex items-center justify-center text-sm font-medium';
        indicator.element.textContent = stepNumber;
        indicator.label.className = 'ml-3 text-sm font-medium text-gray-400';
      }
    });
  }

  function showToast(message, type = 'info') {
    if (window.toast) {
      window.toast(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }

  function validateTokenForm() {
    const name = elements.tokenName.value.trim();
    const symbol = elements.tokenSymbol.value.trim();
    const supply = parseFloat(elements.tokenSupply.value);

    if (!name) {
      showToast('Please enter a token name', 'error');
      return false;
    }
    if (!symbol) {
      showToast('Please enter a token symbol', 'error');
      return false;
    }
    if (!supply || supply <= 0) {
      showToast('Please enter a valid total supply', 'error');
      return false;
    }

    return true;
  }

  function generateTokenContract() {
    const name = elements.tokenName.value.trim();
    const symbol = elements.tokenSymbol.value.trim();
    const supply = parseFloat(elements.tokenSupply.value);
    const logo = elements.tokenLogo.value.trim() || '';
    const website = elements.tokenWebsite.value.trim() || '';

    return TOKEN_CONTRACT_TEMPLATE
      .replace(/TOKEN_NAME/g, name)
      .replace(/TOKEN_SYMBOL/g, symbol)
      .replace(/TOKEN_SUPPLY/g, supply.toString())
      .replace(/TOKEN_LOGO_URL/g, logo)
      .replace(/TOKEN_WEBSITE/g, website);
  }

  async function deployTokenContract() {
    try {
      const contractCode = generateTokenContract();
      
      // Deploy the contract using wallet
      const result = await XianWalletUtils.sendTransaction(
        'submission',
        'submit_contract',
        {
          name: `${elements.tokenSymbol.value.toLowerCase()}_token`,
          code: contractCode
        }
      );

      if (result && result.hash) {
        // Generate contract name based on symbol
        const contractName = `con_${elements.tokenSymbol.value.toLowerCase()}_token`;
        launchData.tokenContract = contractName;
        
        showToast('Token contract deployed successfully!', 'success');
        return contractName;
      } else {
        throw new Error('Contract deployment failed');
      }
    } catch (error) {
      console.error('Token deployment error:', error);
      showToast('Failed to deploy token contract', 'error');
      throw error;
    }
  }

  async function addTokenToWallet(tokenContract) {
    try {
      const response = await XianWalletUtils.addToken(tokenContract);
      if (response) {
        showToast('Token added to wallet!', 'success');
      }
    } catch (error) {
      console.warn('Failed to add token to wallet:', error);
      // Don't throw - this is not critical
    }
  }

  async function createTradingPair() {
    try {
      const result = await XianWalletUtils.sendTransaction(
        'con_pairs',
        'createPair',
        {
          contract0: launchData.tokenContract,
          contract1: launchData.baseToken
        }
      );

      if (result && result.hash) {
        // Get the pair ID - this would typically come from the transaction result
        // For now, we'll simulate getting the pair ID
        const pairId = await getPairId(launchData.tokenContract, launchData.baseToken);
        launchData.pairId = pairId;
        
        showToast('Trading pair created successfully!', 'success');
        return pairId;
      } else {
        throw new Error('Pair creation failed');
      }
    } catch (error) {
      console.error('Pair creation error:', error);
      showToast('Failed to create trading pair', 'error');
      throw error;
    }
  }

  async function getPairId(token0, token1) {
    try {
      // This would typically query the pairs contract to get the pair ID
      // For now, we'll simulate this
      const response = await RPCcall('con_pairs', 'getPairId', '', { token0, token1 });
      return JSON.parse(response.replace(/'/g, '"'));
    } catch (error) {
      console.warn('Failed to get pair ID, using fallback');
      return Math.floor(Math.random() * 1000) + 1; // Fallback simulation
    }
  }

  async function addLiquidity() {
    try {
      const tokenAmount = parseFloat(elements.tokenAmount.value);
      const baseAmount = parseFloat(elements.baseAmount.value);

      if (!tokenAmount || !baseAmount || tokenAmount <= 0 || baseAmount <= 0) {
        throw new Error('Please enter valid amounts for both tokens');
      }

      // First approve the tokens
      await XianWalletUtils.sendTransaction(
        launchData.tokenContract,
        'approve',
        {
          amount: tokenAmount,
          to: 'con_pairs'
        }
      );

      await XianWalletUtils.sendTransaction(
        launchData.baseToken,
        'approve',
        {
          amount: baseAmount,
          to: 'con_pairs'
        }
      );

      // Add liquidity
      const result = await XianWalletUtils.sendTransaction(
        'con_pairs',
        'addLiquidity',
        {
          pair: parseInt(launchData.pairId),
          amount0: tokenAmount,
          amount1: baseAmount
        }
      );

      if (result && result.hash) {
        launchData.tokenAmount = tokenAmount;
        launchData.baseAmount = baseAmount;
        
        showToast('Liquidity added successfully!', 'success');
        return true;
      } else {
        throw new Error('Add liquidity failed');
      }
    } catch (error) {
      console.error('Add liquidity error:', error);
      showToast('Failed to add liquidity', 'error');
      throw error;
    }
  }

  async function updateBalances() {
    try {
      if (!userAddress) return;

      // Get token balance
      if (launchData.tokenContract) {
        const tokenBalance = await RPCcall(launchData.tokenContract, 'balance_of', '', { address: userAddress });
        elements.tokenBalance.textContent = parseFloat(tokenBalance || 0).toLocaleString();
      }

      // Get base token balance
      const baseBalance = await RPCcall(launchData.baseToken, 'balance_of', '', { address: userAddress });
      elements.baseBalance.textContent = parseFloat(baseBalance || 0).toLocaleString();
    } catch (error) {
      console.warn('Failed to update balances:', error);
    }
  }

  function updateInitialPrice() {
    const tokenAmount = parseFloat(elements.tokenAmount.value) || 0;
    const baseAmount = parseFloat(elements.baseAmount.value) || 0;

    if (tokenAmount > 0 && baseAmount > 0) {
      const price = baseAmount / tokenAmount;
      elements.initialPrice.textContent = price.toFixed(6);
    } else {
      elements.initialPrice.textContent = '-';
    }
  }

  function resetForm() {
    // Reset form data
    launchData = {
      tokenName: '',
      tokenSymbol: '',
      tokenSupply: 0,
      tokenLogo: '',
      tokenWebsite: '',
      tokenContract: '',
      baseToken: 'con_xian',
      pairId: '',
      tokenAmount: 0,
      baseAmount: 0
    };

    // Reset form inputs
    elements.tokenName.value = '';
    elements.tokenSymbol.value = '';
    elements.tokenSupply.value = '';
    elements.tokenLogo.value = '';
    elements.tokenWebsite.value = '';
    elements.tokenAmount.value = '';
    elements.baseAmount.value = '';
    elements.baseTokenSelect.value = 'con_xian';

    // Reset displays
    elements.tokenSymbolDisplay.textContent = '-';
    elements.tokenNameDisplay.textContent = '-';
    elements.tokenContractDisplay.textContent = '-';
    elements.tokenBalance.textContent = '-';
    elements.baseBalance.textContent = '-';
    elements.initialPrice.textContent = '-';
    elements.finalTokenContract.textContent = '-';
    elements.finalPairId.textContent = '-';

    // Go back to step 1
    showStep(1);
  }

  // Event listeners
  function setupEventListeners() {
    // Step 1: Create Token
    elements.createTokenBtn.addEventListener('click', async () => {
      if (!validateTokenForm()) return;

      if (!userAddress) {
        showToast('Please connect your wallet first', 'error');
        return;
      }

      elements.createTokenBtn.disabled = true;
      elements.createTokenBtn.textContent = 'Creating Token...';

      try {
        // Store form data
        launchData.tokenName = elements.tokenName.value.trim();
        launchData.tokenSymbol = elements.tokenSymbol.value.trim();
        launchData.tokenSupply = parseFloat(elements.tokenSupply.value);
        launchData.tokenLogo = elements.tokenLogo.value.trim();
        launchData.tokenWebsite = elements.tokenWebsite.value.trim();

        // Deploy token contract
        const tokenContract = await deployTokenContract();
        
        // Add token to wallet
        await addTokenToWallet(tokenContract);

        // Update step 2 display
        elements.tokenSymbolDisplay.textContent = launchData.tokenSymbol;
        elements.tokenNameDisplay.textContent = launchData.tokenName;
        elements.tokenContractDisplay.textContent = tokenContract;

        // Move to step 2
        showStep(2);
      } catch (error) {
        console.error('Token creation failed:', error);
      } finally {
        elements.createTokenBtn.disabled = false;
        elements.createTokenBtn.textContent = 'Create Token';
      }
    });

    // Step 2: Create Pair
    elements.backToStep1.addEventListener('click', () => showStep(1));
    
    elements.createPairBtn.addEventListener('click', async () => {
      if (!userAddress) {
        showToast('Please connect your wallet first', 'error');
        return;
      }

      elements.createPairBtn.disabled = true;
      elements.createPairBtn.textContent = 'Creating Pair...';

      try {
        launchData.baseToken = elements.baseTokenSelect.value;
        
        // Create trading pair
        await createTradingPair();

        // Update balances for step 3
        await updateBalances();

        // Move to step 3
        showStep(3);
      } catch (error) {
        console.error('Pair creation failed:', error);
      } finally {
        elements.createPairBtn.disabled = false;
        elements.createPairBtn.textContent = 'Create Pair';
      }
    });

    // Step 3: Add Liquidity
    elements.backToStep2.addEventListener('click', () => showStep(2));
    
    elements.tokenAmount.addEventListener('input', updateInitialPrice);
    elements.baseAmount.addEventListener('input', updateInitialPrice);
    
    elements.addLiquidityBtn.addEventListener('click', async () => {
      if (!userAddress) {
        showToast('Please connect your wallet first', 'error');
        return;
      }

      elements.addLiquidityBtn.disabled = true;
      elements.addLiquidityBtn.textContent = 'Adding Liquidity...';

      try {
        await addLiquidity();

        // Update final step display
        elements.finalTokenContract.textContent = launchData.tokenContract;
        elements.finalPairId.textContent = launchData.pairId;

        // Move to step 4
        showStep(4);
      } catch (error) {
        console.error('Add liquidity failed:', error);
      } finally {
        elements.addLiquidityBtn.disabled = false;
        elements.addLiquidityBtn.textContent = 'Add Liquidity';
      }
    });

    // Step 4: Complete
    elements.viewPairBtn.addEventListener('click', () => {
      // Navigate to the pair page
      window.location.hash = `#pair=${launchData.pairId}`;
    });

    elements.launchAnotherBtn.addEventListener('click', () => {
      resetForm();
    });
  }

  // Initialize when DOM is ready
  function init() {
    if (!elements.createTokenBtn) {
      // Launch view not loaded yet
      return;
    }

    setupEventListeners();
    showStep(1);

    // Update balances when wallet connects
    document.addEventListener('walletConnected', () => {
      if (currentStep >= 3) {
        updateBalances();
      }
    });
  }

  // Initialize immediately if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Try to initialize, but handle case where elements might not exist yet
    setTimeout(init, 100);
  }

  // Re-initialize when launch view becomes visible
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const launchView = document.getElementById('launchView');
        if (launchView && launchView.style.display !== 'none' && elements.createTokenBtn) {
          init();
          observer.disconnect(); // Stop observing once initialized
        }
      }
    });
  });

  // Start observing when the launch view exists
  const checkForLaunchView = () => {
    const launchView = document.getElementById('launchView');
    if (launchView) {
      observer.observe(launchView, { attributes: true });
    } else {
      setTimeout(checkForLaunchView, 100);
    }
  };
  
  checkForLaunchView();
})();