declare module 'react-gauge-chart' {
  import React from 'react';
  interface GaugeChartProps {
    id?: string;
    percent?: number;
    nrOfLevels?: number;
    animate?: boolean;
    animDelay?: number;
    animDuration?: number;
    textColor?: string;
    formatTextValue?: (val: string | number) => string;
    colors?: string[];
    arcWidth?: number;
    arcPadding?: number;
    cornerRadius?: number;
    needleColor?: string;
    needleBaseColor?: string;
    needleScale?: number;
    style?: React.CSSProperties;
    className?: string;
  }
  const GaugeChart: React.FC<GaugeChartProps>;
  export default GaugeChart;
}
