import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';

export default function TextLogo({ style, textWhite = false, size = 'md' }) {
  const isSm = size === 'sm';
  const isXs = size === 'xs';

  const barHeight = isXs ? 'h-4 w-1' : isSm ? 'h-6 w-1.5' : 'h-8 w-2';
  const textSize = isXs ? 'text-sm' : isSm ? 'text-base' : 'text-2xl';
  const barMargin = isXs ? 'mr-0.5' : isSm ? 'mr-1' : 'mr-1';
  const lastBarMargin = isXs ? 'mr-1' : isSm ? 'mr-1.5' : 'mr-2';

  return (
    <View style={[tw`flex-row items-center justify-center`, style]}>
      <View style={tw`${barHeight} rounded-full bg-[#ED1C24] ${barMargin}`} />
      <View style={tw`${barHeight} rounded-full bg-[#2ECC71] ${barMargin}`} />
      <View style={tw`${barHeight} rounded-full bg-[#0055A5] ${lastBarMargin}`} />
      <Text style={tw`${textSize} font-black ${textWhite ? 'text-white' : 'text-gray-800'} tracking-tighter`}>DIGI</Text>
      <Text style={tw`${textSize} font-black ${textWhite ? 'text-blue-200' : 'text-[#0055A5]'} tracking-tighter`}>Handover</Text>
    </View>
  );
}
