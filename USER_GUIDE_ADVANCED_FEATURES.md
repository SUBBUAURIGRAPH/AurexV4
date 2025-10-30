# HMS Advanced Backtesting Features - User Guide

**Version:** 1.0.0
**Audience:** Traders, Strategists, Quantitative Analysts
**Last Updated:** 2024

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Multi-Asset Backtesting](#multi-asset-backtesting)
3. [Walk-Forward Optimization](#walk-forward-optimization)
4. [Monte Carlo Simulation](#monte-carlo-simulation)
5. [Common Workflows](#common-workflows)
6. [Best Practices](#best-practices)
7. [Tips & Tricks](#tips--tricks)
8. [FAQs](#faqs)

---

## Getting Started

### What Are These Advanced Features?

HMS now includes three powerful tools for strategy development and validation:

1. **Multi-Asset Backtesting** - Test your portfolio across multiple stocks simultaneously
2. **Walk-Forward Optimization** - Optimize parameters while preventing overfitting
3. **Monte Carlo Simulation** - Assess risk and probability of trading outcomes

### Quick Start

1. Log in to HMS Dashboard
2. Navigate to **Backtesting** → **Advanced Features**
3. Choose your tool:
   - Portfolio testing? → Multi-Asset Backtesting
   - Optimizing parameters? → Walk-Forward Optimization
   - Assessing risk? → Monte Carlo Simulation

---

## Multi-Asset Backtesting

### What Is It?

Test a complete portfolio strategy across multiple stocks, complete with:
- Automatic rebalancing
- Correlation analysis between assets
- Portfolio-level metrics (Sharpe ratio, drawdown, etc.)
- Individual asset performance tracking

### When to Use It

✅ **Use Multi-Asset Backtesting when:**
- Testing a diversified portfolio strategy
- Validating asset allocation models
- Analyzing correlation patterns
- Testing rebalancing strategies
- Comparing sector rotation approaches

❌ **Don't use it for:**
- Single-stock strategies (use Single-Stock Backtesting)
- High-frequency trading (limited to daily bars)
- Options strategies (equity-only)

### Step-by-Step Guide

#### Step 1: Choose Your Symbols

Select 2-10 stocks representing your portfolio:

```
Recommended Starting Portfolio:
- Tech: AAPL, MSFT, GOOGL
- Finance: JPM, BAC, GS
- Healthcare: JNJ, UNH, PFE
- Energy: XOM, CVX, COP
```

**Pro Tip:** Start with correlated assets to understand correlation impact.

#### Step 2: Set Allocation

Allocate percentages that sum to 100%:

```
Tech Portfolio Example:
AAPL:  30% (Large cap, stable)
MSFT:  25% (Software, growth)
GOOGL: 25% (Advertising, growth)
NVDA:  20% (Semiconductors, volatile)
Total: 100%
```

**Allocation Tips:**
- Larger positions = more impact on portfolio
- Balance growth stocks with stable ones
- Consider sector diversification
- Start with equal-weight, adjust based on conviction

#### Step 3: Configure Dates

- **Start Date**: When to begin backtest (min 1 year of history)
- **End Date**: When to end backtest (today or past date)

**Recommendations:**
- Minimum 2 years of data for meaningful analysis
- Include different market conditions (bull, bear)
- Avoid backtesting beyond recent history

#### Step 4: Set Initial Capital

- **Default**: $100,000
- **Adjust Based On**: Your actual trading capital

**Why it matters:**
- Larger capital = different execution prices (slippage)
- Affects commission impact (smaller relative effect on larger capital)
- Makes results more realistic to your situation

#### Step 5: Configure Rebalancing (Optional)

Choose how often to rebalance back to target allocation:

```
Rebalancing Options:
- Monthly:   Most flexible, captures trends
- Quarterly: Balance transaction costs with drift
- Yearly:    Minimal trading, most drift allowed
- None:      Static allocation, diverges over time
```

**What Rebalancing Does:**
- Maintains target allocation percentage
- Forces "buy low, sell high" (systematic)
- Generates transaction costs
- Affects tax efficiency

**Example:**
- Start: 50% AAPL, 50% MSFT
- After 3 months: AAPL up 20%, MSFT down 10%
- Now: 54% AAPL, 46% MSFT (drifted)
- Rebalancing: Sell some AAPL, buy MSFT → Back to 50/50

#### Step 6: Review Results

After backtest completes, you'll see:

**Portfolio Metrics:**
- **Total Return**: Overall profit/loss percentage
- **Sharpe Ratio**: Risk-adjusted returns (higher = better)
- **Max Drawdown**: Worst peak-to-trough decline
- **Volatility**: Portfolio fluctuation (annualized)

**Individual Asset Performance:**
- Each stock's contribution to returns
- Correlation between assets
- Individual volatility

**Example Results:**

```
Portfolio Results:
Initial Capital:    $100,000
Final Value:        $125,500
Total Return:       25.5%
Annualized Return:  12.1%

Risk Metrics:
Sharpe Ratio:       0.85 (good)
Sortino Ratio:      1.25 (very good)
Max Drawdown:       -18.5%
Volatility:         14.2% (annualized)

Best/Worst Months:
Best Month:         +8.5% (Jan 2024)
Worst Month:        -5.2% (Oct 2023)

Correlations (2023):
AAPL-MSFT:  0.82 (high correlation)
AAPL-GOOGL: 0.75 (moderate-high)
MSFT-GOOGL: 0.88 (very high)
```

### Interpreting the Results

**Sharpe Ratio Guide:**
- < 0.5: Poor risk-adjusted returns
- 0.5 - 1.0: Acceptable
- 1.0 - 2.0: Good
- > 2.0: Excellent

**Max Drawdown Guide:**
- < -10%: Acceptable
- -10% to -20%: Normal for equity portfolios
- -20% to -40%: High volatility
- > -40%: Extreme risk

**Volatility Guide:**
- < 10%: Low volatility (bonds-like)
- 10% - 20%: Moderate (typical stocks)
- 20% - 30%: High (tech, growth stocks)
- > 30%: Very high (micro-cap, penny stocks)

---

## Walk-Forward Optimization

### What Is It?

Optimize trading strategy parameters **without overfitting**. Instead of optimizing on all data (which leads to overfitting), this method:

1. **Splits data** into overlapping windows
2. **Optimizes parameters** on in-sample data
3. **Tests parameters** on out-of-sample data
4. **Detects overfitting** by comparing IS vs OOS performance

### Why It Matters

⚠️ **The Overfitting Problem:**

Regular optimization on all data = parameters work perfectly on that data but fail on new data.

Walk-forward optimization = tests if parameters work on data they haven't seen before.

### When to Use It

✅ **Use Walk-Forward when:**
- Developing a new trading strategy
- Optimizing indicator parameters
- Testing different trade entry/exit rules
- Validating if parameters are robust

❌ **Don't use when:**
- You already have fixed parameters
- Testing a strategy not based on parameters
- You need results in < 5 minutes

### Step-by-Step Guide

#### Step 1: Choose Symbol and Dates

```
Example Setup:
Symbol: AAPL
Date Range: 2023-01-01 to 2024-12-31 (2 years)
```

#### Step 2: Set Window Sizes

```
In-Sample Period:  90 days (3 months)
  - Used for optimization
  - Longer = more robust parameters

Out-of-Sample:     30 days (1 month)
  - Used for validation
  - Typically 1/3 of in-sample

Step Size:         30 days (1 month)
  - How much to advance window
  - Overlapping windows = rolling optimization
```

**Window Configuration Example:**

```
Timeline: 2 Years (730 days)

Window 1:
  In-Sample:    Jan-Mar 2023 (90 days)
  Out-Sample:   Apr 2023 (30 days)

Window 2 (step 30 days):
  In-Sample:    Feb-Apr 2023 (90 days)
  Out-Sample:   May 2023 (30 days)

Window 3:
  In-Sample:    Mar-May 2023 (90 days)
  Out-Sample:   Jun 2023 (30 days)

... continues until end of data
```

#### Step 3: Define Parameter Grid

Specify which parameters to optimize and their ranges:

```
Example 1: Moving Average Crossover
Parameters:
  fastPeriod:    [10, 20, 30]       (3 options)
  slowPeriod:    [50, 100, 150]     (3 options)
  threshold:     [0.001, 0.002]     (2 options)

Total combinations: 3 × 3 × 2 = 18 per window

Example 2: Momentum Strategy
Parameters:
  period:        [10, 14, 20, 30]   (4 options)
  threshold:     [0.05, 0.10, 0.15] (3 options)

Total combinations: 4 × 3 = 12 per window
```

**Parameter Selection Tips:**
- Start with 2-3 parameters
- Limit each parameter to 3-5 values
- Too many combinations = very long optimization
- Focus on parameters you understand

#### Step 4: Choose Optimization Metric

Select what to optimize for:

```
Options:
- sharpeRatio    (Risk-adjusted returns) - RECOMMENDED
- totalReturn    (Pure profit)
- winRate        (% profitable trades)
- profitFactor   (Wins vs Losses)
- maxDrawdown    (Minimize loss)
```

**Metric Selection Guide:**
- **Sharpe Ratio**: Best all-around metric, balances return & risk
- **Total Return**: Simple but ignores risk
- **Win Rate**: Can be misleading (many small losses)
- **Profit Factor**: Good for mechanical systems

#### Step 5: Review Results

**Key Metrics to Check:**

```
Walk-Forward Results:
Total Windows:     8 (8 complete 3-month periods)

Out-of-Sample Performance:
Mean Return:       5.15%
Std Dev:           2.35%
Best Month:        9.8%
Worst Month:       1.2%

Overfitting Analysis:
Avg In-Sample:     8.24%
Avg Out-of-Sample: 5.15%
Degradation:       3.09% (good, < 5%)
Verdict:           NOT OVERFIT ✅

Parameter Stability:
fastPeriod:    Mean: 19.5, CV: 0.108 (stable ✅)
slowPeriod:    Mean: 99.2, CV: 0.086 (stable ✅)
threshold:     Mean: 0.0015, CV: 0.143 (stable ✅)

Recommended Parameters:
fastPeriod:    20
slowPeriod:    100
threshold:     0.0015
```

### Interpreting Results

**Degradation (IS return - OOS return):**
- **< 3%**: Good generalization, parameters are robust
- **3% - 5%**: Acceptable, some overfitting present
- **> 5%**: Significant overfitting, parameters may not hold
- **> 15%**: Severe overfitting, do NOT use in trading

**Coefficient of Variation (CV) - Parameter Stability:**
- **< 0.2**: Stable parameter, consistent across windows ✅
- **0.2 - 0.5**: Somewhat stable, acceptable variation
- **> 0.5**: Highly unstable, changes significantly ⚠️

**Example Analysis:**

```
Good Walk-Forward Results:
✅ Mean OOS return: 5.15%
✅ Degradation: 3.09% (< 5%)
✅ Parameter CV: < 0.15 for all params
✅ Verdict: READY FOR TRADING

Bad Walk-Forward Results:
❌ Mean OOS return: 2.1%
❌ Degradation: 8.5% (> 5%)
❌ Parameter CV: 0.45 for slowPeriod (unstable)
❌ Verdict: DO NOT USE - likely overfit
```

---

## Monte Carlo Simulation

### What Is It?

Run 1,000+ simulations of your strategy results to understand:
- Probability of profit
- Range of possible outcomes
- Worst-case scenarios
- Risk metrics (Value at Risk, etc.)

### When to Use It

✅ **Use Monte Carlo when:**
- Assessing risk before trading live
- Understanding probability of outcomes
- Calculating position sizing
- Stress-testing your strategy
- Creating trader confidence intervals

❌ **Don't use when:**
- You only need one backtest result
- You don't care about risk analysis

### Step-by-Step Guide

#### Step 1: Select a Completed Backtest

Choose any backtest to analyze:

```
Example:
Select: "Tech Stock Portfolio Backtest" (completed)
```

#### Step 2: Configure Simulation

```
Number of Simulations: 1000 (default, good balance)
  - 100: Quick, less accurate
  - 500: Fast, reasonable
  - 1000: RECOMMENDED
  - 5000: Slow but very accurate
  - 10000: Very slow, minimal accuracy improvement

Simulation Method:
  - "Returns-based": Use historical returns distribution
    (Default, faster, assumes normal distribution)
  - "Bootstrapping": Resample actual historical returns
    (More realistic, captures real distribution)

Confidence Level: 95% (standard)
  - 90%: Wider range, more confident
  - 95%: RECOMMENDED (standard)
  - 99%: Narrow range, less confident
```

#### Step 3: Interpret Results

**Key Statistics:**

```
Final Value Distribution (after 1 year):
Mean Final Value:      $125,500
Median Final Value:    $124,300
Min Value:             $85,200 (worst case)
Max Value:             $178,900 (best case)
Standard Deviation:    $18,500

Return Distribution:
Mean Return:           25.5%
95% Confidence Interval: -8.5% to +52.3%
  → 95% probability return is between -8.5% and +52.3%

Risk Metrics:
Probability of Profit: 78.5%
  → 78.5% of simulations ended profitable
Probability of Loss:   21.5%
  → 21.5% ended with loss
Prob of 50%+ Gain:     25.3%
  → 25.3% of simulations made > 50%

Maximum Drawdown:
Mean Drawdown:         -12.8%
95% CI for Drawdown:   -28.5% to -2.3%
Max Observed:          -45% (in worst simulation)
  → Worst case is -45% drawdown

Risk Metrics:
Value at Risk (VaR):   -8.5%
  → 95% chance loss won't exceed 8.5%
CVaR (Exp. Shortfall): -12.3%
  → If losses occur, expect average of -12.3%
```

### Risk Metrics Explained

**Value at Risk (VaR) 95%:**
- Worst expected loss with 95% confidence
- If VaR = -8.5%, 95% probability loss won't exceed 8.5%
- 5% of time, losses will be worse than -8.5%

**Conditional Value at Risk (CVaR):**
- Average loss when worst 5% scenarios occur
- More extreme than VaR
- Better reflects tail risk

**Probability of Profit:**
- Percentage of simulations that made money
- 80%+ = Reliable strategy
- < 50% = Risky strategy

### Decision Making from Results

```
Scenario 1: Aggressive Trader
Mean Return: 30%, Probability of Profit: 75%
→ YES, worth trading (good return, acceptable risk)

Scenario 2: Conservative Trader
Mean Return: 5%, Max Drawdown: -35%
→ NO, too risky for low return

Scenario 3: Most Likely
Mean Return: 15%, Prob of Profit: 70%, Max DD: -18%
→ YES, balanced risk/reward

Scenario 4: Tail Risk Alert
Mean Return: 12%, but 5% chance of -45% loss
→ Consider risk tolerance, position sizing
```

---

## Common Workflows

### Workflow 1: Develop & Validate New Strategy

```
1. Backtest single stock
2. Run multi-asset backtest with allocation
3. Run walk-forward optimization
   ↓ If overfitted (degradation > 5%): Adjust strategy
   ↓ If not overfit: Continue
4. Run Monte Carlo on best walk-forward result
5. If risk acceptable: Ready for paper trading
6. If risk high: Adjust parameters or capital
```

### Workflow 2: Compare Two Strategies

```
Strategy A: Moving Average Crossover
1. Multi-asset backtest → Returns: 18%, Sharpe: 0.72
2. Walk-forward → OOS Return: 12%, Degradation: 6%
3. Monte Carlo → Prob Profit: 65%, Max DD: -22%

Strategy B: Momentum Reversal
1. Multi-asset backtest → Returns: 22%, Sharpe: 0.91
2. Walk-forward → OOS Return: 16%, Degradation: 6%
3. Monte Carlo → Prob Profit: 72%, Max DD: -18%

Verdict: Strategy B is better (higher return, better risk)
```

### Workflow 3: Find Optimal Parameters

```
1. Create parameter grid:
   - Period: [10, 15, 20, 25, 30]
   - Threshold: [0.001, 0.002, 0.003]

2. Run walk-forward optimization

3. Check results:
   - Look for stable parameters (low CV)
   - Check degradation < 5%

4. Extract recommended parameters:
   - Period: 20 (consistent across windows)
   - Threshold: 0.002 (most stable)

5. Run live trading with these parameters
```

---

## Best Practices

### 1. Use Sufficient Historical Data

```
❌ Too Short (< 1 year):
- Can't validate through market cycles
- High chance of overfitting

✅ Good (2-3 years):
- Includes bull and bear markets
- Sufficient for walk-forward

✅✅ Better (5+ years):
- Multiple market regimes
- More robust validation
```

### 2. Realistic Settings

```
❌ Unrealistic:
- 0% commission
- 0% slippage
- Instant execution

✅ Realistic:
- 0.1% commission
- 0.05% slippage
- Daily bar closes only
```

### 3. Avoid Overfitting

```
❌ Red Flags:
- Walk-forward degradation > 10%
- Parameters change wildly between windows
- Single asset over 1-year period
- Too many parameters (> 5)

✅ Good Signs:
- Degradation < 5%
- Stable parameters across windows
- Multiple assets included
- 2-3 key parameters only
```

### 4. Sanity Checks

Ask yourself:

```
❌ Walk returns seem too good?
   - Check: Slippage, commission, spreads

❌ Max drawdown is 0%?
   - Check: Did strategy always make money? (unlikely)

❌ Parameters keep changing?
   - Check: Market regime change? Or overfitting?

✅ Results are consistent?
   - Good sign of robust strategy
```

### 5. Position Sizing from Monte Carlo

```
VaR 95% = -8.5% (max expected loss)

Your account: $50,000
Risk per trade: 2% ($1,000)

From VaR: Max portfolio loss in bad scenario: $4,250
Position size: $50,000 × (2% / 8.5%) = $11,765

This ensures you can withstand worst-case from simulation
```

---

## Tips & Tricks

### Tip 1: Quick Parameter Testing

Instead of full walk-forward:
1. Split data: 70% in-sample, 30% out-of-sample
2. Optimize on 70%
3. Test on 30%
4. Compare IS vs OOS return
5. If close: likely robust

### Tip 2: Use Correlation Analysis

From multi-asset results, check correlations:

```
If all assets highly correlated (> 0.85):
→ Portfolio is not diversified
→ Adjust allocation to less correlated assets

If correlations are low (< 0.5):
→ Good diversification
→ Can recover faster from drawdowns
```

### Tip 3: Understand Sharpe Ratio Better

```
Sharpe Ratio = (Return - Risk-Free Rate) / Volatility

High Sharpe (> 1.0) means:
- Getting good returns per unit of risk
- Strategy is efficient

Low Sharpe (< 0.5) means:
- Returns don't justify the volatility
- Consider safer strategy
```

### Tip 4: Combine Metrics

Don't rely on one metric:

```
Good Strategy Has:
✅ Positive mean return
✅ Sharpe ratio > 0.7
✅ Max drawdown < -25%
✅ Win rate > 50%
✅ Profit factor > 1.2
✅ Low walk-forward degradation
```

### Tip 5: Paper Trading First

Before live trading:

1. Run backtest (in sample)
2. Run walk-forward (out of sample)
3. Run Monte Carlo (risk assessment)
4. Run paper trading for 1-2 months
5. Compare paper to backtest results
6. If aligned: Start live trading

---

## FAQs

### Q: What's the difference between walk-forward and Monte Carlo?

**Walk-Forward:**
- Tests if parameters work on unseen data
- Detects overfitting
- Shows degradation from IS to OOS
- Answers: "Will my parameters work on new data?"

**Monte Carlo:**
- Simulates many possible outcomes
- Shows range of results
- Calculates risk metrics
- Answers: "What's my risk? What's probability of profit?"

**Use Both:** Walk-forward for parameter validation, Monte Carlo for risk assessment.

### Q: How many simulations do I need?

```
100:   Quick test
500:   Reasonable estimate
1000:  RECOMMENDED (good balance)
5000:  High accuracy
10000: Diminishing returns
```

Recommendations:
- Start with 1000
- Use 5000 if time permits
- More simulations just confirms 1000 results

### Q: Why are my out-of-sample returns lower than in-sample?

**Normal!** Called "walk-forward degradation"

Reasons:
1. Parameters optimized on in-sample = perfect fit
2. Out-of-sample is new, different data
3. Market regime changed
4. Some overfitting is inevitable

Check if degradation < 5% (acceptable)

### Q: Can I trade multiple timeframes?

Currently: **No**, daily bars only

Coming soon: 1-hour, 4-hour, weekly bars

Workaround: Use daily data approximation

### Q: What symbols can I backtest?

Supported:
- ✅ Large-cap US stocks (AAPL, MSFT, etc.)
- ✅ ETFs (SPY, QQQ, IWM, etc.)
- Coming: International stocks, cryptocurrencies

### Q: How do I avoid overfitting?

```
1. Keep parameters simple (2-3 parameters max)
2. Use enough historical data (3+ years)
3. Test on multiple assets (not just 1)
4. Run walk-forward optimization
5. Check parameter stability (CV < 0.2)
6. Keep out-of-sample degradation < 5%
```

### Q: What's a good Sharpe ratio?

```
< 0.5:   Poor
0.5-1.0: Acceptable
1.0-2.0: Good
> 2.0:   Excellent

For reference:
S&P 500: ~0.5 (rough)
Great strategies: > 1.0
```

### Q: Should I rebalance frequently?

```
Monthly:   More trading, captures trends better
Quarterly: Less trading, balanced approach ← RECOMMENDED
Yearly:    Minimal trading, most drift allowed

Trade-off: Higher returns with more trading vs
          Higher costs with frequent rebalancing
```

### Q: What's a bad max drawdown?

```
< -10%:   Acceptable for stock strategies
-10% to -20%: Normal, plan for it
-20% to -40%: High volatility, risky
> -40%:   Extreme risk, question strategy

Note: Can't eliminate drawdowns, only manage them
```

---

## Getting Help

### Need Support?

- **In-App Help**: Click "?" in bottom right
- **Documentation**: See full API docs
- **Email**: support@hms.example.com
- **Community**: Forum at hms-community.slack.com

### Report Issues

- Found a bug? Submit at: issues.hms.example.com
- Have a feature request? Vote on features.hms.example.com
- Want to contribute? See CONTRIBUTING.md

---

**Happy backtesting! 📈**

Remember: Past performance doesn't guarantee future results. Always paper trade before going live.

