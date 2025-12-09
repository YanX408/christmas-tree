import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 启用 CORS
app.use(cors());
app.use(express.json());

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const photosDir = path.join(__dirname, 'public', 'photos');
    try {
      await fs.mkdir(photosDir, { recursive: true });
      cb(null, photosDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // 生成符合程序识别格式的文件名: YYYY_MM_ID.jpg
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    
    // 生成唯一ID（使用时间戳的后6位）
    const id = String(timestamp).slice(-6);
    
    // 格式: YYYY_MM_ID.jpg
    cb(null, `${year}_${month}_${id}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 20 // 最多同时上传20个文件
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片格式: jpeg, jpg, png, gif, webp'));
    }
  }
});

// 读取 photos.json
async function readPhotosJson() {
  const photosJsonPath = path.join(__dirname, 'public', 'photos', 'photos.json');
  try {
    const data = await fs.readFile(photosJsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // 如果文件不存在，返回空数组
    return [];
  }
}

// 写入 photos.json
async function writePhotosJson(photos) {
  const photosJsonPath = path.join(__dirname, 'public', 'photos', 'photos.json');
  await fs.writeFile(photosJsonPath, JSON.stringify(photos, null, 2), 'utf-8');
}

// 获取所有照片列表
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await readPhotosJson();
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 上传照片（支持单文件和批量上传）
app.post('/api/photos/upload', upload.array('photos', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const photos = await readPhotosJson();
    const uploadedFiles = [];
    const errors = [];

    // 处理每个上传的文件
    for (const file of req.files) {
      const fileName = file.filename;
      
      // 检查是否已存在
      if (!photos.includes(fileName)) {
        photos.push(fileName);
        uploadedFiles.push(fileName);
      } else {
        errors.push(`${fileName} 已存在`);
      }
    }

    // 如果有新文件，更新 photos.json
    if (uploadedFiles.length > 0) {
      // 按文件名排序（自动按时间排序）
      photos.sort();
      await writePhotosJson(photos);
    }

    res.json({
      success: true,
      uploaded: uploadedFiles,
      count: uploadedFiles.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功上传 ${uploadedFiles.length} 张照片`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除照片
app.delete('/api/photos/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const photosDir = path.join(__dirname, 'public', 'photos');
    const filePath = path.join(photosDir, filename);

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 删除文件
    await fs.unlink(filePath);

    // 从 photos.json 中移除
    const photos = await readPhotosJson();
    const updatedPhotos = photos.filter(p => p !== filename);
    await writePhotosJson(updatedPhotos);

    res.json({
      success: true,
      message: '照片删除成功'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`照片管理服务器运行在 http://localhost:${PORT}`);
});

