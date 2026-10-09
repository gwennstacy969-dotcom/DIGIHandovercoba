module.exports = ({ config }) => {
  const isProd = process.env.APP_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production';
  
  if (!isProd) {
    const buildProps = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-build-properties');
    if (buildProps) {
      if (!buildProps[1].android) buildProps[1].android = {};
      buildProps[1].android.usesCleartextTraffic = true;
    } else {
      config.plugins.push(['expo-build-properties', { android: { usesCleartextTraffic: true } }]);
    }
  }

  return config;
};
