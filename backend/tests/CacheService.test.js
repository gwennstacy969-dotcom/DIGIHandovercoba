const CacheService = require('../src/utils/CacheService');

describe('CacheService Unit Tests', () => {
  it('should gracefully degrade and return null when Redis is not ready', async () => {
    const result = await CacheService.get('non_existent_key');
    expect(result).toBeNull();
  });

  it('should return false when trying to set cache without ready Redis', async () => {
    const result = await CacheService.set('test_key', { data: 'test' });
    expect(result).toBe(false);
  });

  it('should return false when trying to delete without ready Redis', async () => {
    const result = await CacheService.del('test_key');
    expect(result).toBe(false);
  });

  it('should return false when trying to delPattern without ready Redis', async () => {
    const result = await CacheService.delPattern('test_*');
    expect(result).toBe(false);
  });
});
