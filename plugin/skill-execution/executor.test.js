/**
 * Skill Executor Tests
 * @version 1.0.0
 */

const SkillExecutor = require('./executor');

describe('SkillExecutor', () => {
  let executor;
  let mockPlugin;

  beforeEach(() => {
    mockPlugin = {
      invoke: jest.fn().mockResolvedValue({ success: true, data: 'test result' })
    };

    executor = new SkillExecutor({ plugin: mockPlugin });
  });

  describe('Parameter Schema', () => {
    test('should define parameter schema', () => {
      const schema = {
        symbol: { type: 'string', required: true },
        quantity: { type: 'number', required: true, min: 1, max: 1000000 }
      };

      executor.defineParameterSchema('order-skill', schema);

      expect(executor.getParameterSchema('order-skill')).toEqual(schema);
    });

    test('should return null for undefined schema', () => {
      expect(executor.getParameterSchema('unknown-skill')).toBeNull();
    });
  });

  describe('Parameter Validation', () => {
    let schema;

    beforeEach(() => {
      schema = {
        symbol: { type: 'string', required: true, minLength: 1, maxLength: 10 },
        quantity: { type: 'number', required: true, min: 1, max: 1000000 },
        side: { type: 'string', enum: ['buy', 'sell'] },
        price: { type: 'number', min: 0.01 }
      };
    });

    test('should validate correct parameters', () => {
      const params = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'buy',
        price: 150.50
      };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required parameters', () => {
      const params = { quantity: 100 };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: symbol');
    });

    test('should validate parameter type', () => {
      const params = {
        symbol: 'AAPL',
        quantity: 'not a number'
      };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('quantity'))).toBe(true);
    });

    test('should validate enum values', () => {
      const params = {
        symbol: 'AAPL',
        quantity: 100,
        side: 'invalid'
      };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('side'))).toBe(true);
    });

    test('should validate numeric ranges', () => {
      const params = {
        symbol: 'AAPL',
        quantity: 2000000
      };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('quantity'))).toBe(true);
    });

    test('should validate string length', () => {
      const params = {
        symbol: 'VERYVERYLONGSYMBOL',
        quantity: 100
      };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('symbol'))).toBe(true);
    });

    test('should skip validation for optional parameters', () => {
      const params = { symbol: 'AAPL', quantity: 100 };

      const result = executor.validateParameters(params, schema);

      expect(result.valid).toBe(true);
    });
  });

  describe('Execution Context', () => {
    test('should create execution context', () => {
      const context = executor.createExecutionContext('exec_123', {
        agentId: 'trader-agent',
        skillId: 'order-skill',
        userId: 'user_1',
        parameters: { symbol: 'AAPL', quantity: 100 }
      });

      expect(context).toBeDefined();
      expect(context.executionId).toBe('exec_123');
      expect(context.status).toBe('running');
      expect(context.startTime).toBeDefined();
    });

    test('should retrieve execution context', () => {
      const created = executor.createExecutionContext('exec_123', {
        agentId: 'trader-agent',
        skillId: 'order-skill',
        userId: 'user_1'
      });

      const retrieved = executor.getExecutionContext('exec_123');

      expect(retrieved).toEqual(created);
    });

    test('should add logs to context', () => {
      executor.createExecutionContext('exec_123', { agentId: 'agent', skillId: 'skill' });

      executor.addLog('exec_123', {
        level: 'info',
        message: 'Test log message',
        data: { key: 'value' }
      });

      const context = executor.getExecutionContext('exec_123');
      expect(context.logs).toHaveLength(1);
      expect(context.logs[0].message).toBe('Test log message');
    });
  });

  describe('Skill Execution', () => {
    test('should execute skill successfully', async () => {
      const result = await executor.executeSkill({
        agentId: 'trader-agent',
        skillId: 'order-skill',
        userId: 'user_1',
        parameters: { symbol: 'AAPL', quantity: 100 }
      });

      expect(result.status).toBe('completed');
      expect(result.context.status).toBe('successful');
      expect(result.context.result).toEqual({ success: true, data: 'test result' });
    });

    test('should fail with parameter validation error', async () => {
      executor.defineParameterSchema('order-skill', {
        symbol: { type: 'string', required: true },
        quantity: { type: 'number', required: true }
      });

      await expect(
        executor.executeSkill({
          agentId: 'trader-agent',
          skillId: 'order-skill',
          userId: 'user_1',
          parameters: { symbol: 'AAPL' }  // Missing quantity
        })
      ).rejects.toThrow('Parameter validation failed');
    });

    test('should handle execution errors', async () => {
      mockPlugin.invoke.mockRejectedValue(new Error('Skill error'));

      await expect(
        executor.executeSkill({
          agentId: 'trader-agent',
          skillId: 'order-skill',
          userId: 'user_1',
          parameters: {}
        })
      ).rejects.toThrow('Skill error');

      expect(executor.executionStats.failed).toBeGreaterThan(0);
    });

    test('should update execution statistics', async () => {
      await executor.executeSkill({
        agentId: 'agent',
        skillId: 'skill',
        userId: 'user',
        parameters: {}
      });

      const stats = executor.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
    });

    test('should record execution in history', async () => {
      await executor.executeSkill({
        agentId: 'trader-agent',
        skillId: 'order-skill',
        userId: 'user_1',
        parameters: {}
      });

      const history = executor.getExecutionHistory({ limit: 10 });
      expect(history).toHaveLength(1);
      expect(history[0].agentId).toBe('trader-agent');
      expect(history[0].skillId).toBe('order-skill');
    });
  });

  describe('Execution with Timeout', () => {
    test('should timeout on slow execution', async () => {
      mockPlugin.invoke.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      await expect(
        executor.executeSkillWithTimeout(
          {
            agentId: 'agent',
            skillId: 'skill',
            userId: 'user',
            parameters: {}
          },
          1000  // 1 second timeout
        )
      ).rejects.toThrow('timeout');
    });

    test('should complete within timeout', async () => {
      const result = await executor.executeSkillWithTimeout(
        {
          agentId: 'agent',
          skillId: 'skill',
          userId: 'user',
          parameters: {}
        },
        5000  // 5 second timeout
      );

      expect(result.status).toBe('completed');
    });
  });

  describe('Execution with Retry', () => {
    test('should retry on failure', async () => {
      mockPlugin.invoke
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });

      const result = await executor.executeSkillWithRetry(
        {
          agentId: 'agent',
          skillId: 'skill',
          userId: 'user',
          parameters: {}
        },
        3,
        100  // 100ms delay
      );

      expect(result.status).toBe('completed');
      expect(mockPlugin.invoke).toHaveBeenCalledTimes(2);
    });

    test('should fail after max retries', async () => {
      mockPlugin.invoke.mockRejectedValue(new Error('Persistent failure'));

      await expect(
        executor.executeSkillWithRetry(
          {
            agentId: 'agent',
            skillId: 'skill',
            userId: 'user',
            parameters: {}
          },
          2,
          50
        )
      ).rejects.toThrow('failed after 2 attempts');
    });
  });

  describe('Batch Execution', () => {
    test('should execute multiple skills', async () => {
      const requests = [
        {
          agentId: 'agent1',
          skillId: 'skill1',
          userId: 'user1',
          parameters: {}
        },
        {
          agentId: 'agent2',
          skillId: 'skill2',
          userId: 'user1',
          parameters: {}
        }
      ];

      const results = await executor.batchExecute(requests);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    test('should handle partial failures in batch', async () => {
      mockPlugin.invoke
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Error'));

      const requests = [
        { agentId: 'agent1', skillId: 'skill1', userId: 'user', parameters: {} },
        { agentId: 'agent2', skillId: 'skill2', userId: 'user', parameters: {} }
      ];

      const results = await executor.batchExecute(requests);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Execution History', () => {
    beforeEach(async () => {
      await executor.executeSkill({
        agentId: 'agent1',
        skillId: 'skill1',
        userId: 'user1',
        parameters: {}
      });

      await executor.executeSkill({
        agentId: 'agent2',
        skillId: 'skill2',
        userId: 'user2',
        parameters: {}
      });
    });

    test('should retrieve full history', () => {
      const history = executor.getExecutionHistory();

      expect(history.length).toBeGreaterThan(0);
    });

    test('should filter history by skill', () => {
      const history = executor.getExecutionHistory({ skillId: 'skill1' });

      expect(history.every(h => h.skillId === 'skill1')).toBe(true);
    });

    test('should filter history by agent', () => {
      const history = executor.getExecutionHistory({ agentId: 'agent1' });

      expect(history.every(h => h.agentId === 'agent1')).toBe(true);
    });

    test('should filter history by user', () => {
      const history = executor.getExecutionHistory({ userId: 'user1' });

      expect(history.every(h => h.userId === 'user1')).toBe(true);
    });

    test('should limit history results', () => {
      const history = executor.getExecutionHistory({ limit: 1 });

      expect(history).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    test('should calculate execution statistics', async () => {
      await executor.executeSkill({
        agentId: 'agent',
        skillId: 'skill',
        userId: 'user',
        parameters: {}
      });

      const stats = executor.getStatistics();

      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBe('100.00%');
    });
  });

  describe('Cleanup', () => {
    test('should clear old executions', async () => {
      await executor.executeSkill({
        agentId: 'agent',
        skillId: 'skill',
        userId: 'user',
        parameters: {}
      });

      const beforeClear = executor.executionHistory.length;
      executor.clearOldExecutions(0);  // Clear everything older than 0 minutes
      const afterClear = executor.executionHistory.length;

      expect(afterClear).toBeLessThanOrEqual(beforeClear);
    });
  });
});
