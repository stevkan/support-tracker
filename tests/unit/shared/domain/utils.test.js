import {
  areObjectsInArrayEmpty,
  removeDuplicates,
  getSdk,
  sleep,
  checkAborted,
} from '../../../../shared/domain/utils.js';

describe('areObjectsInArrayEmpty', () => {
  describe('when array contains sub-arrays', () => {
    it('returns true when all sub-arrays contain only zeros', () => {
      expect(areObjectsInArrayEmpty([[0, 0], [0, 0, 0]])).toBe(true);
    });

    it('returns true for single sub-array with zeros', () => {
      expect(areObjectsInArrayEmpty([[0]])).toBe(true);
    });

    it('returns true for empty sub-arrays', () => {
      expect(areObjectsInArrayEmpty([[]])).toBe(true);
    });

    it('returns false when any sub-array contains non-zero values', () => {
      expect(areObjectsInArrayEmpty([[0, 1], [0, 0]])).toBe(false);
    });

    it('returns false when sub-array contains negative numbers', () => {
      expect(areObjectsInArrayEmpty([[0, -1]])).toBe(false);
    });
  });

  describe('when array is empty', () => {
    it('returns true for empty array', () => {
      expect(areObjectsInArrayEmpty([])).toBe(true);
    });
  });

  describe('when array contains non-array elements', () => {
    it('returns false for array with primitive values', () => {
      expect(areObjectsInArrayEmpty([1, 2, 3])).toBe(false);
    });

    it('returns false for array with objects', () => {
      expect(areObjectsInArrayEmpty([{ a: 1 }])).toBe(false);
    });

    it('returns false for array with strings', () => {
      expect(areObjectsInArrayEmpty(['a', 'b'])).toBe(false);
    });
  });
});

describe('removeDuplicates', () => {
  describe('with default key function', () => {
    it('removes duplicate primitives from flat array', () => {
      expect(removeDuplicates([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    });

    it('removes duplicates from nested arrays', () => {
      expect(removeDuplicates([[1, 2], [2, 3], [3, 4]])).toEqual([1, 2, 3, 4]);
    });

    it('preserves order of first occurrence', () => {
      expect(removeDuplicates([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
    });

    it('handles empty array', () => {
      expect(removeDuplicates([])).toEqual([]);
    });

    it('handles array with single element', () => {
      expect(removeDuplicates([1])).toEqual([1]);
    });

    it('handles strings', () => {
      expect(removeDuplicates(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('with custom key function', () => {
    it('removes duplicates based on object property', () => {
      const items = [
        [{ id: 1, name: 'a' }],
        [{ id: 2, name: 'b' }],
        [{ id: 1, name: 'c' }],
      ];
      const result = removeDuplicates(items, item => item.id);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'a' });
      expect(result[1]).toEqual({ id: 2, name: 'b' });
    });

    it('removes duplicates based on computed key', () => {
      const items = [
        { x: 1, y: 2 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
      ];
      const result = removeDuplicates([items], item => `${item.x}-${item.y}`);
      expect(result).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('handles nested empty arrays', () => {
      expect(removeDuplicates([[], []])).toEqual([]);
    });

    it('handles mixed empty and non-empty arrays', () => {
      expect(removeDuplicates([[], [1, 2], []])).toEqual([1, 2]);
    });

    it('handles null and undefined values', () => {
      expect(removeDuplicates([[null, undefined, null]])).toEqual([null, undefined]);
    });
  });
});

describe('getSdk', () => {
  it('returns Java for botbuilder-java', () => {
    expect(getSdk('botbuilder-java')).toBe('Java');
  });

  it('returns Node for botbuilder-js', () => {
    expect(getSdk('botbuilder-js')).toBe('Node');
  });

  it('returns C# for botbuilder-dotnet', () => {
    expect(getSdk('botbuilder-dotnet')).toBe('C#');
  });

  it('returns Python for botbuilder-python', () => {
    expect(getSdk('botbuilder-python')).toBe('Python');
  });

  it('returns Node for botframework-directlinejs', () => {
    expect(getSdk('botframework-directlinejs')).toBe('Node');
  });

  it('returns (Unknown) for unrecognized repository', () => {
    expect(getSdk('some-other-repo')).toBe('(Unknown)');
  });

  describe('case insensitivity', () => {
    it('handles uppercase input', () => {
      expect(getSdk('BOTBUILDER-JAVA')).toBe('Java');
    });

    it('handles mixed case input', () => {
      expect(getSdk('BotBuilder-JS')).toBe('Node');
    });
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a promise', () => {
    const result = sleep(100);
    expect(result).toBeInstanceOf(Promise);
  });

  it('resolves after specified milliseconds', async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('does not resolve before specified time', async () => {
    let resolved = false;
    sleep(1000).then(() => { resolved = true; });
    
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(false);
    
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('works with zero milliseconds', async () => {
    const promise = sleep(0);
    vi.advanceTimersByTime(0);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('checkAborted', () => {
  it('does not throw when signal is undefined', () => {
    expect(() => checkAborted(undefined)).not.toThrow();
  });

  it('does not throw when signal is null', () => {
    expect(() => checkAborted(null)).not.toThrow();
  });

  it('does not throw when signal is not aborted', () => {
    const controller = new AbortController();
    expect(() => checkAborted(controller.signal)).not.toThrow();
  });

  it('throws AbortError when signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    
    expect(() => checkAborted(controller.signal)).toThrow(DOMException);
  });

  it('throws with correct error name', () => {
    const controller = new AbortController();
    controller.abort();
    
    try {
      checkAborted(controller.signal);
    } catch (error) {
      expect(error.name).toBe('AbortError');
      expect(error.message).toBe('Aborted');
    }
  });

  it('works with object that has aborted property', () => {
    expect(() => checkAborted({ aborted: false })).not.toThrow();
    expect(() => checkAborted({ aborted: true })).toThrow(DOMException);
  });
});
