const fs = require('fs');
let txt = fs.readFileSync('e:/Magang/HandoverApp/backend/index.js', 'utf8');

txt = txt.replace(
  "app.use('/uploads', express.static('uploads'));",
  "app.use('/uploads', (req, res, next) => {\n  res.setHeader('Content-Type', 'image/jpeg');\n  next();\n}, express.static('uploads'));"
);

txt = txt.replace(
  "const upload = multer({ dest: 'uploads/' });",
  "const storage = multer.diskStorage({\n  destination: function (req, file, cb) {\n    cb(null, 'uploads/')\n  },\n  filename: function (req, file, cb) {\n    const ext = require('path').extname(file.originalname) || '.jpg';\n    cb(null, file.fieldname + '-' + Date.now() + ext)\n  }\n});\nconst upload = multer({ storage: storage });"
);

fs.writeFileSync('e:/Magang/HandoverApp/backend/index.js', txt);
