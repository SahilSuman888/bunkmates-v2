// Minimal shim for react-native-worklets to avoid native initialization in Expo Go.
const noop = () => {};

const WorkletsShim: any = {
  install: noop,
  configure: noop,
};

export default WorkletsShim;
export const install = noop;
export const configure = noop;
