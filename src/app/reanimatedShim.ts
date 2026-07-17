// Local shim entrypoint used by app files to avoid importing
// the native react-native-reanimated worklets while running in Expo Go.
// It forwards to the lightweight shim under `app/shims/reanimated`.
import ReanimatedShim, { FadeIn, FadeOut, RNAnimated } from "./shims/reanimated";

export default ReanimatedShim;
export { FadeIn, FadeOut, RNAnimated };
