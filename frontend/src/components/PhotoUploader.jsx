import React, { useState, useEffect, useRef } from 'react'
import API from '../api/axios'
import toast from 'react-hot-toast'
import styles from './PhotoUploader.module.css'

export default function PhotoUploader({ propertyId, propertyTitle, onPhotosChanged }) {
  const [photos, setPhotos]     = useState([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState({})
  const fileRef = useRef(null)

  useEffect(() => { fetchPhotos() }, [propertyId])

  const fetchPhotos = async () => {
    try {
      const res = await API.get(`/photos/${propertyId}`)
      const data = Array.isArray(res.data) ? res.data : []
      setPhotos(data)
      if (onPhotosChanged) onPhotosChanged(propertyId, data)
    } catch { setPhotos([]) }
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    let uploaded = 0
    for (const file of files) {
      try {
        const form = new FormData()
        form.append('file', file)
        await API.post(`/photos/${propertyId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        uploaded++
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${err.response?.data?.detail || 'Error'}`)
      }
    }
    if (uploaded > 0) toast.success(`${uploaded} photo${uploaded > 1 ? 's' : ''} uploaded! 📸`)
    await fetchPhotos()
    setUploading(false)
    fileRef.current.value = ''
  }

  const handleSetThumbnail = async (photoId) => {
    try {
      await API.patch(`/photos/${photoId}/set-thumbnail`)
      toast.success('Thumbnail set! ✅')
      fetchPhotos()
    } catch { toast.error('Failed to set thumbnail') }
  }

  const handleDelete = async (photoId) => {
    if (!window.confirm('Delete this photo?')) return
    setDeleting(d => ({ ...d, [photoId]: true }))
    try {
      await API.delete(`/photos/${photoId}`)
      toast.success('Photo deleted')
      fetchPhotos()
    } catch { toast.error('Failed to delete') }
    finally { setDeleting(d => ({ ...d, [photoId]: false })) }
  }

  return (
    <div className={styles.uploader}>
      <div className={styles.header}>
        <h4>📸 Property Photos</h4>
        <p>{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</p>
      </div>

      {/* Upload button */}
      <label className={`${styles.uploadBtn} ${uploading ? styles.uploading : ''}`}>
        {uploading ? '⏳ Uploading...' : '+ Add Photos'}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
      </label>
      <p className={styles.hint}>Max 5MB each • JPEG, PNG, WebP • Click a photo to set as thumbnail</p>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className={styles.grid}>
          {photos.map(photo => (
            <div key={photo.id} className={`${styles.photoItem} ${photo.is_thumbnail ? styles.thumbnail : ''}`}>
              <img src={photo.url} alt="property" loading="lazy" />
              {photo.is_thumbnail && <span className={styles.thumbBadge}>★ Thumbnail</span>}
              <div className={styles.photoActions}>
                {!photo.is_thumbnail &&
                  <button onClick={() => handleSetThumbnail(photo.id)} title="Set as thumbnail">★</button>
                }
                <button
                  className={styles.deletePhoto}
                  onClick={() => handleDelete(photo.id)}
                  disabled={deleting[photo.id]}
                  title="Delete photo"
                >
                  {deleting[photo.id] ? '...' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <div className={styles.empty}>
          <span>🖼️</span>
          <p>No photos yet. Add photos to attract more tenants!</p>
        </div>
      )}
    </div>
  )
}
