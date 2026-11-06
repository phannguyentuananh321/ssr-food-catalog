const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { supabase, BUCKET_NAME } = require('../lib/supabase');
const { config } = require('../config/env');

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

/**
 * Upload an image buffer to Supabase Storage (with fallback if credentials not provided)
 * @param {Express.Multer.File} file 
 * @param {string} folder 
 * @returns {Promise<{ path: string, url: string }>}
 */
async function uploadImage(file, folder = 'dishes') {
  if (!file || !file.buffer) {
    throw new Error('Không có file ảnh được tải lên.');
  }

  const ext = MIME_TO_EXT[file.mimetype] || 'jpg';
  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const storagePath = `${folder}/${uniqueName}`;

  // If Supabase Storage is configured, upload to bucket
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('[SUPABASE STORAGE UPLOAD ERROR]:', error.message);
        throw new Error(`Tải ảnh lên Supabase Storage thất bại: ${error.message}`);
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

      return {
        path: storagePath,
        url: urlData.publicUrl
      };
    } catch (err) {
      console.error('[STORAGE SERVICE ERROR]:', err.message);
      throw err;
    }
  }

  // Fallback: Local uploads directory when Supabase credentials are not yet supplied
  const localDir = path.resolve(process.cwd(), 'public', 'uploads', folder);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const localFilePath = path.join(localDir, uniqueName);
  fs.writeFileSync(localFilePath, file.buffer);

  const relativePath = `uploads/${folder}/${uniqueName}`;
  return {
    path: relativePath,
    url: `/${relativePath}`
  };
}

/**
 * Remove image from Supabase Storage or local fallback
 * @param {string} storagePath 
 */
async function deleteImage(storagePath) {
  if (!storagePath) return;

  // External web URL (e.g. Unsplash seed data) - skip deleting external CDN
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return;
  }

  if (storagePath.startsWith('uploads/')) {
    const localFilePath = path.resolve(process.cwd(), 'public', storagePath);
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (e) {
        console.warn('[LOCAL DELETE WARNING]:', e.message);
      }
    }
    return;
  }

  if (supabase) {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (error) {
        console.warn(`[SUPABASE STORAGE DELETE WARNING] Không thể xóa ảnh ${storagePath}: ${error.message}`);
      }
    } catch (err) {
      console.warn(`[SUPABASE STORAGE DELETE EXCEPTION]: ${err.message}`);
    }
  }
}

/**
 * Resolve displayable image URL from stored path
 * @param {string|null} imagePath 
 * @returns {string}
 */
function getImageUrl(imagePath) {
  if (!imagePath) {
    return '/images/placeholder.svg';
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  if (imagePath.startsWith('/')) {
    return imagePath;
  }

  if (imagePath.startsWith('uploads/')) {
    return `/${imagePath}`;
  }

  if (supabase) {
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(imagePath);
    return data.publicUrl;
  }

  return `/${imagePath}`;
}

module.exports = {
  uploadImage,
  deleteImage,
  getImageUrl
};
