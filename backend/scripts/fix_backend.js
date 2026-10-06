const fs = require('fs');
let path = 'e:/Magang/HandoverApp/backend/index.js';
let code = fs.readFileSync(path, 'utf8');

// 1. Delete Worker
code = code.replace(
`app.delete('/api/workers/:id', async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id }
    });`,
`app.delete('/api/workers/:id', async (req, res) => {
  try {
    // Delete related handovers first
    await prisma.handover.deleteMany({
      where: { userId: req.params.id }
    });
    
    // Delete related password reset requests
    await prisma.passwordResetRequest.deleteMany({
      where: { userId: req.params.id }
    });

    await prisma.user.delete({
      where: { id: req.params.id }
    });`
);

// 2. Delete Pengawas
code = code.replace(
`app.delete('/api/pengawas/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });`,
`app.delete('/api/pengawas/:id', async (req, res) => {
  try {
    // Delete related password reset requests
    await prisma.passwordResetRequest.deleteMany({
      where: { userId: req.params.id }
    });
    // SetNull for resetByAdminId handled by prisma, but just to be safe
    await prisma.passwordResetRequest.updateMany({
      where: { resetByAdminId: req.params.id },
      data: { resetByAdminId: null }
    });

    await prisma.user.delete({ where: { id: req.params.id } });`
);

// 3. Remove sendEmail option in API
code = code.replace(
`    if (sendEmail) {
      // Tunggu hingga integrasi email ditambahkan
      console.log('Notifikasi email diminta, namun belum diimplementasikan.');
    }`,
``
);

fs.writeFileSync(path, code);
console.log('Backend delete patched.');
