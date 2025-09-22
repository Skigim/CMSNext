import { describe, it, expect } from 'vitest';

/**
 * Test suite for React key management best practices
 * Based on PR review feedback for CMSNext Case Detail UI Polish (PR #1)
 */

describe('React Key Management Patterns', () => {
  describe('Content-based key generation', () => {
    it('should generate stable keys using content hashing', () => {
      // Helper function that mimics the key generation logic used in components
      const generateContentKey = (content: string, fallbackIndex?: number): string => {
        if (!content || content.trim() === '') {
          return `empty-${fallbackIndex || 0}`;
        }
        
        try {
          // Use btoa for content hashing with error handling for non-Latin-1 characters
          return `content-${btoa(unescape(encodeURIComponent(content.slice(0, 50))))}`;
        } catch (error) {
          // Fallback for encoding errors
          console.warn('Key generation encoding error:', error);
          return `content-${content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${fallbackIndex || 0}`;
        }
      };

      // Test with normal content
      const normalKey = generateContentKey('This is normal content');
      const sameContentKey = generateContentKey('This is normal content');
      expect(normalKey).toBe(sameContentKey);

      // Test with Unicode content (Chinese)
      const chineseKey = generateContentKey('测试内容');
      const sameChineseKey = generateContentKey('测试内容');
      expect(chineseKey).toBe(sameChineseKey);

      // Test with Arabic content
      const arabicKey = generateContentKey('نص عربي');
      const sameArabicKey = generateContentKey('نص عربي');
      expect(arabicKey).toBe(sameArabicKey);

      // Test with emoji
      const emojiKey = generateContentKey('🎉💻🚀 Emoji test');
      const sameEmojiKey = generateContentKey('🎉💻🚀 Emoji test');
      expect(emojiKey).toBe(sameEmojiKey);

      // Keys should be different for different content
      expect(normalKey).not.toBe(chineseKey);
      expect(chineseKey).not.toBe(arabicKey);
    });

    it('should handle edge cases in content hashing', () => {
      const generateContentKey = (content: string, fallbackIndex?: number): string => {
        if (!content || content.trim() === '') {
          return `empty-${fallbackIndex || 0}`;
        }
        
        try {
          return `content-${btoa(unescape(encodeURIComponent(content.slice(0, 50))))}`;
        } catch (error) {
          return `content-${content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${fallbackIndex || 0}`;
        }
      };

      // Test empty content
      expect(generateContentKey('')).toBe('empty-0');
      expect(generateContentKey('', 5)).toBe('empty-5');

      // Test whitespace-only content
      expect(generateContentKey('   ')).toBe('empty-0');
      expect(generateContentKey('\n\t  ')).toBe('empty-0');

      // Test very long content (should be truncated)
      const longContent = 'A'.repeat(100);
      const longKey = generateContentKey(longContent);
      expect(longKey).toContain('content-');
      expect(longKey.length).toBeLessThan(200); // Should be reasonable length

      // Test content with special characters that might break btoa
      const specialContent = 'Content with \u0000 null \uFFFF chars';
      expect(() => generateContentKey(specialContent)).not.toThrow();
    });

    it('should provide consistent fallback for encoding errors', () => {
      const generateContentKey = (content: string, fallbackIndex?: number): string => {
        if (!content || content.trim() === '') {
          return `empty-${fallbackIndex || 0}`;
        }
        
        try {
          return `content-${btoa(unescape(encodeURIComponent(content.slice(0, 50))))}`;
        } catch (error) {
          return `content-${content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${fallbackIndex || 0}`;
        }
      };

      // Test that fallback is consistent for same content
      const problematicContent = 'Content\uD800'; // Unpaired surrogate
      const key1 = generateContentKey(problematicContent, 1);
      const key2 = generateContentKey(problematicContent, 1);
      expect(key1).toBe(key2);

      // Test that different indexes produce different fallback keys
      const key3 = generateContentKey(problematicContent, 2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Key stability in lists', () => {
    it('should maintain key stability when items are reordered', () => {
      interface TestItem {
        id: string;
        content: string;
      }

      // Helper to generate keys for a list of items
      const generateKeysForList = (items: TestItem[]): string[] => {
        return items.map((item, index) => {
          // Use ID if available, otherwise use content-based key
          if (item.id && item.id.trim() !== '') {
            return item.id;
          }
          
          try {
            return `content-${btoa(unescape(encodeURIComponent(item.content.slice(0, 50))))}`;
          } catch (error) {
            return `content-${item.content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${index}`;
          }
        });
      };

      const originalItems: TestItem[] = [
        { id: '', content: 'First item content' },
        { id: '', content: 'Second item content' },
        { id: '', content: 'Third item content' }
      ];

      const originalKeys = generateKeysForList(originalItems);

      // Reorder items
      const reorderedItems: TestItem[] = [
        originalItems[2], // Third becomes first
        originalItems[0], // First becomes second
        originalItems[1]  // Second becomes third
      ];

      const reorderedKeys = generateKeysForList(reorderedItems);

      // Keys should remain the same for the same content, regardless of position
      expect(reorderedKeys[0]).toBe(originalKeys[2]); // Third item key
      expect(reorderedKeys[1]).toBe(originalKeys[0]); // First item key  
      expect(reorderedKeys[2]).toBe(originalKeys[1]); // Second item key

      // All keys should still be unique
      const uniqueKeys = new Set(reorderedKeys);
      expect(uniqueKeys.size).toBe(reorderedKeys.length);
    });

    it('should handle mixed ID and content-based keys correctly', () => {
      interface TestItem {
        id: string;
        content: string;
      }

      const generateKey = (item: TestItem, index: number): string => {
        if (item.id && item.id.trim() !== '') {
          return item.id;
        }
        
        try {
          return `content-${btoa(unescape(encodeURIComponent(item.content.slice(0, 50))))}`;
        } catch (error) {
          return `content-${item.content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${index}`;
        }
      };

      const mixedItems: TestItem[] = [
        { id: 'item-1', content: 'Has ID' },
        { id: '', content: 'No ID, use content hash' },
        { id: 'item-3', content: 'Another with ID' }
      ];

      const keys = mixedItems.map((item, index) => generateKey(item, index));

      // ID-based keys should use the ID
      expect(keys[0]).toBe('item-1');
      expect(keys[2]).toBe('item-3');

      // Content-based key should not be an ID
      expect(keys[1]).toContain('content-');
      expect(keys[1]).not.toBe('');

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});