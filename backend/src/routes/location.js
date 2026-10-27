const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const geocodingService = require('../services/geocodingService');
const logger = require('../config/logger');

const STRICT_NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;

/**
 * GET /api/location/reverse-geocode?lat=-7.61875&lng=109.14419
 * Protected endpoint for reverse geocoding coordinates.
 */
router.get('/reverse-geocode', authenticateToken, async (req, res) => {
  try {
    const lat = req.query.lat !== undefined ? req.query.lat : req.query.latitude;
    const lng = req.query.lng !== undefined ? req.query.lng : req.query.longitude;

    if (lat === undefined || lat === null || String(lat).trim() === '' ||
        lng === undefined || lng === null || String(lng).trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Parameter lat dan lng wajib disertakan'
      });
    }

    const strLat = String(lat).trim();
    const strLng = String(lng).trim();

    // Pastikan input adalah angka numerik utuh, tolak nilai parsial seperti '12abc'
    if (!STRICT_NUMERIC_REGEX.test(strLat) || !STRICT_NUMERIC_REGEX.test(strLng)) {
      return res.status(400).json({
        success: false,
        error: 'Format koordinat lat dan lng tidak valid. Harus berupa angka numerik utuh.'
      });
    }

    const numLat = parseFloat(strLat);
    const numLng = parseFloat(strLng);

    // Validasi batas geografis (-90..90 dan -180..180)
    if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Koordinat di luar batas geografis yang valid (Latitude: -90 s/d 90, Longitude: -180 s/d 180)'
      });
    }

    const result = await geocodingService.reverseGeocode(numLat, numLng);

    if (!result) {
      return res.json({
        success: false,
        latitude: numLat,
        longitude: numLng,
        address: null,
        message: 'Alamat tidak tersedia'
      });
    }

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error(`Location reverse geocode API error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat memproses data lokasi'
    });
  }
});

module.exports = router;
