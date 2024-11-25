export const createValidator = <T extends any[]>(
  validate: (...args: T) => boolean,
): ((...args: T) => boolean) => {
  return (...args: T) => {
    return validate(...args);
  };
};
