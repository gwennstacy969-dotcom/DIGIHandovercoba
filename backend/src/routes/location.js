const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const geocodingService = require('../services/geocodingService');

/**
 * GET /api/location/reverse-geocode?lat=-7.61875&lng=109.14419
 * Protected endpoint for reverse geocoding coordinates.
 */
router.get('/reverse-geocode', authenticateToken, async (req, res) => {
  try {
    const lat = req.query.lat || req.query.latitude;
    const lng = req.query.lng || req.query.longitude;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Parameter lat dan lng wajib disertakan'
      });
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);

    if (isNaN(numLat) || isNaN(numLng)) {
      return res.status(400).json({
        success: false,
        error: 'Format koordinat lat dan lng tidak valid'
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
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

