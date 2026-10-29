import React from "react";
import {
  SettingsHeaderGradientMask,
  SettingsHeaderGradientMaskProps,
} from "./SettingsHeaderGradientMask";

export interface SettingsFooterGradientMaskProps
  extends Omit<SettingsHeaderGradientMaskProps, "position"> {}

/**
 * SettingsFooterGradientMask — Directly renders SettingsHeaderGradientMask
 * with position="bottom" for an exact identical 6-stop dissolve mask.
 */
export const SettingsFooterGradientMask: React.FC<SettingsFooterGradientMaskProps> = React.memo(
  (props) => {
    return <SettingsHeaderGradientMask {...props} position="bottom" />;
  }
);
SettingsFooterGradientMask.displayName = "SettingsFooterGradientMask";

export default SettingsFooterGradientMask;
