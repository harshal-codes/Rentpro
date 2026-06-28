import React, { useState, useEffect } from 'react'
import API from '../api/axios'
import styles from './PhotoGallery.module.css'

export default function PhotoGallery({ propertyId }) {
  const [photos, setPhotos]     = useState([])
  const [active, setActive]     = useState(null)   // lightbox index
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!propertyId) return
    API.get(`/photos/${propertyId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : []
        setPhotos(data)
        if (data.length > 0) setActive(0)
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [propertyId])

  if (loading) return <div className={styles.loading}>Loading photos…</div>
  if (photos.length === 0) return (
    <div className={styles.noPhotos}>
      <span>🏢</span>
      <p>No photos uploaded yet</p>
    </div>
  )

  return (
    <div className={styles.gallery}>
      {/* Main image */}
      <div className={styles.mainImg}>
        <img src={photos[active]?.url} alt="property" />
        {photos.length > 1 && (
          <>
            <button className={`${styles.navBtn} ${styles.prev}`} onClick={() => setActive(i => (i - 1 + photos.length) % photos.length)}>‹</button>
            <button className={`${styles.navBtn} ${styles.next}`} onClick={() => setActive(i => (i + 1) % photos.length)}>›</button>
          </>
        )}
        <div className={styles.counter}>{active + 1} / {photos.length}</div>
      </div>

      {/* Thumbnails strip */}
      {photos.length > 1 && (
        <div className={styles.thumbStrip}>
          {photos.map((p, i) => (
            <div
              key={p.id}
              className={`${styles.thumb} ${i === active ? styles.thumbActive : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={p.url} alt={`photo ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
