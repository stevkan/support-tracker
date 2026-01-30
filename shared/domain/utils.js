/**
 * Shared utility functions for support-tracker services.
 */

export const areObjectsInArrayEmpty = arr => {
  if (Array.isArray(arr[0])) return arr.every(subArr => subArr.every(num => num === 0));
  if (arr.length === 0) return true;
  return false;
};

export const removeDuplicates = (items, getKey = item => item) => {
  const memory = new Set();
  const flat = items.reduce((prev, item) => prev.concat(item), []);
  return flat.reduce((result, item) => {
    const key = getKey(item);
    const seen = memory.has(key);
    memory.add(key);
    if (!seen) result.push(item);
    return result;
  }, []);
};

export const getSdk = (repository) => {
  switch (repository.toLowerCase()) {
    case 'botbuilder-java':
      return 'Java';
    case 'botbuilder-js':
      return 'Node';
    case 'botbuilder-dotnet':
      return 'C#';
    case 'botbuilder-python':
      return 'Python';
    case 'botframework-directlinejs':
      return 'Node';
    default:
      return '(Unknown)';
  }
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function checkAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}
