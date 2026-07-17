// Minimal shim for react-native-worklets to avoid native initialization in Expo Go.
// Exports the shape used by dependent packages but avoids any TurboModule/native calls.
const noop = () => {};

const WorkletsShim: any = {
  install: noop,
  configure: noop,
};

export default WorkletsShim;
export const install = noop;
export const configure = noop;
