import React from "react";
import { Animated as RNAnimated, ViewProps } from "react-native";

// Minimal Moti shim that provides `MotiView` and `motify` helpers.
// Use `React.createElement` to avoid JSX in a .ts file so Metro's parser
// doesn't choke on TSX when this file is treated as TypeScript.

export const MotiView: React.FC<
  ViewProps & { from?: any; animate?: any; transition?: any; exit?: any }
> = ({ children, style }) => {
  return React.createElement(RNAnimated.View as any, { style }, children) as any;
};

export function motify<T extends React.ComponentType<any>>(Comp: T) {
  return Comp;
}

export default {
  MotiView,
  motify,
};
