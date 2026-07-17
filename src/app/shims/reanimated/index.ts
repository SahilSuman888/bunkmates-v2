import { Animated as RNAnimated } from 'react-native';

// Minimal reanimated shim for Expo Go development.
// Exports the React Native Animated API and simple no-op helpers.
const FadeIn = (props: any) => props.children;
const FadeOut = (props: any) => props.children;

const ReanimatedShim = RNAnimated as any;

export default ReanimatedShim;
export { FadeIn, FadeOut, RNAnimated };
