/**
 * Production Safety Guard
 * Mencegah eksekusi script destruktif / seeder / reset data di environment production.
 */
function assertNotProduction(scriptName = 'Skrip ini') {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (isProd) {
    console.error('\n=============================================================');
    console.error(`❌ [AKSES DITOLAK] ${scriptName} DILARANG DIJALANKAN DI PRODUCTION!`);
    console.error('Sistem mendeteksi NODE_ENV=production.');
    console.error('Skrip langsung dihentikan demi menjaga integritas data riil perusahaan.');
    console.error('=============================================================\n');
    process.exit(1);
  }
}

module.exports = { assertNotProduction };
