/**
 * LRU (Least Recently Used) Cache Implementation
 * Efficient memory-bounded cache with automatic eviction
 *
 * Features:
 * - Bounded memory usage with configurable max size
 * - O(1) get and set operations using HashMap + DoublyLinkedList
 * - Automatic eviction of least recently used items
 * - Optional TTL (Time To Live) support per item
 * - Cache statistics (hits, misses, evictions)
 *
 * @version 1.0.0
 * @performance O(1) for all operations
 */

/**
 * Node in the DoublyLinkedList (doubly linked for O(1) removal)
 */
class Node {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.ttl = ttl ? Date.now() + ttl : null; // Expiry time if TTL set
    this.prev = null;
    this.next = null;
  }

  /**
   * Check if node has expired
   */
  isExpired() {
    return this.ttl && Date.now() > this.ttl;
  }
}

/**
 * LRUCache - Least Recently Used Cache
 */
class LRUCache {
  /**
   * Create LRU cache
   * @param {Object} options - Cache options
   * @param {number} options.maxSize - Maximum number of items (default: 1000)
   * @param {number} options.defaultTtl - Default TTL in ms (default: 1 hour)
   * @param {boolean} options.enableStats - Enable cache statistics (default: true)
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.defaultTtl || 3600000; // 1 hour
    this.enableStats = options.enableStats !== false;

    // HashMap for O(1) lookups
    this.map = new Map();

    // DoublyLinkedList for O(1) removal and LRU tracking
    // Most recent (accessed) is at the tail
    // Least recent (candidate for eviction) is at the head
    this.head = new Node(null, null); // Sentinel
    this.tail = new Node(null, null); // Sentinel
    this.head.next = this.tail;
    this.tail.prev = this.head;

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      totalGets: 0,
      totalSets: 0
    };
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*|null} Cached value or null if not found or expired
   */
  get(key) {
    if (this.enableStats) this.stats.totalGets++;

    const node = this.map.get(key);

    // Not found
    if (!node) {
      if (this.enableStats) this.stats.misses++;
      return null;
    }

    // Check expiration
    if (node.isExpired()) {
      if (this.enableStats) this.stats.expirations++;
      this.remove(key);
      return null;
    }

    // Move to tail (most recently used)
    this.moveToTail(node);

    if (this.enableStats) this.stats.hits++;
    return node.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Optional TTL in milliseconds (uses defaultTtl if not provided)
   */
  set(key, value, ttl = null) {
    if (this.enableStats) this.stats.totalSets++;

    const actualTtl = ttl || this.defaultTtl;

    // Update existing key
    if (this.map.has(key)) {
      const node = this.map.get(key);
      node.value = value;
      node.ttl = Date.now() + actualTtl;
      this.moveToTail(node);
      return;
    }

    // Create new node
    const newNode = new Node(key, value, actualTtl);
    this.map.set(key, newNode);
    this.insertBeforeTail(newNode);

    // Evict LRU if size exceeded
    if (this.map.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Remove specific key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if item was removed
   */
  remove(key) {
    const node = this.map.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  /**
   * Clear all items from cache
   */
  clear() {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    if (this.enableStats) {
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        expirations: 0,
        totalGets: 0,
        totalSets: 0
      };
    }
  }

  /**
   * Get cache size
   * @returns {number} Current number of items
   */
  size() {
    return this.map.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    if (!this.enableStats) return null;

    const hitRate = this.stats.totalGets > 0
      ? (this.stats.hits / this.stats.totalGets * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      currentSize: this.map.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Get all keys in cache (in LRU order, least to most recent)
   * @returns {Array<string>} Array of keys
   */
  keys() {
    const keys = [];
    let node = this.head.next;
    while (node !== this.tail) {
      keys.push(node.key);
      node = node.next;
    }
    return keys;
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Move node to tail (mark as most recently used)
   * @private
   */
  moveToTail(node) {
    this.removeNode(node);
    this.insertBeforeTail(node);
  }

  /**
   * Insert node before tail (add to most recent end)
   * @private
   */
  insertBeforeTail(node) {
    const prevNode = this.tail.prev;
    prevNode.next = node;
    node.prev = prevNode;
    node.next = this.tail;
    this.tail.prev = node;
  }

  /**
   * Remove node from linked list
   * @private
   */
  removeNode(node) {
    const prevNode = node.prev;
    const nextNode = node.next;
    prevNode.next = nextNode;
    nextNode.prev = prevNode;
  }

  /**
   * Evict the least recently used item
   * @private
   */
  evictLRU() {
    const lruNode = this.head.next; // First node after sentinel
    if (lruNode === this.tail) return; // Cache is empty

    this.removeNode(lruNode);
    this.map.delete(lruNode.key);

    if (this.enableStats) this.stats.evictions++;
  }

  /**
   * Clean up expired entries (optional housekeeping)
   * @private
   */
  cleanupExpired() {
    const keysToRemove = [];

    for (const [key, node] of this.map.entries()) {
      if (node.isExpired()) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.remove(key);
      if (this.enableStats) this.stats.expirations++;
    }

    return keysToRemove.length;
  }
}

/**
 * Create a cache wrapper that periodically cleans up expired entries
 * @param {Object} options - Cache options
 * @returns {LRUCache} Cache instance with periodic cleanup
 */
function createLRUCacheWithCleanup(options = {}) {
  const cache = new LRUCache(options);
  const cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes

  const interval = setInterval(() => {
    cache.cleanupExpired();
  }, cleanupInterval);

  // Store interval for cleanup
  cache._cleanupInterval = interval;

  // Add destroy method
  cache.destroy = function() {
    clearInterval(this._cleanupInterval);
  };

  return cache;
}

module.exports = {
  LRUCache,
  createLRUCacheWithCleanup
};
