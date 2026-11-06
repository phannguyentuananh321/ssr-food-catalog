const multer = require('multer');

// Store file in memory buffer so it can be directly streamed/uploaded to Supabase Storage
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPG, JPEG, PNG, WEBP.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter
});

module.exports = upload;
