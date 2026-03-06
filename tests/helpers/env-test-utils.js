function withEnv(overrides, fn) {
  const previous = {};
  const keys = Object.keys(overrides);

  for (const key of keys) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  const restore = () => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (err) {
    restore();
    throw err;
  }
}

module.exports = {
  withEnv
};
