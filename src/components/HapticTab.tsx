import { PlatformPressable } from '@react-navigation/elements';
import { triggerAppHaptic } from '../contexts/AppSettingsContext';

export function HapticTab(props: any) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          triggerAppHaptic("light");
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
