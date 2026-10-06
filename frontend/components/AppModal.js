import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * DIGI Handover Design System - AppModal
 * Komponen popup reusable (presentational only). Tidak memuat business logic.
 *
 * type : success | error | warning | info | confirm | location | maintenance
 * tone : (opsional) override warna -> success | error | warning | info
 */
export const APP_COLORS = {
  navy: '#003366',
  blue: '#0055A5',
  lightBlue: '#4A90E2',
  green: '#00A651',
  red: '#ED1C24',
  amber: '#F59E0B',
  bg: '#F8FAFC',
  text: '#111827',
  muted: '#6B7280',
};

const TONES = {
  success: { accent: '#00A651', soft: '#E8F7EF', ring: '#C6EBD6', gradient: ['#00A651', '#007A3E'] },
  error: { accent: '#ED1C24', soft: '#FDECEC', ring: '#F9CACC', gradient: ['#ED1C24', '#B30000'] },
  warning: { accent: '#F59E0B', soft: '#FEF3C7', ring: '#FCE3A0', gradient: ['#0055A5', '#003366'] },
  info: { accent: '#0055A5', soft: '#E6F0FA', ring: '#C5DBF1', gradient: ['#0055A5', '#003366'] },
};

const TYPES = {
  success: { icon: 'checkmark-circle', tone: 'success' },
  error: { icon: 'alert-circle', tone: 'error' },
  warning: { icon: 'warning', tone: 'warning' },
  info: { icon: 'information-circle', tone: 'info' },
  confirm: { icon: 'help-circle', tone: 'info' },
  location: { icon: 'location', tone: 'success' },
  maintenance: { icon: 'construct', tone: 'warning' },
};

function ActionButton({ label, onPress, variant = 'primary', gradient, icon, loading, disabled, style }) {
  const base = 'min-h-[50px] rounded-2xl flex-row items-center justify-center px-4';
  const content = (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? APP_COLORS.muted : '#fff'} style={tw`mr-2`} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={variant === 'secondary' ? APP_COLORS.muted : '#fff'} style={tw`mr-2`} />
      ) : null}
      <Text
        style={tw`${variant === 'secondary' ? 'text-gray-600' : 'text-white'} font-bold text-[15px]`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={disabled || loading}
        style={[tw`${base} bg-[#F3F4F6]`, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ opacity: disabled ? 0.6 : 1 }, style]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          tw`${base}`,
          { shadowColor: gradient[1], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
        ]}
      >
        {content}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function AppModal({
  visible,
  type = 'info',
  tone,
  title,
  message,
  badge,
  icon,
  children,
  primaryText,
  onPrimary,
  primaryIcon,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryText,
  onSecondary,
  tertiaryText,
  onTertiary,
  onClose,
  showClose = false,
  showAccent = true,
  hideIcon = false,
  dismissOnBackdrop = false,
  footer,
  buttonsDirection = 'auto', // 'auto' | 'row' | 'column'
}) {
  const { width } = useWindowDimensions();
  const cfg = TYPES[type] || TYPES.info;
  const palette = TONES[tone || cfg.tone] || TONES.info;

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      scale.setValue(0.96);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fade, scale]);

  const cardWidth = Math.min(360, width * 0.9);
  const hasTwoButtons = !!primaryText && !!secondaryText && !tertiaryText;
  const row = buttonsDirection === 'row' || (buttonsDirection === 'auto' && hasTwoButtons);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose || onSecondary || onPrimary}
    >
      <Animated.View
        style={[
          tw`flex-1 justify-center items-center px-4`,
          { backgroundColor: 'rgba(15,23,42,0.6)', opacity: fade },
          Platform.OS === 'web' ? { zIndex: 99999 } : null,
        ]}
      >
        {dismissOnBackdrop && onClose ? (
          <TouchableOpacity style={tw`absolute inset-0`} activeOpacity={1} onPress={onClose} />
        ) : null}

        <Animated.View
          style={[
            tw`bg-white rounded-[30px] overflow-hidden`,
            {
              width: cardWidth,
              maxHeight: '88%',
              transform: [{ scale }],
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.28,
              shadowRadius: 28,
              elevation: 24,
            },
          ]}
        >
          {showAccent && (
            <View style={tw`flex-row h-1.5`}>
              <View style={[tw`flex-1`, { backgroundColor: APP_COLORS.red }]} />
              <View style={[tw`flex-1`, { backgroundColor: APP_COLORS.blue }]} />
              <View style={[tw`flex-1`, { backgroundColor: APP_COLORS.green }]} />
            </View>
          )}

          {showClose && onClose ? (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={tw`absolute top-5 right-4 z-50 w-8 h-8 rounded-full bg-gray-100 items-center justify-center`}
            >
              <Ionicons name="close" size={18} color="#4B5563" />
            </TouchableOpacity>
          ) : null}

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={tw`px-6 pt-7 pb-6 items-center`}
          >
            {!hideIcon && (
              <View style={tw`items-center justify-center mb-4`}>
                <View
                  style={[
                    tw`absolute rounded-full`,
                    { width: 96, height: 96, backgroundColor: palette.accent, opacity: 0.1 },
                  ]}
                />
                <View
                  style={[
                    tw`w-[76px] h-[76px] rounded-full items-center justify-center`,
                    {
                      backgroundColor: palette.soft,
                      borderWidth: 3,
                      borderColor: palette.ring,
                      shadowColor: palette.accent,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      elevation: 4,
                    },
                  ]}
                >
                  <Ionicons name={icon || cfg.icon} size={40} color={palette.accent} />
                </View>
              </View>
            )}

            {badge ? (
              <View style={[tw`px-3 py-1 rounded-full mb-3`, { backgroundColor: palette.soft }]}>
                <Text style={[tw`font-bold text-[10px] tracking-widest uppercase`, { color: palette.accent }]}>
                  {badge}
                </Text>
              </View>
            ) : null}

            {title ? (
              <Text style={tw`text-[22px] font-black text-[#111827] text-center leading-7 mb-2`}>{title}</Text>
            ) : null}

            {message ? (
              <Text style={tw`text-[14px] text-[#6B7280] text-center leading-5 font-medium mb-1 px-1`}>{message}</Text>
            ) : null}

            {children ? <View style={tw`w-full mt-3`}>{children}</View> : null}

            {footer ? <View style={tw`w-full mt-5`}>{footer}</View> : null}

            {(primaryText || secondaryText || tertiaryText) && (
              <View style={tw`w-full mt-6 ${row ? 'flex-row' : ''}`}>
                {secondaryText && row ? (
                  <ActionButton
                    variant="secondary"
                    label={secondaryText}
                    onPress={onSecondary}
                    style={tw`flex-1 mr-2`}
                  />
                ) : null}
                {primaryText ? (
                  <ActionButton
                    label={primaryText}
                    onPress={onPrimary}
                    gradient={palette.gradient}
                    icon={primaryIcon}
                    loading={primaryLoading}
                    disabled={primaryDisabled}
                    style={row ? tw`flex-1 ml-2` : tw`w-full`}
                  />
                ) : null}
                {secondaryText && !row ? (
                  <ActionButton
                    variant="secondary"
                    label={secondaryText}
                    onPress={onSecondary}
                    style={tw`w-full mt-3`}
                  />
                ) : null}
                {tertiaryText ? (
                  <ActionButton
                    variant="secondary"
                    label={tertiaryText}
                    onPress={onTertiary}
                    style={tw`w-full mt-3`}
                  />
                ) : null}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Kartu detail kecil (label - value) untuk dipakai di dalam children AppModal */
export function AppModalDetail({ rows = [], tone = 'info' }) {
  const palette = TONES[tone] || TONES.info;
  return (
    <View style={[tw`w-full rounded-2xl p-4`, { backgroundColor: APP_COLORS.bg, borderWidth: 1, borderColor: '#E5E7EB' }]}>
      {rows.map((r, i) => (
        <View
          key={`${r.label}-${i}`}
          style={tw`${i === rows.length - 1 ? '' : 'mb-3'}`}
        >
          <Text style={tw`text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-0.5`}>{r.label}</Text>
          <Text
            style={[
              tw`text-[14px] font-bold`,
              { color: r.color || (r.accent ? palette.accent : APP_COLORS.text) },
              r.mono ? { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' } : null,
            ]}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
