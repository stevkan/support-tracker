/**
 * Removes duplicates from an array of items.
 *
 * @param {Array} items - The array of items.
 * @param {Function} [getKey=item => item] - The function used to extract the key from each item.
 * @returns {Array} - The array with duplicates removed.
 */
const removeDuplicates = (items, getKey = item => item) => {
  const memory = new Set();
  const flat = items.reduce((prev, item) => prev.concat(item), []);
  return flat.reduce((result, item) => {
    const key = getKey(item)
    const seen = memory.has(key);
    memory.add(key);
    !seen && result.push(item);
    return result
  }, [])
};

/**
 * Retrieves the SDK language based on the given repository.
 * 
 * @param {string} repository - The name of the repository.
 * @returns {string} The SDK language corresponding to the repository.
 */
const getSdk = (repository) => {
  switch (repository.toLowerCase()) {
    case "botbuilder-java":
      return "Java";
    case "botbuilder-js":
      return "Node";
    case "botbuilder-dotnet":
      return "C#";
    case "botbuilder-python":
      return "Python";
    case "BotFramework-DirectLineJS":
      return "Node";
    default:
      return "(Unknown)"
  }
};

/**
 * Sleeps for a specified amount of time.
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} - A promise that resolves after the specified time.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export { getSdk, removeDuplicates, sleep }