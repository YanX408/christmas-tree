import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoItem {
  filename: string;
  url: string;
}

interface PhotoManagerProps {
  onOpenChange?: (isOpen: boolean) => void;
}

const PhotoManager: React.FC<PhotoManagerProps> = ({ onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 通知父组件状态变化
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // API 基础地址（生产环境使用相对路径，开发环境使用完整 URL）
  const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

  // 获取照片列表
  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/photos`);
      if (response.ok) {
        const filenames: string[] = await response.json();
        const photoItems: PhotoItem[] = filenames.map(filename => ({
          filename,
          url: `/photos/${filename}`
        }));
        setPhotos(photoItems);
      }
    } catch (error) {
      console.error('获取照片列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPhotos();
    }
  }, [isOpen]);

  // 处理文件上传（支持批量）
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 验证所有文件
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles: string[] = [];
    const oversizedFiles: string[] = [];

    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(file.name);
      }
      if (file.size > 10 * 1024 * 1024) {
        oversizedFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`以下文件格式不支持: ${invalidFiles.join(', ')}\n只支持: JPEG, PNG, GIF, WebP`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (oversizedFiles.length > 0) {
      alert(`以下文件超过 10MB: ${oversizedFiles.join(', ')}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    const formData = new FormData();
    
    // 添加所有文件（使用 'photos' 作为字段名，支持批量）
    Array.from(files).forEach(file => {
      formData.append('photos', file);
    });

    try {
      const response = await fetch(`${API_BASE}/photos/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        // 刷新照片列表
        await fetchPhotos();
        
        // 触发 TreeSystem 重新加载照片
        window.dispatchEvent(new CustomEvent('refreshPhotos'));
        
        // 显示成功消息
        if (result.errors && result.errors.length > 0) {
          alert(`成功上传 ${result.count} 张照片\n警告: ${result.errors.join('\n')}`);
        } else {
          alert(`成功上传 ${result.count} 张照片！\n照片已自动加载到圣诞树。`);
        }
      } else {
        const error = await response.json();
        alert(`上传失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败，请检查服务器是否运行');
    } finally {
      setUploading(false);
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除照片
  const handleDelete = async (filename: string) => {
    if (!confirm(`确定要删除照片 "${filename}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/photos/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // 刷新照片列表
        await fetchPhotos();
        alert('照片删除成功！');
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请检查服务器是否运行');
    }
  };

  return (
    <>
      {/* 上传按钮 - 右下角 */}
      <div className="fixed bottom-4 right-4 z-40 pointer-events-auto">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2.5 bg-gradient-to-br from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-400/40 rounded-lg text-amber-200 text-sm font-light transition-all shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] backdrop-blur-sm flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {isOpen ? '关闭' : '照片管理'}
        </motion.button>
      </div>

      {/* 隐藏的文件输入 - 支持多选 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        multiple
        className="hidden"
      />

      {/* 照片管理面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-4 z-50 bg-gradient-to-br from-black/95 to-amber-950/30 backdrop-blur-sm border border-amber-400/30 rounded-lg p-4 w-96 max-h-[70vh] overflow-y-auto shadow-[0_0_30px_rgba(251,191,36,0.2)]"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-amber-200 font-light text-lg cinzel tracking-wide">照片管理</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-amber-200/60 hover:text-amber-200 text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* 上传按钮 - 支持批量上传 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full mb-4 px-4 py-2.5 bg-gradient-to-br from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-400/40 rounded-lg text-amber-200 text-sm font-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] backdrop-blur-sm"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  上传中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  批量上传照片
                </>
              )}
            </button>

            {/* 照片列表 */}
            {loading ? (
              <div className="text-center text-white/50 py-8">加载中...</div>
            ) : photos.length === 0 ? (
              <div className="text-center text-white/50 py-8">暂无照片</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <motion.div
                    key={photo.filename}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group"
                  >
                    <div className="aspect-square bg-white/5 rounded overflow-hidden border border-white/10">
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999"%3E图片加载失败%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-white/60 truncate" title={photo.filename}>
                      {photo.filename}
                    </div>
                    <button
                      onClick={() => handleDelete(photo.filename)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="删除"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 提示信息 */}
            <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
              <p>• 支持格式: JPEG, PNG, GIF, WebP</p>
              <p>• 最大文件大小: 10MB</p>
              <p>• 支持批量上传（可同时选择多张）</p>
              <p>• 文件名格式: YYYY_MM_ID.jpg（自动生成）</p>
              <p>• 上传后会自动添加到照片列表</p>
              <p className="text-amber-400/70 mt-1">✨ 上传后照片会自动加载到圣诞树</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PhotoManager;

