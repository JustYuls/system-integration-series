// Reads the command-line arguments of venues-cli.js (already without "node" and the script name).
export const USAGE = "Usage: node venues-cli.js --capacity <people> [--outdoor]";

export function parseArgs(args) {
  const options = { capacity: undefined, outdoor: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--outdoor") {
      options.outdoor = true;
    } else if (arg === "--capacity") {
      const value = args[++i];
      if (value === undefined) throw new Error("--capacity needs a number, for example --capacity 100");
      options.capacity = Number(value);
      if (!Number.isInteger(options.capacity) || options.capacity < 1) {
        throw new Error(`"${value}" is not a valid capacity: use a whole number of 1 or more`);
      }
    } else {
      throw new Error(`unknown argument "${arg}"`);
    }
  }
  if (options.capacity === undefined) throw new Error("missing --capacity");
  return options;
}
