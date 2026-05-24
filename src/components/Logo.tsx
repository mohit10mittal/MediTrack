import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 64 }: LogoProps) {
  const s = size;
  const border = s * 0.05;
  const r = s * 0.22;

  return (
    <Svg width={s} height={s} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="greenGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#43A047" />
          <Stop offset="1" stopColor="#1B5E20" />
        </LinearGradient>
        <LinearGradient id="redGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#EF5350" />
          <Stop offset="1" stopColor="#B71C1C" />
        </LinearGradient>
      </Defs>

      {/* Red border background square */}
      <Rect x="2" y="2" width="96" height="96" rx="22" ry="22" fill="url(#redGrad)" />

      {/* White inset */}
      <Rect x="6" y="6" width="88" height="88" rx="18" ry="18" fill="white" />

      {/* Green plus sign */}
      {/* Horizontal bar */}
      <Rect x="22" y="40" width="56" height="20" rx="6" ry="6" fill="url(#greenGrad)" />
      {/* Vertical bar */}
      <Rect x="40" y="22" width="20" height="56" rx="6" ry="6" fill="url(#greenGrad)" />
    </Svg>
  );
}

export function LogoWithText({ size = 48 }: LogoProps) {
  return (
    <View style={styles.row}>
      <Logo size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
