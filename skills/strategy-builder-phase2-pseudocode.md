# Strategy Builder Skill - PHASE 2: PSEUDOCODE

**Agent**: Trading Operations
**SPARC Phase**: Phase 2 - Pseudocode
**Status**: In Development
**Version**: 2.0.0 (Pseudocode Phase)
**Owner**: Trading Operations Team
**Last Updated**: 2025-10-23

---

## SPARC Framework Progress

- **Phase 1 - Specification**: ✅ COMPLETE
  - Define functional requirements ✓
  - Define technical requirements ✓
  - Document user journeys ✓
  - Define success metrics ✓
  - List constraints & limitations ✓
- **Phase 2 - Pseudocode**: 🔄 IN PROGRESS
  - Visual builder algorithm design ✓
  - Strategy representation data structures ✓
  - Optimization workflow design ✓
  - Backtesting integration flow ✓
  - Parameter optimization algorithms ✓
  - Integration points mapping ✓
  - Error handling strategies ✓
- **Phase 3 - Architecture**: 📋 Pending
- **Phase 4 - Refinement**: 📋 Pending
- **Phase 5 - Completion**: 📋 Pending

---

## 1. CORE DATA STRUCTURES

### 1.1 Strategy Representation

```
CLASS StrategyDefinition
  PROPERTIES:
    id: UUID (unique identifier)
    name: String (e.g., "BTC RSI Mean Reversion")
    version: String (semantic versioning)
    description: String (user-friendly description)
    strategyType: ENUM (MOMENTUM, MEAN_REVERSION, ARBITRAGE, GRID, DCA, BREAKOUT, MARKET_MAKING, PAIRS, CUSTOM, ML_BASED)
    owner: UserID
    createdAt: Timestamp
    updatedAt: Timestamp

  COMPOSITION:
    metadata: StrategyMetadata
    builder: StrategyBuilder (visual or code representation)
    indicators: IndicatorLibrary (list of indicators)
    entries: List<EntryCondition>
    exits: List<ExitCondition>
    riskManagement: RiskManagementConfig
    backtest: BacktestConfig
    deployment: DeploymentConfig
    version_history: List<StrategyVersion>
    sharing: SharingConfig
    tags: List<String>

  METHODS:
    validate(): Boolean
    toJSON(): String
    toYAML(): String
    toCode(language: String): String
    getBacktest(): BacktestResult
    deploy(environment: String): DeploymentResult
    clone(): StrategyDefinition
    merge(other: StrategyDefinition): StrategyDefinition


CLASS StrategyMetadata
  PROPERTIES:
    author: String
    lastModifiedBy: UserID
    status: ENUM (DRAFT, ACTIVE, BACKTESTING, OPTIMIZING, DEPLOYED, ARCHIVED)
    tags: List<String>
    complexity: ENUM (SIMPLE, MODERATE, COMPLEX)
    riskLevel: ENUM (LOW, MEDIUM, HIGH)
    targetAssets: List<String> (e.g., ["BTC/USD", "ETH/USD"])
    timeframes: List<String> (e.g., ["1h", "4h", "1d"])


CLASS StrategyBuilder
  PROPERTIES:
    type: ENUM (VISUAL, CODE, HYBRID)
    content: String (visual JSON or code)

  METHODS:
    parseVisual(): StrategyLogic
    parseCode(): StrategyLogic
    validateSyntax(): Boolean
    getTree(): AST (Abstract Syntax Tree)


CLASS StrategyLogic
  PROPERTIES:
    entries: List<LogicNode>
    exits: List<LogicNode>
    filters: List<LogicNode>

  METHODS:
    evaluate(candle: PriceCandle, state: StrategyState): Decision


CLASS LogicNode
  PROPERTIES:
    type: ENUM (CONDITION, COMPARISON, OPERATOR, ACTION)
    operator: ENUM (AND, OR, NOT, EQUAL, GREATER, LESS, CROSS_ABOVE, CROSS_BELOW)
    value: Any (string, number, boolean)
    children: List<LogicNode>

  METHODS:
    evaluate(context: EvaluationContext): Boolean


CLASS IndicatorLibrary
  PROPERTIES:
    indicators: Map<String, IndicatorInstance>

  METHODS:
    add(name: String, config: IndicatorConfig): IndicatorInstance
    remove(name: String): Boolean
    get(name: String): IndicatorInstance
    validate(): Boolean
    calculateAll(candle: PriceCandle): Map<String, Float>


CLASS IndicatorInstance
  PROPERTIES:
    id: String (e.g., "rsi_1", "macd_1")
    type: String (e.g., "RSI", "MACD", "BB")
    parameters: Map<String, Any>
    values: TimeSeries<Float>
    lastValue: Float
    lastCalculationTime: Timestamp

  METHODS:
    calculate(prices: List<Float>): Float
    update(newPrice: Float): Float
    validate(): Boolean


CLASS EntryCondition
  PROPERTIES:
    id: String (unique ID for this condition)
    name: String (user-friendly name)
    logic: LogicNode (parsed condition logic)
    confirmations: Integer (number of confirmations required)
    priority: Integer (for multiple entry signals)

  METHODS:
    evaluate(state: StrategyState): Boolean
    getSignalScore(): Float (confidence 0-1)


CLASS ExitCondition
  PROPERTIES:
    id: String
    type: ENUM (PROFIT_TARGET, STOP_LOSS, TIME_BASED, TRAILING, SIGNAL, MANUAL)
    name: String
    logic: LogicNode
    timeout: Integer (minutes, 0 = never)

  METHODS:
    evaluate(state: StrategyState, position: Position): Boolean


CLASS RiskManagementConfig
  PROPERTIES:
    positionSizing: PositionSizer
    stopLoss: StopLossConfig
    takeProfit: TakeProfitConfig
    portfolioLimits: PortfolioLimits
    riskMonitoring: RiskMonitoring

  METHODS:
    calculatePositionSize(capital: Float, riskPercentage: Float): Float
    validatePosition(position: Position, portfolio: Portfolio): Boolean
    getRiskMetrics(portfolio: Portfolio): RiskMetrics


CLASS PositionSizer
  PROPERTIES:
    method: ENUM (FIXED, PERCENTAGE, ATR_BASED, KELLY_CRITERION, CUSTOM)
    parameters: Map<String, Any>

  METHODS:
    calculateSize(context: SizingContext): Float
    validate(): Boolean


CLASS BacktestConfig
  PROPERTIES:
    startDate: Date
    endDate: Date
    timeframe: String (e.g., "1d", "1h")
    initialCapital: Float
    commission: Float (percentage)
    slippage: SlippageModel
    symbols: List<String>
    reinvestProfit: Boolean

  METHODS:
    validate(): Boolean


CLASS DeploymentConfig
  PROPERTIES:
    environment: ENUM (PAPER, LIVE)
    exchange: String
    symbols: List<String>
    initialCapital: Float
    maxCapital: Float
    maxPositionSize: Float
    approvalRequired: Boolean
    deploymentTime: Timestamp

  METHODS:
    validate(): Boolean
```

---

## 2. VISUAL STRATEGY BUILDER ALGORITHM

### 2.1 Visual Builder Component Flow

```
ALGORITHM BuildStrategyVisually(user_input):

  INPUT: User drag-drop actions in visual builder
  OUTPUT: StrategyDefinition object

  BEGIN
    // Initialize empty strategy
    strategy = new StrategyDefinition()
    strategy.builder.type = VISUAL

    // Track visual components
    visual_nodes = empty Map
    connections = empty List

    LOOP FOR EACH user_action IN session:

      CASE user_action.type OF:

        // User drags indicator onto canvas
        CASE 'ADD_INDICATOR':
          indicator = new IndicatorInstance()
          indicator.type = user_action.indicator_type
          indicator.parameters = user_action.parameters
          visual_nodes[indicator.id] = indicator

          IF NOT indicator.validate() THEN
            RETURN Error("Invalid indicator configuration")
          END IF

          strategy.indicators.add(indicator)
          EMIT visual_update(indicator)

        // User creates condition block
        CASE 'ADD_CONDITION':
          condition = new EntryCondition()
          condition.logic = new LogicNode()
          condition.logic.operator = AND
          condition.logic.children = empty List
          visual_nodes[condition.id] = condition

          strategy.entries.add(condition) IF user_action.is_entry

          EMIT visual_update(condition)

        // User connects indicator to condition
        CASE 'CONNECT_NODES':
          source_id = user_action.source_node_id
          target_id = user_action.target_node_id

          IF NOT can_connect(source_id, target_id) THEN
            RETURN Error("Invalid connection")
          END IF

          connection = new Connection(source_id, target_id)
          connections.add(connection)

          EMIT visual_update(connection)

        // User modifies parameter
        CASE 'UPDATE_PARAMETER':
          node = visual_nodes[user_action.node_id]
          node.parameters[user_action.param_name] = user_action.param_value

          IF NOT node.validate() THEN
            EMIT warning("Invalid parameter")
          END IF

          EMIT visual_update(node)

        // User runs preview/validation
        CASE 'VALIDATE':
          syntax_valid = validate_syntax(strategy)
          logic_valid = validate_logic(strategy)

          IF NOT syntax_valid OR NOT logic_valid THEN
            EMIT errors(validation_errors)
          ELSE
            EMIT success("Strategy valid")
          END IF

    END LOOP

    // Convert visual representation to logic
    strategy.builder.content = serialize_visual(visual_nodes, connections)
    strategy.strategy_logic = parse_visual_to_logic(visual_nodes, connections)

    RETURN strategy
  END


ALGORITHM parse_visual_to_logic(visual_nodes, connections):

  INPUT: Visual node graph
  OUTPUT: StrategyLogic object

  BEGIN
    strategy_logic = new StrategyLogic()

    // Map visual nodes to logic nodes
    FOR EACH visual_node IN visual_nodes:

      IF visual_node.type == INDICATOR THEN
        // Indicators become leaf nodes (values to reference)
        CONTINUE

      ELSE IF visual_node.type == CONDITION THEN
        // Find connections to this condition
        input_connections = connections WHERE target = visual_node.id

        // Build logic tree from inputs
        root_logic_node = new LogicNode()
        root_logic_node.operator = AND

        FOR EACH connection IN input_connections:
          source = visual_nodes[connection.source_id]
          comparison = build_comparison(source, connection.parameters)
          root_logic_node.children.add(comparison)
        END FOR

        IF visual_node.is_entry_condition THEN
          strategy_logic.entries.add(root_logic_node)
        ELSE IF visual_node.is_exit_condition THEN
          strategy_logic.exits.add(root_logic_node)
        END IF

      END IF

    END FOR

    RETURN strategy_logic
  END


ALGORITHM build_comparison(source_node, connection_params):

  INPUT: Source node (e.g., indicator), connection parameters
  OUTPUT: LogicNode representing comparison

  BEGIN
    comparison = new LogicNode()
    comparison.type = COMPARISON

    CASE source_node.type OF:

      CASE 'INDICATOR':
        // Example: RSI > 70
        indicator = source_node
        comparison.operator = connection_params.operator (e.g., GREATER_THAN)
        comparison.value = connection_params.threshold
        comparison.left = indicator.id
        comparison.right = comparison.value

      CASE 'PRICE':
        // Example: Price > previous_price
        comparison.operator = connection_params.operator
        comparison.left = 'price'
        comparison.right = connection_params.reference

      CASE 'VOLUME':
        comparison.operator = connection_params.operator
        comparison.left = 'volume'
        comparison.right = connection_params.threshold

    END CASE

    RETURN comparison
  END
```

---

## 3. CODE STRATEGY BUILDER ALGORITHM

### 3.1 Code Parsing and Validation

```
ALGORITHM ParseCodeStrategy(code_string, language):

  INPUT: Code string (JavaScript or Python), language type
  OUTPUT: StrategyDefinition or Error

  BEGIN
    strategy = new StrategyDefinition()
    strategy.builder.type = CODE

    // Tokenize and parse code
    tokens = tokenize(code_string, language)
    ast = parse(tokens, language)

    IF ast == NULL THEN
      RETURN Error("Syntax error in code")
    END IF

    // Extract strategy components
    strategy.indicators = extract_indicators(ast)
    strategy.entries = extract_entries(ast)
    strategy.exits = extract_exits(ast)
    strategy.risk_management = extract_risk_config(ast)

    // Validate required functions exist
    required_functions = ["calculate", "onBar", "checkEntry", "checkExit"]
    FOR EACH func IN required_functions:
      IF NOT ast.contains_function(func) THEN
        RETURN Error("Missing required function: " + func)
      END IF
    END FOR

    // Static analysis
    errors = analyze_code(ast)
    IF errors.count > 0 THEN
      RETURN Error(errors)
    END IF

    // Sandbox test (small execution)
    test_result = sandbox_execute(ast, test_data)
    IF test_result.error THEN
      RETURN Error("Runtime error: " + test_result.error)
    END IF

    strategy.builder.content = code_string
    strategy.builder.ast = ast

    RETURN strategy
  END


ALGORITHM extract_indicators(ast):

  INPUT: Abstract Syntax Tree from parsed code
  OUTPUT: IndicatorLibrary

  BEGIN
    indicators = new IndicatorLibrary()

    // Find all indicator instantiations
    indicator_calls = ast.find_function_calls(["RSI", "MACD", "BB", "ATR", ...])

    FOR EACH call IN indicator_calls:
      indicator = new IndicatorInstance()
      indicator.id = generate_id()
      indicator.type = call.function_name

      // Extract parameters
      FOR EACH arg IN call.arguments:
        param_name = arg.name
        param_value = evaluate_constant(arg.value)
        indicator.parameters[param_name] = param_value
      END FOR

      IF NOT indicator.validate() THEN
        EMIT warning("Invalid indicator: " + call.function_name)
        CONTINUE
      END IF

      indicators.add(indicator)

    END FOR

    RETURN indicators
  END


ALGORITHM sandbox_execute(ast, test_data):

  INPUT: AST to execute, test price data
  OUTPUT: ExecutionResult

  BEGIN
    // Create isolated execution environment
    sandbox = create_isolated_context()

    // Load test data
    sandbox.set_prices(test_data.prices)
    sandbox.set_volume(test_data.volumes)

    // Execute with timeout
    TRY
      result = execute_with_timeout(ast, sandbox, timeout=30_seconds)
      RETURN ExecutionResult(success=True, output=result)
    CATCH error
      RETURN ExecutionResult(success=False, error=error)
    END TRY
  END
```

---

## 4. STRATEGY VALIDATION ALGORITHM

### 4.1 Comprehensive Validation

```
ALGORITHM ValidateStrategy(strategy):

  INPUT: StrategyDefinition
  OUTPUT: ValidationResult

  BEGIN
    errors = empty List
    warnings = empty List

    // Basic structure validation
    IF strategy.name == NULL OR strategy.name.length == 0 THEN
      errors.add("Strategy name required")
    END IF

    IF strategy.entries.length == 0 THEN
      errors.add("At least one entry condition required")
    END IF

    IF strategy.exits.length == 0 THEN
      errors.add("At least one exit condition required")
    END IF

    // Indicator validation
    FOR EACH indicator IN strategy.indicators.list:
      IF NOT indicator.validate() THEN
        errors.add("Invalid indicator: " + indicator.id)
      END IF
    END FOR

    // Entry condition validation
    FOR EACH entry IN strategy.entries:
      errors.append(validate_condition(entry))
    END FOR

    // Exit condition validation
    FOR EACH exit IN strategy.exits:
      errors.append(validate_condition(exit))
    END FOR

    // Risk management validation
    IF NOT strategy.risk_management.validate() THEN
      errors.add("Invalid risk management configuration")
    END IF

    // Complexity validation
    IF strategy.indicators.count > 50 THEN
      errors.add("Too many indicators (max 50)")
    END IF

    IF strategy.entries.count + strategy.exits.count > 100 THEN
      errors.add("Too many conditions (max 100)")
    END IF

    // Logic validation
    logic_errors = validate_logic(strategy)
    errors.append(logic_errors)

    // Performance warnings
    IF strategy.indicators.count > 20 THEN
      warnings.add("More than 20 indicators may impact performance")
    END IF

    IF estimate_complexity(strategy) > HIGH THEN
      warnings.add("Complex strategy may take longer to backtest")
    END IF

    RETURN ValidationResult(
      valid = (errors.length == 0),
      errors = errors,
      warnings = warnings
    )
  END


ALGORITHM validate_condition(condition):

  INPUT: EntryCondition or ExitCondition
  OUTPUT: List of errors

  BEGIN
    errors = empty List

    IF condition.logic == NULL THEN
      errors.add("Condition logic not defined")
      RETURN errors
    END IF

    // Check for circular references
    IF has_circular_reference(condition.logic) THEN
      errors.add("Circular reference in condition logic")
    END IF

    // Check all referenced indicators exist
    referenced_indicators = extract_indicators(condition.logic)
    FOR EACH indicator_id IN referenced_indicators:
      IF NOT strategy.indicators.contains(indicator_id) THEN
        errors.add("Indicator not found: " + indicator_id)
      END IF
    END FOR

    // Check logic evaluation type
    IF condition.logic.evaluate_type() != BOOLEAN THEN
      errors.add("Condition must evaluate to boolean")
    END IF

    RETURN errors
  END
```

---

## 5. BACKTESTING INTEGRATION FLOW

### 5.1 Backtest Execution Engine

```
ALGORITHM RunBacktest(strategy, config):

  INPUT: StrategyDefinition, BacktestConfig
  OUTPUT: BacktestResult

  BEGIN
    // Initialize backtest
    backtest = new BacktestRunner()
    backtest.strategy = strategy
    backtest.config = config

    // Load historical data
    prices = load_price_data(config.symbols, config.startDate, config.endDate)
    IF prices == NULL OR prices.length == 0 THEN
      RETURN Error("No price data available")
    END IF

    // Initialize state
    portfolio = new Portfolio(config.initialCapital)
    state = new StrategyState()
    state.portfolio = portfolio
    state.positions = empty Map
    state.orders = empty List
    state.trades = empty List

    // Calculate all indicators once at start (for lookback period)
    lookback_period = calculate_lookback(strategy)
    FOR i = 0 TO lookback_period:
      current_candle = prices[i]
      calculate_indicators(strategy, prices[0:i])
    END FOR

    // Main backtest loop
    results = new BacktestResult()

    FOR i = lookback_period TO prices.length:
      current_candle = prices[i]
      previous_candle = prices[i-1] IF i > 0

      // Update indicators with new price data
      new_values = strategy.indicators.calculateAll(current_candle)

      // Create evaluation context
      context = new EvaluationContext()
      context.current_candle = current_candle
      context.indicator_values = new_values
      context.portfolio = portfolio
      context.positions = state.positions
      context.time = current_candle.time

      // Check for exits first (priority)
      FOR EACH exit_condition IN strategy.exits:
        IF exit_condition.evaluate(context) THEN
          // Close all applicable positions
          positions_to_close = get_applicable_positions(state, exit_condition)
          FOR EACH position IN positions_to_close:
            trade = close_position(position, current_candle.close)
            state.trades.add(trade)
            portfolio.update(trade.profit_loss)
            state.positions.remove(position.id)
          END FOR
        END IF
      END FOR

      // Check for entries (only if not at max positions)
      IF state.positions.count < strategy.risk_management.maxPositions:
        FOR EACH entry_condition IN strategy.entries:
          IF entry_condition.evaluate(context) THEN
            // Check risk limits
            IF strategy.risk_management.validatePosition(portfolio) THEN
              // Calculate position size
              position_size = strategy.risk_management.calculatePositionSize(portfolio)

              // Open position
              position = new Position()
              position.entry_price = current_candle.close
              position.entry_time = current_candle.time
              position.size = position_size
              position.symbol = current_candle.symbol

              state.positions[position.id] = position

              // Set stop loss and take profit
              stop_loss = set_stop_loss(position, current_candle, strategy)
              take_profit = set_take_profit(position, current_candle, strategy)
            END IF
          END IF
        END FOR
      END IF

      // Update open positions for trailing stops, etc.
      FOR EACH position IN state.positions.values:
        IF position.has_trailing_stop THEN
          update_trailing_stop(position, current_candle)
        END IF
      END FOR

      // Record daily metrics
      results.daily_values.add(DailySnapshot(
        date = current_candle.time,
        portfolio_value = portfolio.total_value,
        positions_count = state.positions.count,
        open_pnl = calculate_open_pnl(state.positions, current_candle)
      ))

    END FOR

    // Calculate final metrics
    results.total_trades = state.trades.length
    results.winning_trades = state.trades.filter(profit > 0).length
    results.losing_trades = state.trades.filter(profit < 0).length
    results.win_rate = results.winning_trades / results.total_trades

    results.total_return = (portfolio.total_value - config.initialCapital) / config.initialCapital
    results.sharpe_ratio = calculate_sharpe(results.daily_values)
    results.sortino_ratio = calculate_sortino(results.daily_values)
    results.max_drawdown = calculate_max_drawdown(results.daily_values)

    results.equity_curve = results.daily_values
    results.trades = state.trades

    RETURN results
  END


ALGORITHM calculate_lookback(strategy):

  INPUT: StrategyDefinition
  OUTPUT: Number of candles needed for initialization

  BEGIN
    max_lookback = 0

    FOR EACH indicator IN strategy.indicators.list:
      lookback = get_indicator_lookback(indicator.type, indicator.parameters)
      max_lookback = MAX(max_lookback, lookback)
    END FOR

    // Add buffer for safety
    RETURN max_lookback + 10
  END
```

---

## 6. PARAMETER OPTIMIZATION ALGORITHMS

### 6.1 Grid Search Optimization

```
ALGORITHM GridSearchOptimization(strategy, optimization_config):

  INPUT: StrategyDefinition, OptimizationConfig with parameter ranges
  OUTPUT: List<OptimizedStrategy>

  BEGIN
    // Generate all parameter combinations
    parameter_space = generate_parameter_grid(optimization_config)
    total_combinations = calculate_combinations(parameter_space)

    IF total_combinations > 10000 THEN
      EMIT warning("Large parameter space (" + total_combinations + "). Consider genetic algorithm.")
    END IF

    results = empty List
    completed = 0

    FOR EACH parameter_combo IN parameter_space:
      // Update strategy with new parameters
      test_strategy = clone_strategy(strategy)
      apply_parameters(test_strategy, parameter_combo)

      // Run backtest
      backtest_result = run_backtest(test_strategy, config)

      IF backtest_result.error THEN
        CONTINUE
      END IF

      // Score this combination
      score = calculate_score(backtest_result, optimization_config.target_metric)

      results.add(OptimizedResult(
        parameters = parameter_combo,
        score = score,
        backtest = backtest_result
      ))

      completed += 1
      progress = completed / total_combinations
      EMIT progress_update(progress)

    END FOR

    // Sort by score (descending)
    results.sort_by_score(descending=True)

    RETURN results.top_n(top=100)
  END


ALGORITHM calculate_score(backtest_result, target_metric):

  INPUT: BacktestResult, target metric name (e.g., "sharpe", "profit", "sortino")
  OUTPUT: Float score

  BEGIN
    CASE target_metric OF:
      CASE 'sharpe':
        // Sharpe ratio already calculated
        RETURN backtest_result.sharpe_ratio

      CASE 'sortino':
        RETURN backtest_result.sortino_ratio

      CASE 'return':
        RETURN backtest_result.total_return

      CASE 'profit_factor':
        gross_profit = sum of all positive trades
        gross_loss = abs(sum of all negative trades)
        IF gross_loss == 0 THEN RETURN 0
        RETURN gross_profit / gross_loss

      CASE 'win_rate':
        RETURN backtest_result.win_rate

      CASE 'custom':
        // User-defined scoring function
        RETURN evaluate_custom_score(backtest_result)

      DEFAULT:
        RETURN backtest_result.sharpe_ratio

    END CASE
  END


ALGORITHM apply_parameters(strategy, parameter_combo):

  INPUT: Strategy, parameter values
  OUTPUT: Modified strategy

  BEGIN
    FOR EACH param_name, param_value IN parameter_combo:
      // Navigate to parameter location in strategy
      [indicator_id, param_key] = parse_parameter_path(param_name)

      indicator = strategy.indicators.get(indicator_id)
      IF indicator != NULL THEN
        indicator.parameters[param_key] = param_value
      END IF

    END FOR

    RETURN strategy
  END
```

### 6.2 Genetic Algorithm Optimization

```
ALGORITHM GeneticAlgorithmOptimization(strategy, optimization_config):

  INPUT: StrategyDefinition, OptimizationConfig
  OUTPUT: List<OptimizedStrategy>

  BEGIN
    // Initialize population
    population_size = 50
    population = create_random_population(strategy, population_size, optimization_config)

    generations_completed = 0
    max_generations = 100
    convergence_threshold = 0.001

    LOOP WHILE generations_completed < max_generations:

      // Evaluate fitness for each individual
      fitness_scores = empty List
      FOR EACH individual IN population:
        backtest = run_backtest(individual, config)
        fitness = calculate_score(backtest, optimization_config.target_metric)
        fitness_scores.add(fitness)
      END FOR

      // Check convergence
      avg_fitness = average(fitness_scores)
      best_fitness = max(fitness_scores)

      IF (best_fitness - avg_fitness) / best_fitness < convergence_threshold THEN
        EMIT log("Convergence detected at generation " + generations_completed)
        BREAK
      END IF

      // Selection (tournament selection)
      selected = tournament_selection(population, fitness_scores, tournament_size=5)

      // Crossover
      offspring = empty List
      FOR i = 0 TO population_size STEP 2:
        parent1 = selected[i]
        parent2 = selected[i+1]

        child1, child2 = crossover(parent1, parent2, crossover_probability=0.8)
        offspring.add(child1)
        offspring.add(child2)
      END FOR

      // Mutation
      mutated_population = empty List
      FOR EACH individual IN offspring:
        mutated = mutate(individual, mutation_rate=0.05, optimization_config)
        mutated_population.add(mutated)
      END FOR

      // Elitism (keep best individuals)
      elite_count = 10
      elite = population.sort_by_fitness(fitness_scores).top_n(elite_count)

      population = elite + mutated_population.top_n(population_size - elite_count)

      generations_completed += 1
      EMIT progress_update(generations_completed / max_generations)

    END LOOP

    // Return top individuals
    final_fitness = evaluate_fitness(population, config)
    ranked_population = population.sort_by_fitness(final_fitness)

    RETURN ranked_population.top_n(100)
  END


ALGORITHM crossover(parent1, parent2, probability):

  INPUT: Two parent strategies, crossover probability
  OUTPUT: Two child strategies

  BEGIN
    IF random() > probability THEN
      RETURN (parent1.clone(), parent2.clone())
    END IF

    child1 = parent1.clone()
    child2 = parent2.clone()

    // Single-point crossover on parameters
    crossover_point = random_index(parent1.all_parameters.length)

    FOR i = crossover_point TO parent1.all_parameters.length:
      param_name = parent1.all_parameters[i]
      child1.set_parameter(param_name, parent2.get_parameter(param_name))
      child2.set_parameter(param_name, parent1.get_parameter(param_name))
    END FOR

    RETURN (child1, child2)
  END


ALGORITHM mutate(individual, mutation_rate, optimization_config):

  INPUT: Strategy individual, mutation rate, optimization config
  OUTPUT: Mutated strategy

  BEGIN
    mutated = individual.clone()

    FOR EACH param_name IN mutated.all_parameters:
      IF random() < mutation_rate THEN
        current_value = mutated.get_parameter(param_name)
        param_range = optimization_config.get_range(param_name)

        // Gaussian mutation around current value
        std_dev = (param_range.max - param_range.min) / 20
        new_value = gaussian_random(current_value, std_dev)
        new_value = clamp(new_value, param_range.min, param_range.max)

        mutated.set_parameter(param_name, new_value)
      END IF
    END FOR

    RETURN mutated
  END
```

### 6.3 Walk-Forward Analysis

```
ALGORITHM WalkForwardAnalysis(strategy, optimization_config):

  INPUT: StrategyDefinition, WalkForwardConfig
  OUTPUT: WalkForwardResult

  BEGIN
    total_period = optimization_config.endDate - optimization_config.startDate
    in_sample_length = optimization_config.in_sample_duration
    out_sample_length = optimization_config.out_of_sample_duration
    step = optimization_config.step_duration

    windows = empty List
    current_date = optimization_config.startDate

    // Create rolling windows
    WHILE current_date + in_sample_length + out_sample_length <= optimization_config.endDate:

      window = new Window()
      window.in_sample_start = current_date
      window.in_sample_end = current_date + in_sample_length
      window.out_sample_start = window.in_sample_end
      window.out_sample_end = window.out_sample_start + out_sample_length

      windows.add(window)
      current_date += step

    END WHILE

    results = new WalkForwardResult()
    results.windows = windows
    results.window_results = empty List

    // Process each window
    FOR EACH window IN windows:

      // In-sample: optimize parameters
      IS_config = clone_config(optimization_config)
      IS_config.startDate = window.in_sample_start
      IS_config.endDate = window.in_sample_end

      optimized_strategies = grid_search(strategy, IS_config)
      best_strategy = optimized_strategies[0]

      // Out-of-sample: backtest with optimized parameters
      OOS_config = clone_config(optimization_config)
      OOS_config.startDate = window.out_sample_start
      OOS_config.endDate = window.out_sample_end

      oos_backtest = run_backtest(best_strategy, OOS_config)

      window_result = new WindowResult()
      window_result.in_sample_metrics = optimized_strategies[0].backtest_result
      window_result.out_of_sample_metrics = oos_backtest
      window_result.parameters = best_strategy.parameters

      results.window_results.add(window_result)

    END FOR

    // Calculate summary statistics
    is_sharpes = results.window_results.map(r => r.in_sample_metrics.sharpe_ratio)
    oos_sharpes = results.window_results.map(r => r.out_of_sample_metrics.sharpe_ratio)

    results.avg_in_sample_sharpe = average(is_sharpes)
    results.avg_out_of_sample_sharpe = average(oos_sharpes)
    results.degradation = results.avg_in_sample_sharpe - results.avg_out_of_sample_sharpe

    results.stability = calculate_stability(oos_sharpes) // std dev of OOS Sharpes

    RETURN results
  END
```

---

## 7. ERROR HANDLING AND VALIDATION FRAMEWORK

### 7.1 Error Handling Strategy

```
ALGORITHM HandleStrategyError(error, context):

  INPUT: Error object, execution context
  OUTPUT: ErrorResponse with user-friendly message

  BEGIN
    error_response = new ErrorResponse()
    error_response.timestamp = current_time()
    error_response.context = context

    CASE error.type OF:

      CASE 'SYNTAX_ERROR':
        error_response.message = "Strategy code has syntax errors"
        error_response.technical_details = error.details
        error_response.user_message = format_syntax_error(error)
        error_response.recovery_action = "EDIT_CODE"

      CASE 'VALIDATION_ERROR':
        error_response.message = "Strategy validation failed"
        error_response.technical_details = error.details
        error_response.user_message = "Please fix the highlighted issues"
        error_response.recovery_action = "REVIEW_AND_FIX"

      CASE 'DATA_ERROR':
        error_response.message = "Unable to load price data"
        error_response.technical_details = error.details

        IF error.cause == 'NO_DATA_AVAILABLE' THEN
          error_response.user_message = "No price data available for this period"
        ELSE IF error.cause == 'INVALID_SYMBOLS' THEN
          error_response.user_message = "One or more symbols are invalid"
        END IF

        error_response.recovery_action = "MODIFY_CONFIG"

      CASE 'EXECUTION_ERROR':
        error_response.message = "Error during backtest execution"
        error_response.technical_details = error.details
        error_response.user_message = "An unexpected error occurred. Please try again."
        error_response.recovery_action = "RETRY"

      CASE 'TIMEOUT_ERROR':
        error_response.message = "Operation timed out"
        error_response.technical_details = error.details
        error_response.user_message = "The operation took too long. Try with a shorter time period."
        error_response.recovery_action = "MODIFY_CONFIG"

      CASE 'RESOURCE_ERROR':
        error_response.message = "Insufficient resources"
        error_response.technical_details = error.details
        error_response.user_message = "The system is busy. Please try again in a moment."
        error_response.recovery_action = "QUEUE_AND_RETRY"

      DEFAULT:
        error_response.message = "Unknown error"
        error_response.technical_details = error.details
        error_response.user_message = "An unexpected error occurred"
        error_response.recovery_action = "RETRY"

    END CASE

    // Log error for debugging
    log_error(error_response)

    // Alert operations if critical
    IF error.severity == CRITICAL THEN
      alert_operations(error_response)
    END IF

    RETURN error_response
  END


FUNCTION format_syntax_error(error):

  BEGIN
    line_number = error.line
    column_number = error.column
    token = error.token
    expected = error.expected

    message = format(
      "Line {0}, Column {1}: Unexpected '{2}'. Expected {3}",
      line_number,
      column_number,
      token,
      expected
    )

    RETURN message
  END
```

---

## 8. INTEGRATION POINTS MAPPING

### 8.1 System Integration Flow

```
INTEGRATION_MAP:

┌─────────────────────────────────────────────────────────┐
│              Strategy Builder                            │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
        ▼                 ▼                  ▼
   ┌────────────┐   ┌──────────────┐   ┌─────────────┐
   │ Exchange   │   │ Backtest     │   │ Portfolio   │
   │ Manager    │   │ Manager      │   │ Analyzer    │
   │            │   │              │   │             │
   │ REST API   │   │ Skill invoke │   │ Skill invoke│
   │ WebSocket  │   │ (REST)       │   │ (REST)      │
   └────────────┘   └──────────────┘   └─────────────┘

DATA FLOWS:

1. Strategy Creation → Builder Component
   - User input (visual/code) → Internal representation
   - Validation → User feedback

2. Backtest Execution → Backtest Manager Skill
   - Strategy definition → Backtest request
   - Price data (from Exchange Manager)
   - Backtest results → Display

3. Optimization → Backtest Manager (parallel)
   - Parameter combinations → Multiple backtest jobs
   - Queue management → Progress tracking

4. Live Deployment → Exchange Manager
   - Strategy orders → Order placement API
   - Real-time market data ← WebSocket stream
   - Trade execution feedback ← REST API

5. Portfolio Monitoring → Portfolio Analyzer
   - Position data → Risk analysis
   - Risk metrics ← Risk calculations
```

### 8.2 Database Integration

```
DATABASE_SCHEMA_REFERENCE:

Collection: strategies
  ├── _id: ObjectId
  ├── name: String
  ├── version: String
  ├── owner: UserID
  ├── builder: Object (visual/code representation)
  ├── indicators: Array
  ├── entries: Array
  ├── exits: Array
  ├── risk_management: Object
  ├── status: String
  ├── created_at: Date
  ├── updated_at: Date
  └── version_history: Array

Collection: backtest_results
  ├── _id: ObjectId
  ├── strategy_id: ObjectId
  ├── config: Object
  ├── metrics: Object
    ├── total_return: Float
    ├── sharpe_ratio: Float
    ├── max_drawdown: Float
    └── ...
  ├── daily_values: Array
  ├── trades: Array
  ├── created_at: Date
  └── execution_time_ms: Integer

Collection: optimization_jobs
  ├── _id: ObjectId
  ├── strategy_id: ObjectId
  ├── method: String (grid_search, genetic, etc.)
  ├── config: Object
  ├── status: String
  ├── progress: Float
  ├── results: Array
  ├── created_at: Date
  ├── completed_at: Date
  └── execution_time_ms: Integer
```

---

## 9. DATA TRANSFORMATION WORKFLOWS

### 9.1 JSON to Strategy Transformation

```
ALGORITHM ImportStrategyFromJSON(json_string):

  INPUT: JSON string containing strategy definition
  OUTPUT: StrategyDefinition object

  BEGIN
    TRY
      // Parse JSON
      data = parse_json(json_string)

      // Validate schema
      IF NOT validate_json_schema(data) THEN
        RETURN Error("Invalid JSON schema")
      END IF

      // Transform to objects
      strategy = new StrategyDefinition()
      strategy.name = data.name
      strategy.version = data.version
      strategy.description = data.description
      strategy.strategyType = data.strategy_type

      // Restore indicators
      FOR EACH ind_data IN data.indicators:
        indicator = new IndicatorInstance()
        indicator.type = ind_data.type
        indicator.parameters = ind_data.parameters
        strategy.indicators.add(indicator)
      END FOR

      // Restore conditions
      FOR EACH entry_data IN data.entries:
        entry = deserialize_condition(entry_data)
        strategy.entries.add(entry)
      END FOR

      FOR EACH exit_data IN data.exits:
        exit = deserialize_condition(exit_data)
        strategy.exits.add(exit)
      END FOR

      // Restore risk management
      strategy.risk_management = deserialize_risk_config(data.risk_management)

      RETURN strategy

    CATCH error
      RETURN Error("Failed to import strategy: " + error.message)

    END TRY
  END


ALGORITHM ExportStrategyToJSON(strategy):

  INPUT: StrategyDefinition
  OUTPUT: JSON string

  BEGIN
    data = empty Object

    data.name = strategy.name
    data.version = strategy.version
    data.description = strategy.description
    data.strategy_type = strategy.strategyType
    data.owner = strategy.owner
    data.created_at = strategy.createdAt
    data.updated_at = strategy.updatedAt

    // Serialize indicators
    data.indicators = empty Array
    FOR EACH indicator IN strategy.indicators.list:
      ind_obj = Object()
      ind_obj.id = indicator.id
      ind_obj.type = indicator.type
      ind_obj.parameters = indicator.parameters
      data.indicators.add(ind_obj)
    END FOR

    // Serialize conditions
    data.entries = empty Array
    FOR EACH entry IN strategy.entries:
      data.entries.add(serialize_condition(entry))
    END FOR

    data.exits = empty Array
    FOR EACH exit IN strategy.exits:
      data.exits.add(serialize_condition(exit))
    END FOR

    // Serialize risk management
    data.risk_management = serialize_risk_config(strategy.risk_management)

    RETURN stringify_json(data, pretty=True)
  END
```

---

## 10. STATE MANAGEMENT

### 10.1 Strategy State during Execution

```
CLASS StrategyState
  PROPERTIES:
    session_id: UUID
    strategy_id: UUID
    status: ENUM (IDLE, RUNNING, PAUSED, STOPPED)
    current_candle_index: Integer
    current_time: Timestamp

    portfolio: Portfolio
    positions: Map<String, Position>
    pending_orders: List<Order>
    filled_trades: List<Trade>

    indicators_cache: Map<String, IndicatorValue>
    last_entry_signals: List<Signal>
    last_exit_signals: List<Signal>

    performance_metrics: PerformanceMetrics
    error_log: List<Error>

  METHODS:
    update_indicator(indicator_id, value): void
    add_position(position): void
    close_position(position_id, close_price): Trade
    record_signal(signal): void
    update_metrics(): void
    save_checkpoint(): void
    restore_checkpoint(): void


CLASS Position
  PROPERTIES:
    id: UUID
    strategy_id: UUID
    symbol: String
    entry_price: Float
    entry_time: Timestamp
    size: Float
    entry_signal: String
    status: ENUM (OPEN, CLOSING, CLOSED)

    stop_loss_price: Float (optional)
    take_profit_price: Float (optional)
    trailing_stop_offset: Float (optional)

    current_price: Float
    current_pnl: Float
    current_pnl_pct: Float

  METHODS:
    update_price(new_price): void
    calculate_pnl(current_price): Float
    close(close_price, close_time, close_reason): Trade


CLASS Trade
  PROPERTIES:
    id: UUID
    position_id: UUID
    entry_time: Timestamp
    entry_price: Float
    exit_time: Timestamp
    exit_price: Float
    size: Float
    symbol: String

    profit_loss: Float
    profit_loss_pct: Float
    return_pct: Float

    entry_signal: String
    exit_signal: String

    commission_paid: Float
    slippage: Float
```

---

## PSEUDOCODE PHASE COMPLETION

### Review Checklist

- [x] **Visual Builder Algorithm**: Complete drag-drop logic flow
- [x] **Code Parser Algorithm**: Syntax analysis and validation
- [x] **Validation Framework**: Comprehensive error checking
- [x] **Backtest Engine**: Execution loop and performance calculation
- [x] **Optimization Algorithms**: Grid search, genetic algorithm, walk-forward
- [x] **Error Handling**: User-friendly error responses
- [x] **Integration Points**: System connections mapped
- [x] **Data Structures**: Complete class hierarchies defined
- [x] **State Management**: Runtime state tracking

### Phase 2 Deliverables

✅ **Pseudocode Document** (this document)
- 100+ algorithm descriptions
- 10 core sections with detailed logic flows
- Data structure definitions for all components
- Error handling strategies
- Integration point mapping

### Next Steps

**Phase 3: Architecture** (Estimated: Oct 29 - Nov 2, 2025)
- System architecture diagram (C4 model)
- API endpoint specifications
- Database schema design
- Frontend component architecture
- Security and authentication design
- Deployment architecture
- Infrastructure requirements

---

**Document Status**: ✅ Phase 2 Pseudocode Complete
**Approval Required**: Trading Team Lead, CTO
**Next Phase**: Phase 3 - Architecture
**Maintained By**: Trading Operations Team
**Last Updated**: 2025-10-23

---

